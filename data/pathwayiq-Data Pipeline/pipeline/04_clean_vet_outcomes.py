"""
04_clean_vet_outcomes.py — VET Student Outcomes 2025 by Qualification
======================================================================
Input : TA28_DG_RawData_VETStudentOutcomes2025_ByQualification_IT1_20260330.xlsx
Output: silver/clean_vet_outcomes.parquet

Structure challenge: The Estimates sheet has a 4-row multi-level header.
Row 4 (0-indexed = 3) is the actual column header row.
Occupation and industry columns appear as 'Occupation 1', '%', 'Occupation 2', '%' ...
We reshape these into a long format with one row per qualification × occupation.

ANZSCO joining strategy:
- Program ID is a VET qualification code (e.g. 10727NAT) — not an ANZSCO code.
- Top-3 occupation columns contain ANZSCO *major group* labels (e.g. "Labourers").
- We map these to 1-digit ANZSCO major group codes via ANZSCO_MAJOR_GROUP_MAP.
- For the qualification-level dataset, anzsco_major_group_code is the
  available join key to occupation-level data.
"""

import sys
import json
from datetime import datetime
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import RidgeCV
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from config import (
    RAW_FILES, SILVER_FILES, PROFILE_DIR, LOG_DIR,
    VET_OUTCOMES_CFG, VET_OUTCOMES_RENAME,
    VALIDATION_RULES, PROFILE_SETTINGS,
    ANZSCO_MAJOR_GROUP_MAP, ANZSCO_MAJOR_GROUP_LABELS,
)
from utils.wrangling_utils import (
    get_logger, TransformationLog,
    run_profile, clean_headers, drop_empty_rows_cols, remove_duplicates,
    cast_numeric_cols, report_missing, validate_dataset, save_parquet,
    standardise_text_col, drop_rows_missing_key, flag_outliers_iqr,
    coerce_numeric_series, normalise_anzsco_title_series,
)

DATASET = "vet_outcomes"

INCOME_TARGET = "median_annual_income"
FOUNDATION_INDUSTRY_LABEL = "Foundation/Non-Vocational"
TOP_OCCUPATION_PCT_COLS = ["occupation_1_pct", "occupation_2_pct", "occupation_3_pct"]
TOP_INDUSTRY_PCT_COLS = ["industry_1_pct", "industry_2_pct", "industry_3_pct"]
INCOME_MODEL_RANDOM_STATE = 42
INCOME_MODEL_N_SPLITS = 5
INCOME_MODEL_ALPHA_GRID = np.logspace(-3, 3, 25)


def _build_long_from_label_pct_pairs(df_wide, id_col, label_prefix,
                                     label_out, pct_out, rank_prefix):
    """
    Generic helper to reshape label/% column pairs into long format.
    Detects columns by positional pattern: any col whose name starts with
    `label_prefix` is followed by a `%` or `%.N` column (pandas auto-suffix
    for duplicate headers).
    Works regardless of how many pairs exist (3 by default in these datasets).
    """
    cols = list(df_wide.columns)
    slots = []
    for i, col in enumerate(cols):
        col_name = str(col).strip().lower()
        if not col_name.startswith(label_prefix.lower()) or col_name.endswith("_pct"):
            continue
        pct_col = f"{col}_pct" if f"{col}_pct" in df_wide.columns else (cols[i + 1] if i + 1 < len(cols) else None)
        rank = len(slots) + 1
        slots.append((col, pct_col, f"{rank_prefix}{rank}"))

    frames = []
    for label_col, pct_col, rank_label in slots:
        chunk = df_wide[[id_col, label_col]].copy()
        chunk.columns = [id_col, label_out]
        if pct_col is not None and pct_col in df_wide.columns:
            chunk[pct_out] = coerce_numeric_series(df_wide[pct_col])
        chunk["rank"] = rank_label
        chunk = chunk[chunk[[label_out, pct_out]].notna().any(axis=1)].copy()
        frames.append(chunk)

    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def _rename_pair_pct_cols(df_wide, label_prefix):
    """Rename the unlabeled % columns that follow occupation/industry labels."""
    rename_map = {}
    cols = list(df_wide.columns)
    for i, col in enumerate(cols):
        name = str(col).strip().lower()
        if not name.startswith(label_prefix.lower()):
            continue
        if i + 1 >= len(cols):
            continue
        next_col = cols[i + 1]
        next_name = str(next_col).strip().lower()
        if next_name.startswith(label_prefix.lower()) or next_name.endswith("_pct"):
            continue
        rename_map[next_col] = f"{col}_pct"
    return df_wide.rename(columns=rename_map)


def _build_occupation_columns(df_wide):
    """Reshape the top-3 occupation columns into long format."""
    return _build_long_from_label_pct_pairs(
        df_wide,
        id_col="program_id",
        label_prefix="Occupation",
        label_out="occupation_label",
        pct_out="pct_employed_in_occ",
        rank_prefix="occ_top",
    )


def _build_industry_columns(df_wide):
    """Reshape the top-3 industry columns into long format."""
    return _build_long_from_label_pct_pairs(
        df_wide,
        id_col="program_id",
        label_prefix="Industry",
        label_out="industry_label",
        pct_out="pct_employed_in_industry",
        rank_prefix="ind_top",
    )


def _round_currency_series(series: pd.Series) -> pd.Series:
    """Round survey income figures to the published nearest-$100 convention."""
    return (np.round(series.astype(float) / 100.0) * 100.0).astype(float)


def _normalise_pct_block(
    df_wide: pd.DataFrame,
    pct_cols: list[str],
    total_col: str,
    flag_col: str,
    tlog: TransformationLog,
    other_col: str | None = None,
) -> pd.DataFrame:
    """
    Normalise top-k percentage columns when rounding drift pushes totals above 100.
    The adjusted row is scaled back to 100.0 and a flag is recorded.
    """
    available_cols = [col for col in pct_cols if col in df_wide.columns]
    if not available_cols:
        return df_wide

    df = df_wide.copy()
    total_before = df[available_cols].sum(axis=1, min_count=1)
    over_mask = total_before.gt(100)
    df[flag_col] = over_mask.astype("boolean")

    for idx in df.index[over_mask]:
        values = pd.to_numeric(df.loc[idx, available_cols], errors="coerce").fillna(0.0)
        value_sum = values.sum()
        if value_sum <= 0:
            continue
        scaled = (values / value_sum * 100.0).round(1)
        diff = round(100.0 - float(scaled.sum()), 1)
        if abs(diff) > 0:
            max_col = scaled.idxmax()
            scaled[max_col] = round(float(scaled[max_col]) + diff, 1)
        df.loc[idx, available_cols] = scaled.values

    total_after = df[available_cols].sum(axis=1, min_count=1).round(1)
    df[total_col] = total_after
    if other_col:
        df[other_col] = pd.Series(np.nan, index=df.index, dtype="float64")
        has_any = df[available_cols].notna().any(axis=1)
        df.loc[has_any, other_col] = (100.0 - total_after.loc[has_any]).clip(lower=0, upper=100).round(1)

    tlog.record(
        "normalise_pct_block",
        f"Normalised percentage block {available_cols}",
        details={
            "cols": available_cols,
            "rows_over_100_before": int(over_mask.sum()),
            "max_total_before": float(total_before.max()) if total_before.notna().any() else None,
            "max_total_after": float(total_after.max()) if total_after.notna().any() else None,
        },
    )
    return df


def _apply_certificate_i_rules(df_wide: pd.DataFrame, logger, tlog: TransformationLog) -> pd.DataFrame:
    """
    Apply the NCVER structural rule for Certificate I qualifications:
    no target-industry distribution and no course-level median annual income.
    """
    df = df_wide.copy()
    cert1_mask = df["qualification_level"].eq("Certificate I")
    missing_industry_mask = cert1_mask & df[["industry_1", "industry_2", "industry_3"]].isna().all(axis=1)

    if missing_industry_mask.any():
        df.loc[missing_industry_mask, "industry_1"] = FOUNDATION_INDUSTRY_LABEL
        for pct_col in TOP_INDUSTRY_PCT_COLS:
            if pct_col in df.columns:
                df.loc[missing_industry_mask, pct_col] = 0.0
        df.loc[missing_industry_mask, "industry_profile_note"] = "Certificate I foundation/non-vocational pathway"

    structural_income_mask = cert1_mask & df[INCOME_TARGET].isna()
    if "median_annual_income_structural_missing_flag" not in df.columns:
        df["median_annual_income_structural_missing_flag"] = False
    df.loc[structural_income_mask, "median_annual_income_structural_missing_flag"] = True
    df.loc[structural_income_mask, "median_annual_income_value_source"] = "structural_missing_certificate_i"

    logger.info(
        f"Certificate I business rules applied: "
        f"{int(missing_industry_mask.sum())} foundation-industry rows, "
        f"{int(structural_income_mask.sum())} structural income-missing rows"
    )
    tlog.record(
        "apply_certificate_i_rules",
        "Applied Certificate I foundation / structural-missing business rules",
        details={
            "industry_rows_filled": int(missing_industry_mask.sum()),
            "structural_income_missing_rows": int(structural_income_mask.sum()),
        },
    )
    return df


def _initialise_income_tracking_cols(df_wide: pd.DataFrame) -> pd.DataFrame:
    """Add transparent row-level tracking columns for income imputation."""
    df = df_wide.copy()
    df["median_annual_income_original"] = df[INCOME_TARGET]
    df["median_annual_income_imputed_flag"] = False
    df["median_annual_income_value_source"] = "reported"
    df["median_annual_income_imputation_basis"] = pd.Series(pd.NA, index=df.index, dtype="object")
    df["median_annual_income_structural_missing_flag"] = False
    df["median_annual_income_model_prediction"] = pd.Series(np.nan, index=df.index, dtype="float64")
    df["median_annual_income_prediction_clipped_flag"] = pd.Series(False, index=df.index, dtype="boolean")
    return df


def _income_feature_columns(df_wide: pd.DataFrame) -> tuple[list[str], list[str]]:
    """Return the numeric and categorical features available for income modeling."""
    numeric_candidates = [
        "n_respondents",
        "pct_employed_or_study",
        "pct_improved_employment",
        "pct_commenced_further_study",
        "pct_satisfied",
        "occupation_1_pct",
        "occupation_2_pct",
        "occupation_3_pct",
        "industry_1_pct",
        "industry_2_pct",
        "industry_3_pct",
        "occupation_top3_pct_total",
        "occupation_other_pct",
        "industry_top3_pct_total",
    ]
    categorical_candidates = [
        "field_of_education",
        "qualification_level",
        "occupation_1",
        "occupation_2",
        "occupation_3",
        "industry_1",
        "industry_2",
        "industry_3",
    ]
    numeric_cols = [col for col in numeric_candidates if col in df_wide.columns]
    categorical_cols = [col for col in categorical_candidates if col in df_wide.columns]
    return numeric_cols, categorical_cols


def _predict_global_median(train_df: pd.DataFrame, score_df: pd.DataFrame) -> pd.Series:
    """Predict with a single global median baseline."""
    global_median = float(train_df[INCOME_TARGET].median())
    return pd.Series(global_median, index=score_df.index, dtype="float64")


def _predict_qualification_level_median(train_df: pd.DataFrame, score_df: pd.DataFrame) -> pd.Series:
    """Predict with qualification-level medians, backed by the global median."""
    level_medians = train_df.groupby("qualification_level")[INCOME_TARGET].median()
    global_median = float(train_df[INCOME_TARGET].median())
    preds = score_df["qualification_level"].map(level_medians).fillna(global_median)
    return preds.astype("float64")


def _predict_hierarchical_median(train_df: pd.DataFrame, score_df: pd.DataFrame) -> pd.Series:
    """Predict with qualification+field medians, falling back to qualification level."""
    qual_field_medians = (
        train_df.groupby(["qualification_level", "field_of_education"])[INCOME_TARGET]
        .median()
    )
    level_medians = train_df.groupby("qualification_level")[INCOME_TARGET].median()
    global_median = float(train_df[INCOME_TARGET].median())

    preds = (
        score_df[["qualification_level", "field_of_education"]]
        .apply(tuple, axis=1)
        .map(qual_field_medians)
    )
    preds = preds.fillna(score_df["qualification_level"].map(level_medians)).fillna(global_median)
    return preds.astype("float64")


def _build_ridge_income_pipeline(df_wide: pd.DataFrame) -> tuple[Pipeline, list[str]]:
    """Build a reproducible ridge pipeline for salary imputation benchmarking."""
    numeric_cols, categorical_cols = _income_feature_columns(df_wide)
    feature_cols = numeric_cols + categorical_cols
    if not feature_cols:
        raise ValueError("No usable features available for the ridge income model.")

    transformers = []
    if numeric_cols:
        transformers.append(
            (
                "num",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                ]),
                numeric_cols,
            )
        )
    if categorical_cols:
        transformers.append(
            (
                "cat",
                Pipeline([
                    ("imputer", SimpleImputer(strategy="most_frequent")),
                    ("onehot", OneHotEncoder(handle_unknown="ignore")),
                ]),
                categorical_cols,
            )
        )

    preprocessor = ColumnTransformer(transformers=transformers, remainder="drop")

    model = Pipeline([
        ("preprocessor", preprocessor),
        ("ridge", RidgeCV(alphas=INCOME_MODEL_ALPHA_GRID)),
    ])
    return model, feature_cols


def _predict_ridge_regression(train_df: pd.DataFrame, score_df: pd.DataFrame) -> pd.Series:
    """Predict with a regularized linear model fitted on known income rows."""
    model, feature_cols = _build_ridge_income_pipeline(train_df)
    model.fit(train_df[feature_cols], train_df[INCOME_TARGET])
    preds = model.predict(score_df[feature_cols])
    return pd.Series(preds, index=score_df.index, dtype="float64")


def _benchmark_income_models(df_wide: pd.DataFrame, logger, tlog: TransformationLog) -> tuple[pd.DataFrame, dict]:
    """
    Benchmark sensible income-imputation candidates on known non-structural rows
    and choose the most accurate strategy by MAE, then RMSE, then R².
    """
    evaluation_df = df_wide.loc[
        df_wide[INCOME_TARGET].notna()
        & ~df_wide["median_annual_income_structural_missing_flag"].fillna(False)
    ].copy()
    if len(evaluation_df) < 10:
        report = pd.DataFrame([{
            "model_name": "hierarchical_median",
            "status": "selected_fallback_small_sample",
            "mae": np.nan,
            "rmse": np.nan,
            "r2": np.nan,
            "folds": 0,
        }])
        selected = report.iloc[0].to_dict()
        tlog.record(
            "benchmark_income_models",
            "Skipped model benchmarking due to insufficient known salary rows",
            details={"n_rows": int(len(evaluation_df)), "selected_model": "hierarchical_median"},
        )
        return report, selected

    candidate_specs = [
        ("ridge_regression", _predict_ridge_regression),
        ("hierarchical_median", _predict_hierarchical_median),
        ("qualification_level_median", _predict_qualification_level_median),
        ("global_median", _predict_global_median),
    ]

    n_splits = min(INCOME_MODEL_N_SPLITS, len(evaluation_df))
    if n_splits < 2:
        n_splits = 2
    kfold = KFold(n_splits=n_splits, shuffle=True, random_state=INCOME_MODEL_RANDOM_STATE)

    results = []
    for model_name, predictor in candidate_specs:
        y_true_all = []
        y_pred_all = []
        status = "ok"
        error_message = None
        try:
            for train_idx, test_idx in kfold.split(evaluation_df):
                train_df = evaluation_df.iloc[train_idx].copy()
                test_df = evaluation_df.iloc[test_idx].copy()
                preds = predictor(train_df, test_df)
                preds = pd.to_numeric(preds, errors="coerce").fillna(train_df[INCOME_TARGET].median())
                preds = preds.clip(lower=0)
                y_true_all.extend(test_df[INCOME_TARGET].astype(float).tolist())
                y_pred_all.extend(preds.astype(float).tolist())
        except Exception as exc:
            status = "error"
            error_message = str(exc)

        if status == "ok":
            y_true = np.asarray(y_true_all, dtype=float)
            y_pred = np.asarray(y_pred_all, dtype=float)
            mse = mean_squared_error(y_true, y_pred)
            results.append({
                "model_name": model_name,
                "status": status,
                "mae": float(mean_absolute_error(y_true, y_pred)),
                "rmse": float(np.sqrt(mse)),
                "r2": float(r2_score(y_true, y_pred)),
                "folds": n_splits,
                "error_message": error_message,
            })
        else:
            logger.warning(f"Income model candidate '{model_name}' failed during benchmarking: {error_message}")
            results.append({
                "model_name": model_name,
                "status": status,
                "mae": np.nan,
                "rmse": np.nan,
                "r2": np.nan,
                "folds": n_splits,
                "error_message": error_message,
            })

    report = pd.DataFrame(results)
    valid = report[report["status"] == "ok"].copy()
    valid = valid.sort_values(["mae", "rmse", "r2"], ascending=[True, True, False], kind="stable")
    if valid.empty:
        selected = {
            "model_name": "hierarchical_median",
            "status": "selected_fallback_all_candidates_failed",
            "mae": np.nan,
            "rmse": np.nan,
            "r2": np.nan,
            "folds": n_splits,
            "error_message": "All benchmark candidates failed; falling back to hierarchical median.",
        }
    else:
        selected = valid.iloc[0].to_dict()

    logger.info(
        f"Income model selection: {selected['model_name']} "
        f"(MAE={selected['mae'] if pd.notna(selected['mae']) else 'n/a'}, "
        f"RMSE={selected['rmse'] if pd.notna(selected['rmse']) else 'n/a'}, "
        f"R2={selected['r2'] if pd.notna(selected['r2']) else 'n/a'})"
    )
    tlog.record(
        "benchmark_income_models",
        "Benchmarked candidate income-imputation strategies on known salary rows",
        details={
            "n_rows_evaluated": int(len(evaluation_df)),
            "n_splits": int(n_splits),
            "selected_model": selected["model_name"],
            "selected_mae": selected["mae"],
            "selected_rmse": selected["rmse"],
            "selected_r2": selected["r2"],
            "candidate_results": report.to_dict(orient="records"),
        },
    )
    return report, selected


def _save_income_model_report(report: pd.DataFrame, selected: dict, logger, tlog: TransformationLog) -> tuple[Path, Path]:
    """Persist benchmark results so every run is reproducible and reviewable."""
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = LOG_DIR / f"vet_outcomes_income_model_benchmark_{stamp}.csv"
    json_path = LOG_DIR / f"vet_outcomes_income_model_benchmark_{stamp}.json"
    report.to_csv(csv_path, index=False)
    json_path.write_text(
        json.dumps(
            {
                "selected_model": selected["model_name"],
                "selected_metrics": {
                    "mae": selected.get("mae"),
                    "rmse": selected.get("rmse"),
                    "r2": selected.get("r2"),
                    "folds": selected.get("folds"),
                },
                "candidates": report.to_dict(orient="records"),
            },
            indent=2,
            default=str,
        ),
        encoding="utf-8",
    )
    logger.info(f"Income benchmark report saved → {csv_path}")
    tlog.record(
        "save_income_model_report",
        "Saved VET income model benchmark artifacts",
        details={"csv_path": str(csv_path), "json_path": str(json_path)},
    )
    return csv_path, json_path


def _apply_income_imputation_strategy(
    df_wide: pd.DataFrame,
    selected_model: str,
    logger,
    tlog: TransformationLog,
) -> pd.DataFrame:
    """Impute non-structural missing incomes with the selected benchmark winner."""
    predictor_map = {
        "ridge_regression": _predict_ridge_regression,
        "hierarchical_median": _predict_hierarchical_median,
        "qualification_level_median": _predict_qualification_level_median,
        "global_median": _predict_global_median,
    }
    predictor = predictor_map.get(selected_model, _predict_hierarchical_median)

    df = df_wide.copy()
    structural_mask = df["median_annual_income_structural_missing_flag"].fillna(False)
    missing_mask = df[INCOME_TARGET].isna() & ~structural_mask
    if not missing_mask.any():
        return df

    reference_rows = df.loc[df[INCOME_TARGET].notna() & ~structural_mask].copy()
    raw_preds = predictor(reference_rows, df.loc[missing_mask].copy())
    raw_preds = pd.to_numeric(raw_preds, errors="coerce").fillna(reference_rows[INCOME_TARGET].median()).round(2)
    clipped_mask = raw_preds.lt(0)
    clipped_preds = raw_preds.clip(lower=0)
    final_preds = _round_currency_series(clipped_preds)

    df.loc[missing_mask, "median_annual_income_model_prediction"] = raw_preds.to_numpy()
    df.loc[missing_mask, INCOME_TARGET] = final_preds.to_numpy()
    df.loc[missing_mask, "median_annual_income_imputed_flag"] = True
    df.loc[missing_mask, "median_annual_income_value_source"] = "imputed_selected_model"
    df.loc[missing_mask, "median_annual_income_imputation_basis"] = selected_model
    df.loc[missing_mask, "median_annual_income_prediction_clipped_flag"] = clipped_mask.to_numpy()

    tlog.record(
        "apply_income_imputation_strategy",
        "Imputed non-structural missing VET incomes with the selected benchmark winner",
        details={
            "selected_model": selected_model,
            "n_imputed_rows": int(missing_mask.sum()),
            "n_negative_predictions_clipped": int(clipped_mask.sum()),
        },
    )
    return df


def run():
    logger = get_logger(DATASET, LOG_DIR)
    tlog   = TransformationLog(DATASET)
    src    = RAW_FILES[DATASET]

    cfg = VET_OUTCOMES_CFG

    # ── 1. DISCOVER ──────────────────────────────────────────────────────────
    logger.info("=== STEP 1: DISCOVER ===")
    raw_preview = pd.read_excel(src, sheet_name=cfg["sheet"],
                                header=None, nrows=10, engine="openpyxl")
    run_profile(raw_preview, f"[RAW] {DATASET} — header rows",
                PROFILE_DIR / f"raw_{DATASET}.html",
                minimal=PROFILE_SETTINGS["minimal"])

    # ── 2. STRUCTURE — multi-row header handling ───────────────────────────
    logger.info("=== STEP 2: STRUCTURE — resolve multi-row header ===")
    # Row index 3 (0-based) is the actual header row
    df_raw = pd.read_excel(
        src,
        sheet_name=cfg["sheet"],
        header=cfg["header_row"] - 1,   # pandas header= is 0-indexed
        engine="openpyxl",
    )

    # Drop the first 0 data rows which may be sub-headers
    df_raw = df_raw[df_raw.iloc[:, 0].astype(str).str.strip() != "Program ID"].copy()
    logger.info(f"Raw shape after header parse: {df_raw.shape}")
    tlog.record("load", "Read Estimates sheet with header=row4", rows_after=len(df_raw))

    # ── 3. CLEAN — wide table ───────────────────────────────────────────────
    logger.info("=== STEP 3: CLEAN ===")

    # Rename known columns
    df = clean_headers(df_raw, rename_map=VET_OUTCOMES_RENAME)
    df = _rename_pair_pct_cols(df, "occupation")
    df = _rename_pair_pct_cols(df, "industry")

    # Drop near-empty rows/cols
    df = drop_empty_rows_cols(df, logger, tlog, empty_threshold=0.90)

    # Drop rows with no program_id
    df = drop_rows_missing_key(df, ["program_id"], logger, tlog)

    # Cast numeric outcome columns — only columns that are actually numeric-ish
    numeric_cols = [
        c for c in df.columns
        if (
            c.endswith("_pct")
            or any(x in c for x in ("pct_", "n_respondents", "median_annual_income"))
        )
    ]
    df = cast_numeric_cols(df, numeric_cols, logger, tlog)

    # Standardise text — only on object/string dtype columns
    for txt_col in ["program_name", "field_of_education", "qualification_level"]:
        if txt_col in df.columns and df[txt_col].dtype == object:
            df = standardise_text_col(df, txt_col, case="title")

    label_cols = [
        c for c in df.columns
        if (
            c.startswith("occupation_") or c.startswith("industry_")
        ) and not c.endswith("_pct")
    ]
    for txt_col in label_cols:
        if txt_col in df.columns and df[txt_col].dtype == object:
            df = standardise_text_col(df, txt_col, case="title")

    # Deduplicate on program_id
    df = remove_duplicates(df, subset=["program_id"], logger=logger, tlog=tlog)

    # Business rules first, then benchmark candidate imputers on eligible rows
    df = _initialise_income_tracking_cols(df)
    df = _apply_certificate_i_rules(df, logger, tlog)
    df = _normalise_pct_block(
        df,
        TOP_OCCUPATION_PCT_COLS,
        total_col="occupation_top3_pct_total",
        flag_col="occupation_pct_normalized_flag",
        tlog=tlog,
        other_col="occupation_other_pct",
    )
    df = _normalise_pct_block(
        df,
        TOP_INDUSTRY_PCT_COLS,
        total_col="industry_top3_pct_total",
        flag_col="industry_pct_normalized_flag",
        tlog=tlog,
    )
    income_model_report, selected_income_model = _benchmark_income_models(df, logger, tlog)
    _save_income_model_report(income_model_report, selected_income_model, logger, tlog)
    df = _apply_income_imputation_strategy(df, selected_income_model["model_name"], logger, tlog)

    # Flag outlier incomes on final reported + imputed values
    if "median_annual_income" in df.columns:
        df = flag_outliers_iqr(df, "median_annual_income",
                               k=3.0, logger=logger, tlog=tlog)
        structural_mask = df["median_annual_income_structural_missing_flag"].fillna(False)
        imputed_mask = df["median_annual_income_imputed_flag"].fillna(False)
        outlier_mask = structural_mask | imputed_mask
        if "median_annual_income_outlier_flag" in df.columns:
            df.loc[outlier_mask, "median_annual_income_outlier_flag"] = False
            df["median_annual_income_outlier_flag"] = (
                df["median_annual_income_outlier_flag"].fillna(False).astype("boolean")
            )

    # ── 4. STRUCTURE — reshape occupation / industry to long ───────────────
    logger.info("=== STEP 4: STRUCTURE — reshape occ/industry to long ===")

    df_occ = _build_occupation_columns(df)
    df_ind = _build_industry_columns(df)

    # ── 5. ENRICH — map occupation labels to ANZSCO major group ───────────
    logger.info("=== STEP 5: ENRICH — add ANZSCO major group codes ===")

    if not df_occ.empty:
        major_group_lookup = (
            pd.DataFrame(
                {
                    "major_group_label": list(ANZSCO_MAJOR_GROUP_MAP.keys()),
                    "major_group_code": list(ANZSCO_MAJOR_GROUP_MAP.values()),
                }
            )
            .assign(normalised_label=lambda d: normalise_anzsco_title_series(d["major_group_label"]))
            .drop_duplicates("normalised_label")
            .set_index("normalised_label")
        )
        occ_norm = normalise_anzsco_title_series(df_occ["occupation_label"])
        df_occ["anzsco_major_group_code"] = occ_norm.map(major_group_lookup["major_group_code"]).astype("Int64")
        df_occ["anzsco_major_group_label"] = df_occ["anzsco_major_group_code"].map(ANZSCO_MAJOR_GROUP_LABELS)
        df_occ["anzsco_major_group_label"] = df_occ["anzsco_major_group_label"].fillna(df_occ["occupation_label"])
        match_rate = df_occ["anzsco_major_group_code"].notna().mean()
        logger.info(f"ANZSCO major group match rate: {match_rate:.1%}")
        tlog.record("enrich_major_group",
                    "Mapped occupation labels to ANZSCO 1-digit major group codes",
                    details={"match_rate": float(match_rate)})

    # ── 6. VALIDATE ──────────────────────────────────────────────────────────
    logger.info("=== STEP 6: VALIDATE ===")
    report_missing(df, logger)
    issues = validate_dataset(df, VALIDATION_RULES.get(DATASET, {}), DATASET, logger)
    tlog.record("validate", f"{len(issues)} issues", details={"issues": issues})

    # ── 7. PROFILE ───────────────────────────────────────────────────────────
    logger.info("=== STEP 7: PROFILE cleaned data ===")
    run_profile(df, f"[CLEAN] {DATASET} — wide",
                PROFILE_DIR / f"clean_{DATASET}_wide.html",
                minimal=PROFILE_SETTINGS["minimal"])
    if not df_occ.empty:
        run_profile(df_occ, f"[CLEAN] {DATASET} — occupations long",
                    PROFILE_DIR / f"clean_{DATASET}_occ_long.html",
                    minimal=PROFILE_SETTINGS["minimal"])

    # ── 8. PUBLISH — save wide as primary silver file ─────────────────────
    logger.info("=== STEP 8: PUBLISH ===")
    logger.info(f"Wide final shape: {df.shape}")
    save_parquet(df, SILVER_FILES[DATASET], logger, tlog)

    # Also save long occupation table as supplementary silver
    if not df_occ.empty:
        occ_path = SILVER_FILES[DATASET].parent / "clean_vet_outcomes_occ_long.parquet"
        save_parquet(df_occ, occ_path, logger, tlog)

    if not df_ind.empty:
        ind_path = SILVER_FILES[DATASET].parent / "clean_vet_outcomes_ind_long.parquet"
        save_parquet(df_ind, ind_path, logger, tlog)

    audit_path = tlog.save(LOG_DIR)
    logger.info(f"Audit log → {audit_path}")
    return df


if __name__ == "__main__":
    run()

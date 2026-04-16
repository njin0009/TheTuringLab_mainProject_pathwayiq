"""
05_clean_vnda.py — VET National Data Asset Graduate Outcomes 2020-21
=====================================================================
Input : TA28_DG_RawData_VNDA_GraduateOutcomes_2020-21_IT1_20260330.xlsx
Output:
  - silver/clean_vnda.parquet                  (course metrics; 1 row = 1 course)
  - silver/clean_vnda_course_metrics.parquet   (alias of clean_vnda.parquet)
  - silver/clean_vnda_course_occupations.parquet
  - silver/clean_vnda_qual_by_occ.parquet      (backward-compatible alias)
  - silver/clean_vnda_{national,state,aqf,aqf_foe_national,aqf_foe_state}.parquet

Best-practice design:
- Sheet 6 is the primary fact table, so clean_vnda is now one row per COURSE_ID.
- Sheet 7 is the long occupation bridge table and is kept separate.
- Sheets 1–5 are preserved as separate aggregate outputs instead of being
  stacked into one mixed-grain sparse dataset.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import re

import pandas as pd

from config import (
    RAW_FILES, SILVER_FILES, PROFILE_DIR, LOG_DIR,
    VNDA_SHEETS_CFG, VNDA_RENAME, VALIDATION_RULES,
    PROFILE_SETTINGS, FUZZY_MATCH_THRESHOLD,
)
from utils.wrangling_utils import (
    get_logger, TransformationLog,
    run_profile, clean_headers, remove_duplicates,
    report_missing, validate_dataset, save_parquet,
    standardise_text_col, drop_rows_missing_key, flag_outliers_iqr,
    read_excel_with_dynamic_header, build_anzsco_lookup,
    exact_match_anzsco, fuzzy_match_anzsco, merge_anzsco_cols,
    normalise_anzsco_title_series,
)

DATASET = "vnda"

COURSE_METRICS_HEADER_ROW = 8
COURSE_OCCUPATIONS_HEADER_ROW = 6
AGGREGATE_KEYS = {
    "national": ["cohort_group", "cohort"],
    "state": ["state"],
    "aqf": ["jurisdiction", "aqf_level"],
    "aqf_foe_nat": ["aqf_foe", "aqf_level", "foe"],
    "aqf_foe_state": ["state", "aqf_level", "foe", "aqf_foe"],
}
AGGREGATE_OUTPUT_NAMES = {
    "national": "clean_vnda_national.parquet",
    "state": "clean_vnda_state.parquet",
    "aqf": "clean_vnda_aqf.parquet",
    "aqf_foe_nat": "clean_vnda_aqf_foe_national.parquet",
    "aqf_foe_state": "clean_vnda_aqf_foe_state.parquet",
}
INCOME_COLS = [
    "median_income", "median_income_change",
    "median_income_total", "median_income_total_change",
    "total_ft_median_income", "total_ft_median_income_change",
]
TOP_OCC_TITLE_PATTERN = re.compile(r"^occupation_title_no_\d+$")
TOP_OCC_SHARE_PATTERN = re.compile(r"^no_\d+_share$")
ROW_EMPTY_THRESHOLD = 0.98
STRUCTURAL_ROW_PATTERN = re.compile(r"^\s*(?:source:|notes?:|person level integrated data asset)", re.I)


def _drop_all_empty(df: pd.DataFrame) -> pd.DataFrame:
    """Drop only fully empty rows/columns; avoid removing sparse valid rows."""
    return df.dropna(axis=0, how="all").dropna(axis=1, how="all")


def _normalise_source_specific_headers(df: pd.DataFrame) -> pd.DataFrame:
    """Apply post-header cleanup that depends on the cleaned names."""
    rename_map = {}
    if "regional" in df.columns and "pct_regional" not in df.columns:
        rename_map["regional"] = "pct_regional"
    if "ranking" in df.columns and "course_rank" not in df.columns:
        rename_map["ranking"] = "course_rank"
    if rename_map:
        df = df.rename(columns=rename_map)
    return df


def _infer_numeric_cols(df: pd.DataFrame, text_cols: set[str]) -> list[str]:
    """Infer numeric VNDA columns based on name patterns and known metric names."""
    numeric_cols = []
    for col in df.columns:
        if col in text_cols:
            continue
        if (
            col.startswith(("pct_", "median_", "count_", "total_ft_"))
            or col.startswith(("pptchange_", "pctpt_", "no_"))
            or col.endswith(("_rate", "_days", "_yrs"))
            or col in {
                "pct_total", "course_rank", "small_count_flag", "income_support_exit_rate",
                "count_of_unique_occupations", "no_of_different_occupations",
            }
        ):
            numeric_cols.append(col)
    return [col for col in numeric_cols if col in df.columns]


def _attach_suppression_summary(df: pd.DataFrame, raw_numeric_cols: list[str]) -> pd.DataFrame:
    """
    Preserve workbook suppression information before numeric casting.
    Asterisks are row-summarised so downstream users can see that raw source
    values were suppressed/high-error even after numeric coercion.
    """
    if not raw_numeric_cols:
        df["suppressed_value_count"] = pd.Series(0, index=df.index, dtype="Int64")
        df["has_suppressed_values"] = pd.Series(False, index=df.index, dtype="boolean")
        return df

    raw_numeric = df[raw_numeric_cols].astype("string").fillna("")
    star_mask = raw_numeric.apply(lambda col: col.str.contains("*", regex=False))
    suppressed_count = star_mask.sum(axis=1).astype("Int64")
    df["suppressed_value_count"] = suppressed_count
    df["has_suppressed_values"] = suppressed_count.gt(0).astype("boolean")
    return df


def _standardise_text_cols(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    """Standardise a list of text columns if present."""
    for col in cols:
        if col in df.columns:
            case = "none" if col == "source_sheet" else "title"
            df = standardise_text_col(df, col, case=case)
    return df


def _drop_structural_vnda_rows(df: pd.DataFrame, logger, tlog: TransformationLog) -> pd.DataFrame:
    """Drop note/source rows that leak through the workbook header parsing."""
    text_cols = [
        col for col in df.columns
        if pd.api.types.is_object_dtype(df[col]) or pd.api.types.is_string_dtype(df[col])
    ]
    if not text_cols:
        return df

    mask = pd.Series(False, index=df.index)
    for col in text_cols:
        mask = mask | df[col].astype("string").str.strip().str.contains(STRUCTURAL_ROW_PATTERN, na=False)

    removed = int(mask.sum())
    if not removed:
        return df

    logger.warning(f"Removed {removed} structural VNDA note/source rows")
    tlog.record(
        "drop_structural_rows",
        "Dropped structural note/source rows from VNDA outputs",
        rows_before=int(len(df)),
        rows_after=int(len(df) - removed),
        details={"removed_rows": removed, "text_columns_scanned": text_cols},
    )
    return df.loc[~mask].copy()


def _coerce_vnda_numeric_series(series: pd.Series) -> pd.Series:
    """
    Coerce NCVER numeric cells while preserving workbook meaning.
    '-' is treated as zero, 'np' remains missing, and '*' is stripped after
    suppression summary has already been captured.
    """
    cleaned = (
        series.astype("string")
        .str.strip()
        .str.replace(",", "", regex=False)
        .str.replace("*", "", regex=False)
        .str.replace("–", "-", regex=False)
        .str.lower()
    )
    cleaned = cleaned.replace({"-": "0", "np": pd.NA, "na": pd.NA, "n/a": pd.NA, "": pd.NA})
    return pd.to_numeric(cleaned, errors="coerce")


def _cast_vnda_numeric_cols(
    df: pd.DataFrame,
    cols: list[str],
    logger,
    tlog: TransformationLog,
) -> pd.DataFrame:
    """VNDA-specific numeric casting with explicit NCVER sentinel handling."""
    for col in cols:
        if col not in df.columns:
            continue
        before_nulls = int(df[col].isna().sum())
        dash_count = int(
            df[col]
            .astype("string")
            .str.strip()
            .str.replace("–", "-", regex=False)
            .eq("-")
            .sum()
        )
        df[col] = _coerce_vnda_numeric_series(df[col])
        after_nulls = int(df[col].isna().sum())
        coerced = after_nulls - before_nulls
        if coerced or dash_count:
            logger.info(
                f"cast_numeric_vnda: '{col}' — {coerced} values coerced to NaN, "
                f"{dash_count} dash sentinels mapped to 0"
            )
        tlog.record(
            "cast_numeric_vnda",
            f"Cast '{col}' to numeric with NCVER-specific sentinel handling",
            details={"col": col, "new_nulls": coerced, "dash_zero_count": dash_count},
        )
    return df


def _convert_small_count_flag(df: pd.DataFrame) -> pd.DataFrame:
    """Convert 0/1 small-count markers to nullable booleans."""
    if "small_count_flag" not in df.columns:
        return df
    flag = pd.to_numeric(df["small_count_flag"], errors="coerce")
    df["small_count_flag"] = flag.map({0.0: False, 1.0: True}).astype("boolean")
    return df


def _flag_income_outliers(df: pd.DataFrame, logger, tlog) -> pd.DataFrame:
    """Flag IQR outliers on all present income columns."""
    for col in [c for c in INCOME_COLS if c in df.columns]:
        df = flag_outliers_iqr(df, col, k=3.5, logger=logger, tlog=tlog)
    return df


def _build_anzsco_lookup_frame():
    """Load the best available ANZSCO reference for occupation enrichment."""
    if SILVER_FILES.get("anzsco_reference") and SILVER_FILES["anzsco_reference"].exists():
        return pd.read_parquet(SILVER_FILES["anzsco_reference"])
    if SILVER_FILES["osl_full"].exists():
        ref = pd.read_parquet(SILVER_FILES["osl_full"])
        if "classification_system" in ref.columns:
            ref = ref[ref["classification_system"] == "ANZSCO_2022"].copy()
        return ref
    return pd.read_parquet(SILVER_FILES["osl_filtered"])


def _clean_aggregate_sheet(src, sheet_key, logger, tlog):
    """Clean one aggregate VNDA sheet without mixing it with other grains."""
    cfg = VNDA_SHEETS_CFG[sheet_key]
    df = read_excel_with_dynamic_header(
        src,
        sheet_name=cfg["sheet"],
        anchor=cfg["header_anchor"],
        skiprows_fallback=8,
    )
    df = _drop_all_empty(df)
    df = clean_headers(df, rename_map=VNDA_RENAME)
    df = _normalise_source_specific_headers(df)
    df = _drop_structural_vnda_rows(df, logger, tlog)
    df["source_sheet"] = sheet_key

    key_cols = [col for col in AGGREGATE_KEYS[sheet_key] if col in df.columns]
    df = drop_rows_missing_key(df, key_cols, logger, tlog)

    drop_cols = [
        col for col in df.columns
        if TOP_OCC_TITLE_PATTERN.match(col) or TOP_OCC_SHARE_PATTERN.match(col)
    ]
    if drop_cols:
        df = df.drop(columns=drop_cols)

    text_cols = set(key_cols + ["source_sheet"])
    df = _standardise_text_cols(df, sorted(text_cols))

    numeric_cols = _infer_numeric_cols(df, text_cols=text_cols)
    df = _attach_suppression_summary(df, numeric_cols)
    df = _cast_vnda_numeric_cols(df, numeric_cols, logger, tlog)
    df = _convert_small_count_flag(df)
    df = _flag_income_outliers(df, logger, tlog)
    df = remove_duplicates(df, subset=key_cols, logger=logger, tlog=tlog)
    return df


def _clean_course_metrics(src, logger, tlog):
    """Clean Sheet 6 into one-row-per-course metrics."""
    raw = pd.read_excel(
        src,
        sheet_name=VNDA_SHEETS_CFG["qualification"]["sheet"],
        header=COURSE_METRICS_HEADER_ROW,
        engine="openpyxl",
    )
    df = _drop_all_empty(raw)
    df = clean_headers(df, rename_map=VNDA_RENAME)
    df = _normalise_source_specific_headers(df)
    df = _drop_structural_vnda_rows(df, logger, tlog)
    df["source_sheet"] = "qualification"
    df = drop_rows_missing_key(df, ["course_id"], logger, tlog)

    wide_occ_cols = [
        col for col in df.columns
        if TOP_OCC_TITLE_PATTERN.match(col) or TOP_OCC_SHARE_PATTERN.match(col)
    ]

    keep_cols = [col for col in df.columns if col not in wide_occ_cols]
    df = df[keep_cols].copy()

    text_cols = {"course_id", "course_name", "aqf_level", "foe", "source_sheet"}

    df = _standardise_text_cols(df, ["course_name", "aqf_level", "foe", "source_sheet"])
    df["course_id"] = df["course_id"].astype("string").str.strip()

    numeric_cols = _infer_numeric_cols(df, text_cols=text_cols)
    df = _attach_suppression_summary(df, numeric_cols)
    df = _cast_vnda_numeric_cols(df, numeric_cols, logger, tlog)
    df = _convert_small_count_flag(df)

    if "course_rank" in df.columns:
        df["course_rank"] = pd.to_numeric(df["course_rank"], errors="coerce").astype("Int64")
    if "count_of_unique_occupations" in df.columns:
        df["count_of_unique_occupations"] = (
            pd.to_numeric(df["count_of_unique_occupations"], errors="coerce").astype("Int64")
        )

    df = _flag_income_outliers(df, logger, tlog)
    df = remove_duplicates(df, subset=["course_id"], logger=logger, tlog=tlog)
    return df


def _clean_course_occupations(src, logger, tlog):
    """Clean Sheet 7 into a long course-to-occupation bridge table."""
    raw = pd.read_excel(
        src,
        sheet_name=VNDA_SHEETS_CFG["qual_by_occ"]["sheet"],
        header=COURSE_OCCUPATIONS_HEADER_ROW,
        engine="openpyxl",
    )
    df = _drop_all_empty(raw)
    df = clean_headers(
        df,
        rename_map={
            "COURSE_ID": "course_id",
            "Course name": "course_name",
            "Occupation name": "occupation_name",
            "Percentage share %": "pct_share",
        },
    )
    df = _drop_structural_vnda_rows(df, logger, tlog)
    df["source_sheet"] = "qual_by_occ"
    df = drop_rows_missing_key(df, ["course_id", "occupation_name"], logger, tlog)
    df = _standardise_text_cols(df, ["course_name", "occupation_name", "source_sheet"])
    df["course_id"] = df["course_id"].astype("string").str.strip()
    df["pct_share"] = _coerce_vnda_numeric_series(df["pct_share"])
    df = remove_duplicates(df, subset=["course_id", "occupation_name"], logger=logger, tlog=tlog)

    lookup = build_anzsco_lookup(_build_anzsco_lookup_frame())
    df = exact_match_anzsco(df, "occupation_name", lookup, logger, tlog)
    df = fuzzy_match_anzsco(df, "occupation_name", lookup, FUZZY_MATCH_THRESHOLD, logger, tlog)
    df = merge_anzsco_cols(df, logger, tlog)

    occ_norm = normalise_anzsco_title_series(df["occupation_name"])
    df["anzsco_match_status"] = "unmatched"
    df.loc[occ_norm.eq("unknown"), "anzsco_match_status"] = "unknown_occupation"
    df.loc[occ_norm.fillna("").str.contains(r"\bnfd\b", regex=True), "anzsco_match_status"] = "not_further_defined"
    df.loc[df["anzsco_code"].notna(), "anzsco_match_status"] = "matched"
    if "anzsco_match_method" in df.columns:
        df.loc[df["anzsco_match_method"] == "exact", "anzsco_match_status"] = "matched_exact"
        df.loc[df["anzsco_match_method"] == "fuzzy", "anzsco_match_status"] = "matched_fuzzy"

    df = df.sort_values(
        ["course_id", "pct_share", "occupation_name"],
        ascending=[True, False, True],
        kind="stable",
    ).reset_index(drop=True)
    df["course_occupation_rank"] = df.groupby("course_id").cumcount().add(1).astype("Int64")
    return df


def _supplementary_output_paths(output_dir: Path) -> dict[str, Path]:
    """Build paths for VNDA supplementary relational outputs."""
    paths = {
        "course_metrics": output_dir / "clean_vnda_course_metrics.parquet",
        "course_occupations": output_dir / "clean_vnda_course_occupations.parquet",
        "qual_by_occ_alias": output_dir / "clean_vnda_qual_by_occ.parquet",
    }
    for key, filename in AGGREGATE_OUTPUT_NAMES.items():
        paths[key] = output_dir / filename
    return paths


def run():
    logger = get_logger(DATASET, LOG_DIR)
    tlog = TransformationLog(DATASET)
    src = RAW_FILES[DATASET]

    # ── 1. DISCOVER ──────────────────────────────────────────────────────────
    logger.info("=== STEP 1: DISCOVER ===")
    raw_preview = pd.read_excel(
        src,
        sheet_name=VNDA_SHEETS_CFG["qualification"]["sheet"],
        header=None,
        nrows=14,
        engine="openpyxl",
    )
    run_profile(
        raw_preview,
        f"[RAW] {DATASET} — qualification preview",
        PROFILE_DIR / f"raw_{DATASET}.html",
        minimal=PROFILE_SETTINGS["minimal"],
    )

    # ── 2. STRUCTURE + CLEAN — relational outputs by grain ─────────────────
    logger.info("=== STEP 2: CLEAN — course metrics, occupations, and aggregate views ===")
    df_course_metrics = _clean_course_metrics(src, logger, tlog)
    df_course_occupations = _clean_course_occupations(src, logger, tlog)

    aggregate_frames = {}
    for sheet_key in AGGREGATE_KEYS:
        aggregate_frames[sheet_key] = _clean_aggregate_sheet(src, sheet_key, logger, tlog)

    # ── 3. VALIDATE ──────────────────────────────────────────────────────────
    logger.info("=== STEP 3: VALIDATE ===")
    report_missing(df_course_metrics, logger)
    issues = validate_dataset(
        df_course_metrics,
        VALIDATION_RULES.get(DATASET, {}),
        DATASET,
        logger,
    )
    tlog.record("validate", f"{len(issues)} issues", details={"issues": issues})

    # ── 4. PROFILE ───────────────────────────────────────────────────────────
    logger.info("=== STEP 4: PROFILE ===")
    run_profile(
        df_course_metrics,
        f"[CLEAN] {DATASET} — course metrics",
        PROFILE_DIR / f"clean_{DATASET}.html",
        minimal=PROFILE_SETTINGS["minimal"],
    )
    run_profile(
        df_course_occupations,
        f"[CLEAN] {DATASET} — course occupations",
        PROFILE_DIR / f"clean_{DATASET}_course_occupations.html",
        minimal=PROFILE_SETTINGS["minimal"],
    )

    # ── 5. PUBLISH ───────────────────────────────────────────────────────────
    logger.info("=== STEP 5: PUBLISH ===")
    output_dir = SILVER_FILES[DATASET].parent
    extra_paths = _supplementary_output_paths(output_dir)

    logger.info(
        f"Course metrics shape: {df_course_metrics.shape} "
        f"(unique courses={df_course_metrics['course_id'].nunique()})"
    )
    save_parquet(df_course_metrics, SILVER_FILES[DATASET], logger, tlog)
    save_parquet(df_course_metrics, extra_paths["course_metrics"], logger, tlog)

    logger.info(
        f"Course occupations shape: {df_course_occupations.shape} "
        f"(courses={df_course_occupations['course_id'].nunique()})"
    )
    save_parquet(df_course_occupations, extra_paths["course_occupations"], logger, tlog)
    save_parquet(df_course_occupations, extra_paths["qual_by_occ_alias"], logger, tlog)

    for sheet_key, df_sheet in aggregate_frames.items():
        logger.info(f"Aggregate view '{sheet_key}' shape: {df_sheet.shape}")
        save_parquet(df_sheet, extra_paths[sheet_key], logger, tlog)

    audit_path = tlog.save(LOG_DIR)
    logger.info(f"Audit log → {audit_path}")
    return df_course_metrics


if __name__ == "__main__":
    run()

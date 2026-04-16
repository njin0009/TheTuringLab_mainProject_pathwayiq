"""
06_clean_seuv.py — Survey of Employers' Use and Views of VET 2025
=================================================================
Input : TA28_DG_RawData_SEUV2025_DataTables_IT1_20260330.xlsx
Output: silver/clean_seuv.parquet

SEUV mixes several workbook layouts:
  - historical timeseries by year
  - historical matrices with repeated years and sub-categories
  - single-year AI tables introduced in 2025
  - interview-count tables rather than percentage tables

This script parses each sheet into a generic tidy matrix:
  table_id, slice_section, metric_label, measure_label, survey_year, value, value_unit
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import re
import pandas as pd
import numpy as np

from config import (
    RAW_FILES, SILVER_FILES, PROFILE_DIR, LOG_DIR,
    SEUV_TABLES_CFG, PROFILE_SETTINGS,
)
from utils.wrangling_utils import (
    get_logger, TransformationLog,
    run_profile, remove_duplicates, report_missing,
    validate_dataset, save_parquet, standardise_text_col,
    coerce_numeric_series,
)

DATASET = "seuv"

AI_TABLES = {f"Table {i}" for i in range(21, 29)}
SKIP_LABELS = {
    "back to index", "back to contents", "notes on tables",
    "95% margin of error",
}
VALUE_STATUS_ORDER = {
    "reported": 0,
    "not_publishable": 1,
    "not_available": 2,
    "missing": 3,
    "blank": 4,
}
SLICE_DATASET_MAP = {
    "Overall": "overall",
    "State/Territory": "state_territory",
    "Employer size": "employer_size",
    "Industry": "industry",
    "Training choices": "training_type",
    "Accredited training": "training_type",
    "Unaccredited training": "training_type",
    "Satisfaction with training": "training_type",
}


def _raw_cell_text(value):
    if pd.isna(value):
        return None
    return str(value).replace("\xa0", " ")


def _clean_text(value):
    raw = _raw_cell_text(value)
    if raw is None:
        return None
    text = re.sub(r"\s+", " ", raw).strip()
    return text or None


def _is_year(value):
    text = _clean_text(value)
    return bool(text and re.fullmatch(r"20\d{2}(?:\.0)?", text))


def _is_numeric_like(value):
    text = _clean_text(value)
    if not text:
        return False
    if text.lower() in {"na", "np", "n/a", "n.a.", "-", "–", "..."}:
        return True
    return pd.notna(coerce_numeric_series(pd.Series([text])).iloc[0])


def _normalise_part(text):
    text = _clean_text(text)
    if not text:
        return None
    lower = text.lower()
    if lower in SKIP_LABELS or lower == "%":
        return None
    if lower.startswith("source:"):
        return None
    return text


def _combine_parts(parts):
    seen = []
    for part in parts:
        part = _normalise_part(part)
        if part and part not in seen:
            seen.append(part)
    return " | ".join(seen) if seen else None


def _find_year_row(raw):
    for idx, row in raw.iterrows():
        if sum(_is_year(v) for v in row.tolist()) >= 3:
            return idx
    return None


def _find_first_data_row(raw, label_col_idx, start_row):
    for idx in range(start_row, len(raw)):
        row_values = raw.iloc[idx].tolist()
        if sum(_is_year(v) for v in row_values) >= 2:
            continue
        label = _clean_text(raw.iat[idx, label_col_idx]) if label_col_idx < raw.shape[1] else None
        if not label:
            continue
        numeric_count = sum(_is_numeric_like(raw.iat[idx, col]) for col in range(label_col_idx + 1, raw.shape[1]))
        if numeric_count:
            return idx
    return None


def _build_year_meta(raw, header_rows, value_cols):
    meta = {}
    current_year = None
    sticky_parts = [None] * len(header_rows)
    for col in value_cols:
        for idx, row_idx in enumerate(header_rows):
            value = raw.iat[row_idx, col]
            if _is_year(value):
                current_year = int(float(_clean_text(value)))
                continue
            part = _normalise_part(value)
            if part:
                sticky_parts[idx] = part
        meta[col] = {
            "survey_year": current_year,
            "measure_label": _combine_parts(sticky_parts),
        }
    return meta


def _build_single_year_meta(raw, header_rows, value_cols, survey_year):
    meta = {}
    sticky_parts = [None] * len(header_rows)
    for col in value_cols:
        for idx, row_idx in enumerate(header_rows):
            part = _normalise_part(raw.iat[row_idx, col])
            if part:
                sticky_parts[idx] = part
        meta[col] = {
            "survey_year": survey_year,
            "measure_label": _combine_parts(sticky_parts),
        }
    return meta


def _guess_unit(sheet_name, title_rows):
    title_text = " ".join(filter(None, (_clean_text(v) for v in title_rows)))
    title_lower = title_text.lower()
    if "number of interviews" in title_lower:
        return "count"
    if "%" in title_text or " (%)" in title_lower or "(% " in title_lower:
        return "pct"
    return "value"


def _extract_table_number(sheet_name):
    match = re.search(r"(\d+)", sheet_name)
    return int(match.group(1)) if match else pd.NA


def _extract_table_title(raw, sheet_name):
    if len(raw) < 2:
        return sheet_name
    parts = []
    for value in raw.iloc[1].tolist():
        text = _clean_text(value)
        if not text:
            continue
        if text.lower() == sheet_name.lower():
            continue
        if re.fullmatch(r"Table\s+\d+", text, re.I):
            continue
        if text not in parts:
            parts.append(text)
    title = " | ".join(parts) if parts else sheet_name
    title = re.sub(r",(?=\S)", ", ", title)
    title = re.sub(r"\s+", " ", title).strip()
    return title


def _is_section_row(raw, row_idx, label_col_idx):
    label = _clean_text(raw.iat[row_idx, label_col_idx]) if label_col_idx < raw.shape[1] else None
    if not label:
        return False
    lower = label.lower()
    if lower in SKIP_LABELS or lower.startswith("source:"):
        return False
    if any(_is_numeric_like(raw.iat[row_idx, col]) for col in range(label_col_idx + 1, raw.shape[1])):
        return False

    trailing_parts = [
        _clean_text(raw.iat[row_idx, col])
        for col in range(label_col_idx + 1, raw.shape[1])
    ]
    trailing_parts = [part for part in trailing_parts if part]
    if not trailing_parts:
        return True
    return all(part in {"%", "+/-"} or _is_year(part) for part in trailing_parts)


def _find_initial_section(raw, label_col_idx, first_data_row):
    start = max(0, first_data_row - 6)
    for row_idx in range(first_data_row - 1, start - 1, -1):
        if _is_section_row(raw, row_idx, label_col_idx):
            return _clean_text(raw.iat[row_idx, label_col_idx])
    return None


def _parse_value_cell(value):
    raw_text = _clean_text(value)
    if raw_text is None:
        return {
            "value": np.nan,
            "value_raw": pd.NA,
            "value_status": "blank",
            "value_has_asterisk": False,
        }

    lower = raw_text.lower()
    status = "reported"
    if lower in {"na", "n/a", "n.a."}:
        status = "not_available"
    elif lower == "np":
        status = "not_publishable"
    elif lower in {"-", "–", "..."}:
        status = "missing"

    return {
        "value": coerce_numeric_series(pd.Series([raw_text])).iloc[0],
        "value_raw": raw_text,
        "value_status": status,
        "value_has_asterisk": "*" in raw_text,
    }


def _expand_metric_label(raw_label, parent_metric_label):
    raw_text = _raw_cell_text(raw_label)
    label = _clean_text(raw_label)
    if not raw_text or not label:
        return None, parent_metric_label

    is_child = (
        raw_text != raw_text.lstrip()
        or label.lower().startswith(("with ", "using "))
    )
    if is_child and parent_metric_label:
        return f"{parent_metric_label} | {label}", parent_metric_label
    return label, label


def _parse_year_table(raw, sheet_name):
    year_row = _find_year_row(raw)
    if year_row is None:
        return None

    year_positions = [idx for idx, value in enumerate(raw.iloc[year_row].tolist()) if _is_year(value)]
    if not year_positions:
        return None

    label_col_idx = max(0, year_positions[0] - 1)
    first_data_row = _find_first_data_row(raw, label_col_idx, year_row + 1)
    if first_data_row is None:
        return None

    header_rows = list(range(max(0, year_row - 1), first_data_row))
    value_cols = [idx for idx in range(year_positions[0], raw.shape[1]) if any(pd.notna(raw.iat[row_idx, idx]) for row_idx in header_rows)]
    meta = _build_year_meta(raw, header_rows, value_cols)
    unit = _guess_unit(sheet_name, raw.iloc[: min(first_data_row, 3), :].stack().tolist())
    table_title = _extract_table_title(raw, sheet_name)
    table_number = _extract_table_number(sheet_name)

    records = []
    current_section = _find_initial_section(raw, label_col_idx, first_data_row)
    current_parent_metric = None
    for row_idx in range(first_data_row, len(raw)):
        row_values = raw.iloc[row_idx].tolist()
        if sum(_is_year(v) for v in row_values) >= 2:
            continue
        label = _clean_text(raw.iat[row_idx, label_col_idx])
        if not label:
            continue
        lower = label.lower()
        if lower == "95% margin of error":
            break
        if lower in SKIP_LABELS or lower.startswith("source:"):
            continue

        row_has_numeric = any(_is_numeric_like(raw.iat[row_idx, col]) for col in value_cols)
        if not row_has_numeric:
            if _is_section_row(raw, row_idx, label_col_idx):
                current_section = label
                current_parent_metric = None
            continue

        metric_label, current_parent_metric = _expand_metric_label(
            raw.iat[row_idx, label_col_idx],
            current_parent_metric,
        )

        for col in value_cols:
            info = meta[col]
            value_info = _parse_value_cell(raw.iat[row_idx, col])
            records.append({
                "table_id": sheet_name,
                "table_number": table_number,
                "table_title": table_title,
                "slice_section": current_section,
                "metric_label": metric_label,
                "measure_label": info["measure_label"],
                "survey_year": info["survey_year"],
                "value": value_info["value"],
                "value_raw": value_info["value_raw"],
                "value_status": value_info["value_status"],
                "value_has_asterisk": value_info["value_has_asterisk"],
                "value_unit": unit,
            })

    return pd.DataFrame.from_records(records)


def _parse_single_year_table(raw, sheet_name):
    label_col_idx = 1 if raw.shape[1] > 1 else 0
    first_data_row = _find_first_data_row(raw, label_col_idx, 0)
    if first_data_row is None:
        return None

    header_rows = list(range(max(0, first_data_row - 3), first_data_row))
    value_cols = [idx for idx in range(label_col_idx + 1, raw.shape[1]) if any(pd.notna(raw.iat[row_idx, idx]) for row_idx in header_rows)]
    if not value_cols:
        return None

    survey_year = 2025
    meta = _build_single_year_meta(raw, header_rows, value_cols, survey_year)
    unit = _guess_unit(sheet_name, raw.iloc[: min(first_data_row, 3), :].stack().tolist())
    table_title = _extract_table_title(raw, sheet_name)
    table_number = _extract_table_number(sheet_name)

    records = []
    current_section = _find_initial_section(raw, label_col_idx, first_data_row)
    current_parent_metric = None
    for row_idx in range(first_data_row, len(raw)):
        row_values = raw.iloc[row_idx].tolist()
        if sum(_is_year(v) for v in row_values) >= 2:
            continue
        label = _clean_text(raw.iat[row_idx, label_col_idx])
        if not label:
            continue
        lower = label.lower()
        if lower == "95% margin of error":
            break
        if lower in SKIP_LABELS or lower.startswith("source:"):
            continue

        row_has_numeric = any(_is_numeric_like(raw.iat[row_idx, col]) for col in value_cols)
        if not row_has_numeric:
            if _is_section_row(raw, row_idx, label_col_idx):
                current_section = label
                current_parent_metric = None
            continue

        metric_label, current_parent_metric = _expand_metric_label(
            raw.iat[row_idx, label_col_idx],
            current_parent_metric,
        )

        for col in value_cols:
            info = meta[col]
            value_info = _parse_value_cell(raw.iat[row_idx, col])
            records.append({
                "table_id": sheet_name,
                "table_number": table_number,
                "table_title": table_title,
                "slice_section": current_section,
                "metric_label": metric_label,
                "measure_label": info["measure_label"],
                "survey_year": info["survey_year"],
                "value": value_info["value"],
                "value_raw": value_info["value_raw"],
                "value_status": value_info["value_status"],
                "value_has_asterisk": value_info["value_has_asterisk"],
                "value_unit": unit,
            })

    return pd.DataFrame.from_records(records)


def _load_seuv_table(src, sheet_name, logger):
    try:
        raw = pd.read_excel(src, sheet_name=sheet_name, header=None, engine="openpyxl")
    except Exception as e:
        logger.warning(f"Cannot load '{sheet_name}': {e}")
        return None

    raw = raw.dropna(how="all").reset_index(drop=True)
    if raw.empty:
        return None

    if _find_year_row(raw) is not None:
        parsed = _parse_year_table(raw, sheet_name)
    else:
        parsed = _parse_single_year_table(raw, sheet_name)

    if parsed is None or parsed.empty:
        logger.warning(f"  Could not parse '{sheet_name}'")
        return None

    logger.info(f"  {sheet_name}: {len(parsed)} tidy rows")
    return parsed


def run():
    logger = get_logger(DATASET, LOG_DIR)
    tlog = TransformationLog(DATASET)
    src = RAW_FILES[DATASET]

    logger.info("=== STEP 1: DISCOVER ===")
    raw_t2 = pd.read_excel(src, sheet_name="Table 2",
                           header=None, nrows=15, engine="openpyxl")
    run_profile(raw_t2, f"[RAW] {DATASET} — Table 2 preview",
                PROFILE_DIR / f"raw_{DATASET}.html",
                minimal=PROFILE_SETTINGS["minimal"])

    logger.info("=== STEP 2: STRUCTURE — parse all SEUV tables ===")
    frames = []
    for table_name in SEUV_TABLES_CFG["timeseries_tables"]:
        df_t = _load_seuv_table(src, table_name, logger)
        if df_t is not None and not df_t.empty:
            frames.append(df_t)

    if not frames:
        logger.error("No SEUV tables could be parsed — aborting")
        return None

    df = pd.concat(frames, ignore_index=True)
    tlog.record("concat", f"Stacked {len(frames)} SEUV tables",
                rows_after=len(df), cols_after=df.shape[1])
    logger.info(f"Stacked shape: {df.shape}")

    logger.info("=== STEP 3: CLEAN ===")
    for col in ["slice_section", "metric_label", "measure_label"]:
        if col in df.columns:
            df = standardise_text_col(df, col, case="none")
    if "slice_section" in df.columns:
        df["slice_section"] = (
            df["slice_section"]
            .astype("string")
            .str.replace(r"\s*\(base:.*?\)", "", regex=True)
            .str.replace(r"\s+", " ", regex=True)
            .str.strip()
            .replace({"<NA>": pd.NA})
        )
        df["slice_section"] = df["slice_section"].replace({
            "State/territory": "State/Territory",
        }).fillna("Overall")
    if "measure_label" in df.columns:
        df["measure_label"] = df["measure_label"].fillna("Overall")
    if "table_title" in df.columns:
        df["table_title"] = df["table_title"].astype("string").str.strip()
    if {"slice_section", "table_title"}.issubset(df.columns):
        norm_slice = (
            df["slice_section"]
            .astype("string")
            .str.lower()
            .str.replace(r"[^a-z0-9]+", " ", regex=True)
            .str.strip()
        )
        norm_title = (
            df["table_title"]
            .astype("string")
            .str.lower()
            .str.replace(r"[^a-z0-9]+", " ", regex=True)
            .str.strip()
        )
        title_starts_slice = pd.Series(
            [
                bool(title and slice_ and title.startswith(slice_))
                for slice_, title in zip(norm_slice.tolist(), norm_title.tolist())
            ],
            index=df.index,
        )
        slice_starts_title = pd.Series(
            [
                bool(title and slice_ and slice_.startswith(title))
                for slice_, title in zip(norm_slice.tolist(), norm_title.tolist())
            ],
            index=df.index,
        )
        duplicate_section_mask = (
            df["slice_section"].ne("Overall")
            & norm_slice.str.len().ge(20)
            & (
                norm_slice.eq(norm_title)
                | title_starts_slice
                | slice_starts_title
            )
        )
        df.loc[duplicate_section_mask, "slice_section"] = "Overall"
    df["slice_dataset"] = df["slice_section"].map(SLICE_DATASET_MAP).fillna("overall")

    df["survey_year"] = pd.to_numeric(df["survey_year"], errors="coerce").astype("Int64")
    df["value"] = coerce_numeric_series(df["value"])
    if "value_raw" in df.columns:
        df["value_raw"] = df["value_raw"].astype("string")
    df["is_ai_module"] = df["table_id"].isin(AI_TABLES)
    df["anzsco_join_note"] = (
        "Employer survey — joins on state/industry/size. "
        "No ANZSCO occupation code available."
    )

    pct_mask = df["value_unit"].eq("pct") & df["value"].notna()
    count_mask = df["value_unit"].eq("count") & df["value"].notna()
    df["value_outlier_flag"] = pd.NA
    df.loc[pct_mask, "value_outlier_flag"] = ~df.loc[pct_mask, "value"].between(0, 100)
    df.loc[count_mask, "value_outlier_flag"] = df.loc[count_mask, "value"] < 0

    if "value_status" in df.columns:
        before_drop = len(df)
        df = df[~(df["value"].isna() & df["value_status"].eq("blank"))].copy()
        if before_drop != len(df):
            tlog.record(
                "drop_blank_value_rows",
                "Dropped SEUV cells that were blank in the raw workbook",
                rows_before=before_drop,
                rows_after=len(df),
                details={"rows_removed": int(before_drop - len(df))},
            )

    df = df.dropna(subset=["metric_label", "value", "measure_label"], how="all")
    if {"slice_section", "metric_label", "measure_label"}.issubset(df.columns):
        not_applicable_mask = (
            df["slice_section"].astype("string").str.strip().str.lower().eq("not applicable")
            | df["slice_section"].astype("string").str.strip().str.lower().eq("n/a")
            | df["metric_label"].astype("string").str.strip().str.lower().eq("not applicable")
            | df["measure_label"].astype("string").str.strip().str.lower().eq("not applicable")
        )
        df = df.loc[~not_applicable_mask].copy()

    df["_value_status_order"] = df["value_status"].map(VALUE_STATUS_ORDER).fillna(99)
    sort_cols = [
        "table_number", "slice_dataset", "slice_section",
        "metric_label", "measure_label", "_value_status_order", "survey_year",
    ]
    sort_cols = [col for col in sort_cols if col in df.columns]
    df = df.sort_values(sort_cols, kind="stable").reset_index(drop=True)
    df = remove_duplicates(
        df,
        subset=["table_id", "slice_section", "metric_label", "measure_label", "survey_year"],
        logger=logger, tlog=tlog,
    )

    report_missing(df, logger)

    logger.info("=== STEP 4: VALIDATE ===")
    expected_tables = set(SEUV_TABLES_CFG["timeseries_tables"])
    loaded_tables = set(df["table_id"].dropna().unique())
    missing_tables = sorted(expected_tables - loaded_tables)
    if missing_tables:
        logger.warning(f"Missing SEUV tables after parsing: {missing_tables}")
        tlog.record("missing_tables",
                    "Some SEUV sheets were not parsed",
                    details={"missing_tables": missing_tables})

    issues = validate_dataset(df, {}, DATASET, logger)
    tlog.record("validate", f"{len(issues)} issues", details={"issues": issues})

    logger.info("=== STEP 5: PROFILE cleaned data ===")
    run_profile(df, f"[CLEAN] {DATASET}",
                PROFILE_DIR / f"clean_{DATASET}.html",
                minimal=PROFILE_SETTINGS["minimal"])

    logger.info("=== STEP 6: PUBLISH ===")
    logger.info(f"Final shape: {df.shape[0]:,} rows × {df.shape[1]} cols")
    logger.info(f"Tables loaded: {df['table_id'].nunique()} | "
                f"Survey years: {sorted(df['survey_year'].dropna().unique().tolist())}")
    df_export = df.drop(columns=["_value_status_order"], errors="ignore")
    save_parquet(df_export, SILVER_FILES[DATASET], logger, tlog)

    split_dir = SILVER_FILES[DATASET].parent
    split_order = [
        "overall",
        "state_territory",
        "employer_size",
        "industry",
        "training_type",
    ]
    for split_name in split_order:
        df_split = df_export[df_export["slice_dataset"] == split_name].copy()
        if df_split.empty:
            continue
        split_path = split_dir / f"clean_seuv_{split_name}.parquet"
        logger.info(
            f"Publishing SEUV split '{split_name}' "
            f"({len(df_split):,} rows; sections={sorted(df_split['slice_section'].dropna().unique().tolist())})"
        )
        save_parquet(df_split, split_path, logger, tlog)

    audit_path = tlog.save(LOG_DIR)
    logger.info(f"Audit log → {audit_path}")
    return df


if __name__ == "__main__":
    run()

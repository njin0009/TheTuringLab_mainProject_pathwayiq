"""
03_clean_osd.py — Occupation Shortage Driver Report 2025
=========================================================
Input : TA28_DG_RawData_OSD2025_TablesAndFigures_IT1_20260330.xlsx
Output: silver/clean_osd.parquet

The OSD workbook has NO ANZSCO codes — only occupation title strings.
This script:
  1. Extracts the structured driver tables (Tables 3-5, B1-B2) and
     the scatter-plot data table (Figure C1).
  2. Normalises and stacks them into a long unit_group dataset.
  3. Cleans out structural header rows and rounds scatter metrics to the
     displayed precision used in the source workbook.

All table parsing is driven by OSD_TABLES_CFG in config.py.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import pandas as pd
import numpy as np
import re

from config import (
    RAW_FILES, SILVER_FILES, PROFILE_DIR, LOG_DIR,
    OSD_TABLES_CFG, VALIDATION_RULES, PROFILE_SETTINGS,
)
from utils.wrangling_utils import (
    get_logger, TransformationLog,
    run_profile, clean_headers, drop_empty_rows_cols, remove_duplicates,
    report_missing, validate_dataset, save_parquet, standardise_text_col,
    read_excel_with_dynamic_header, drop_rows_missing_key,
)

DATASET = "osd"

# Canonical shortage driver names — any variation gets mapped here
DRIVER_NORMALISATION = {
    "long training gap":    "Long Training Gap",
    "short training gap":   "Short Training Gap",
    "suitability gap":      "Suitability Gap",
    "retention gap":        "Retention Gap",
    "uncertain":            "Uncertain",
}
VALID_DRIVERS = set(DRIVER_NORMALISATION.values())
CURRENT_SHORTAGE_SOURCE_TABLES = {"Table 3", "Table 4", "Table 5", "Table B2", "Figure C1"}
SOURCE_PRIORITY = {
    "Figure C1": 0,
    "Table 3": 1,
    "Table 4": 2,
    "Table 5": 3,
    "Table B2": 4,
    "Table B1": 5,
}


def _load_driver_table(src, sheet_name, cfg, logger):
    """
    Load one driver table from the workbook.
    Returns a DataFrame with columns as specified in cfg['columns'],
    dropping all-null rows.
    """
    try:
        df = read_excel_with_dynamic_header(
            src,
            sheet_name=sheet_name,
            anchor=cfg["header_anchor"],
            skiprows_fallback=6,
        )
    except Exception as e:
        logger.warning(f"Could not load sheet '{sheet_name}': {e}")
        return None

    # Keep only the expected number of columns
    expected_cols = cfg["columns"]
    df = df.iloc[:, : len(expected_cols)].copy()
    df.columns = expected_cols

    # Drop rows where unit_group is null
    df = df.dropna(subset=["unit_group"])

    # Drop separator / blank rows (unit_group may be whitespace only)
    df = df[df["unit_group"].astype(str).str.strip() != ""].copy()
    df["source_table"] = sheet_name

    logger.info(f"  {sheet_name}: {len(df)} rows")
    return df


def _normalise_driver_col(df, col):
    """Lower-strip and map to canonical driver name."""
    if col not in df.columns:
        return df
    df[col] = (
        df[col]
        .astype(str)
        .str.strip()
        .str.lower()
        .map(lambda x: DRIVER_NORMALISATION.get(x, x if x != "nan" else np.nan))
    )
    return df


def _standardise_unit_group(df):
    """Standardise display text without erasing occupation meaning."""
    if "unit_group" not in df.columns:
        return df
    df = standardise_text_col(df, "unit_group", case="title")
    df["unit_group"] = (
        df["unit_group"]
        .astype("string")
        .str.replace(r"\s*/\s*", " / ", regex=True)
        .str.replace(r"\s*,\s*", ", ", regex=True)
        .str.replace(r"\s+", " ", regex=True)
        .str.strip()
        .replace({"<NA>": pd.NA})
    )
    return df


def _build_unit_group_key(series):
    """Create a robust matching key for duplicate detection across source tables."""
    s = series.astype("string").fillna("")
    s = (
        s.str.normalize("NFKC")
        .str.lower()
        .str.replace("&", " and ", regex=False)
        .str.replace("/", " and ", regex=False)
        .str.replace(",", "", regex=False)
        .str.replace(r"[^\w\s()-]", " ", regex=True)
        .str.replace(r"\s+", " ", regex=True)
        .str.strip()
    )
    return s.replace({"": pd.NA})


def _unique_non_null(series):
    values = []
    for raw in series.dropna():
        text = str(raw).strip()
        if not text or text.lower() == "nan" or text in values:
            continue
        values.append(text)
    return values


def _first_non_null(series):
    values = _unique_non_null(series)
    return values[0] if values else pd.NA


def _extract_source_meta(source_table):
    source_text = source_table if pd.notna(source_table) else pd.NA
    if pd.isna(source_text):
        return pd.NA, pd.NA
    match = re.match(r"^(Table|Figure)\s+([A-Z]?\d+)$", str(source_text))
    if not match:
        return pd.NA, pd.NA
    return match.group(1), match.group(2)


def _collapse_osd_rows(df, logger, tlog):
    """
    Consolidate stacked OSD source tables to one row per unit group while
    preserving provenance and source-derived flags.
    """
    rows_before = len(df)
    records = []
    work = df.sort_values(
        ["source_priority", "source_table", "unit_group"],
        kind="stable",
    )

    for _, group in work.groupby("unit_group_key", dropna=False, sort=False):
        source_tables = _unique_non_null(group["source_table"])
        primary_source = source_tables[0] if source_tables else pd.NA
        source_type, source_id = _extract_source_meta(primary_source)

        driver_2024_values = _unique_non_null(group["driver_2024"])
        driver_2025_candidates = _unique_non_null(group["driver_2025_candidate"])
        shortage_driver_values = _unique_non_null(group["shortage_driver"])

        driver_2024 = driver_2024_values[0] if driver_2024_values else pd.NA
        driver_2025 = driver_2025_candidates[0] if driver_2025_candidates else pd.NA
        in_shortage_2025 = any(source in CURRENT_SHORTAGE_SOURCE_TABLES for source in source_tables)
        no_longer_shortage_2025 = "Table B1" in source_tables
        new_shortage_2025 = "Table B2" in source_tables

        record = {
            "unit_group": _first_non_null(group["unit_group"]),
            "driver_2024": driver_2024,
            "driver_2025": driver_2025,
            "source_table": primary_source,
            "source_tables": " | ".join(source_tables) if source_tables else pd.NA,
            "source_table_count": len(source_tables),
            "source_type": source_type,
            "source_id": source_id,
            "ivi_ue_ratio": pd.to_numeric(group["ivi_ue_ratio"], errors="coerce").dropna().iloc[0]
            if group["ivi_ue_ratio"].notna().any() else np.nan,
            "employment_growth_5yr": pd.to_numeric(group["employment_growth_5yr"], errors="coerce").dropna().iloc[0]
            if group["employment_growth_5yr"].notna().any() else np.nan,
            "in_shortage_2025_flag": in_shortage_2025,
            "new_shortage_2025_flag": new_shortage_2025,
            "no_longer_shortage_2025_flag": no_longer_shortage_2025,
            "driver_2024_source_mismatch_flag": len(driver_2024_values) > 1,
            "driver_2025_source_mismatch_flag": len(driver_2025_candidates) > 1,
            "source_status_conflict_flag": in_shortage_2025 and no_longer_shortage_2025,
        }
        if in_shortage_2025:
            record["shortage_driver"] = driver_2025 if pd.notna(driver_2025) else (shortage_driver_values[0] if shortage_driver_values else pd.NA)
        else:
            record["shortage_driver"] = pd.NA
        records.append(record)

    out = pd.DataFrame.from_records(records)
    out["driver_conflict"] = (
        out["driver_2024"].notna()
        & out["driver_2025"].notna()
        & out["driver_2024"].fillna("__missing__").ne(out["driver_2025"].fillna("__missing__"))
    )
    out["ivi_ue_ratio_negative_flag"] = out["ivi_ue_ratio"] < 0
    out["employment_growth_extreme_flag"] = (
        out["employment_growth_5yr"] > 10
    ) | (
        out["employment_growth_5yr"] < -5
    )

    logger.info(
        f"Collapsed OSD rows from {rows_before} source rows to {len(out)} unit-group rows"
    )
    tlog.record(
        "collapse_unit_groups",
        "Collapsed stacked OSD source tables to one row per unit group",
        rows_before=rows_before,
        rows_after=len(out),
        details={"rows_removed": int(rows_before - len(out))},
    )
    return out


def _drop_structural_rows(df):
    structural_titles = {
        "Unit Groups", "Unit Group", "Unit Group Title",
        "Shortage Drivers", "Total",
    }
    mask = df["unit_group"].isin(structural_titles)
    for col in ["driver_2024", "driver_2025", "shortage_driver"]:
        if col in df.columns:
            mask = mask | df[col].astype(str).str.lower().isin(
                {"2024", "2025", "2024 osd", "2025 osd", "2025 shortage driver", "shortage driver", "number of unit groups"}
            )
    return df.loc[~mask].copy()


def run():
    logger = get_logger(DATASET, LOG_DIR)
    tlog   = TransformationLog(DATASET)
    src    = RAW_FILES[DATASET]

    # ── 1. DISCOVER ──────────────────────────────────────────────────────────
    logger.info("=== STEP 1: DISCOVER ===")
    raw_preview = pd.read_excel(src, sheet_name="Table 3",
                                header=None, nrows=15, engine="openpyxl")
    run_profile(raw_preview, f"[RAW] {DATASET} — Table 3 preview",
                PROFILE_DIR / f"raw_{DATASET}_preview.html",
                minimal=PROFILE_SETTINGS["minimal"])

    # ── 2. STRUCTURE — extract all driver tables ──────────────────────────────
    logger.info("=== STEP 2: STRUCTURE — extract driver tables ===")
    frames = []

    for sheet_name, cfg in OSD_TABLES_CFG["driver_tables"].items():
        df_t = _load_driver_table(src, sheet_name, cfg, logger)
        if df_t is not None:
            frames.append(df_t)

    for sheet_name, cfg in OSD_TABLES_CFG["scatter_table"].items():
        df_s = _load_driver_table(src, sheet_name, cfg, logger)
        if df_s is not None:
            # Numeric columns
            for col in ["ivi_ue_ratio", "employment_growth_5yr"]:
                if col in df_s.columns:
                    df_s[col] = pd.to_numeric(df_s[col], errors="coerce").round(2)
            frames.append(df_s)

    df = pd.concat(frames, ignore_index=True)
    tlog.record("concat", f"Stacked {len(frames)} OSD tables",
                rows_after=len(df), cols_after=df.shape[1])
    logger.info(f"Stacked: {df.shape}")

    # ── 3. CLEAN ─────────────────────────────────────────────────────────────
    logger.info("=== STEP 3: CLEAN ===")

    # 3a. Normalise unit_group text
    df = _standardise_unit_group(df)

    # 3b. Normalise driver columns (any col containing 'driver')
    driver_cols = [c for c in df.columns if "driver" in c.lower()
                   or c == "shortage_driver"]
    for col in driver_cols:
        df = _normalise_driver_col(df, col)
    for col in ["driver_2024", "driver_2025", "shortage_driver"]:
        if col in df.columns:
            df.loc[~df[col].isin(list(VALID_DRIVERS) + [np.nan]), col] = pd.NA

    # 3c. Drop rows with no unit_group
    df = drop_rows_missing_key(df, ["unit_group"], logger, tlog)

    # 3d. Remove structural/header rows that survive sheet parsing.
    before = len(df)
    df = _drop_structural_rows(df)
    removed = before - len(df)
    if removed:
        logger.warning(f"Removed {removed} structural OSD rows")
        tlog.record("drop_structural_rows",
                    "Removed structural/header rows from OSD tables",
                    rows_before=before, rows_after=len(df),
                    details={"removed": removed})

    # 3e. Standardise numeric scatter columns and derive source metadata
    for col in ["ivi_ue_ratio", "employment_growth_5yr"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").round(2)

    df["source_priority"] = df["source_table"].map(SOURCE_PRIORITY).fillna(99)
    df["source_type"], df["source_id"] = zip(*df["source_table"].map(_extract_source_meta))
    df["unit_group_key"] = _build_unit_group_key(df["unit_group"])
    df["driver_2025_candidate"] = df["driver_2025"].fillna(df["shortage_driver"])

    # 3f. Consolidate duplicate unit groups across sources instead of keeping a sparse stack.
    df = _collapse_osd_rows(df, logger, tlog)

    # 3g. Remove any accidental duplicates after consolidation.
    df = remove_duplicates(df, subset=["unit_group"], logger=logger, tlog=tlog)

    # ── 4. ENRICH — document grain ─────────────────────────────────────────────
    logger.info("=== STEP 4: ENRICH — document join grain ===")
    df["anzsco_join_note"] = "OSD unit group level — no 6-digit ANZSCO mapping"

    # ── 5. VALIDATE ──────────────────────────────────────────────────────────
    logger.info("=== STEP 5: VALIDATE ===")
    report_missing(df, logger)
    issues = validate_dataset(df, {}, DATASET, logger)
    tlog.record("validate", f"{len(issues)} issues", details={"issues": issues})

    # ── 6. PROFILE ───────────────────────────────────────────────────────────
    logger.info("=== STEP 6: PROFILE cleaned data ===")
    run_profile(df, f"[CLEAN] {DATASET}",
                PROFILE_DIR / f"clean_{DATASET}.html",
                minimal=PROFILE_SETTINGS["minimal"])

    # ── 7. PUBLISH ───────────────────────────────────────────────────────────
    logger.info("=== STEP 7: PUBLISH ===")
    logger.info(f"Final shape: {df.shape[0]:,} rows × {df.shape[1]} cols")
    logger.info(f"Columns: {df.columns.tolist()}")
    save_parquet(df, SILVER_FILES[DATASET], logger, tlog)
    audit_path = tlog.save(LOG_DIR)
    logger.info(f"Audit log → {audit_path}")
    return df


if __name__ == "__main__":
    run()

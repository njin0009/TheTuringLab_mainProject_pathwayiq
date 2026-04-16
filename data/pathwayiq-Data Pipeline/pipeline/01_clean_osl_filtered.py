"""
01_clean_osl_filtered.py — Occupation Shortage List 2025 (Filtered CSV)
========================================================================
Input : TA28_DG_RawData_OSL2025_ANZSCO6_Filtered_IT1_20260330.csv
Output: silver/clean_osl_filtered.parquet

This dataset is the most straightforward — it is already a clean tabular CSV.
It becomes the MASTER ANZSCO LOOKUP TABLE used by every other script.

Pipeline steps
--------------
1. DISCOVER  — profile raw data with YData Profiling
2. STRUCTURE — load CSV, detect types
3. CLEAN     — rename headers, cast types, standardise ratings, drop dupes
4. VALIDATE  — apply domain rules
5. PROFILE   — re-profile cleaned data
6. PUBLISH   — write parquet + audit log
"""

import sys
from pathlib import Path

# Allow running from any working directory
sys.path.insert(0, str(Path(__file__).parent))

import numpy as np
import pandas as pd

from config import (
    RAW_FILES, SILVER_FILES, PROFILE_DIR, LOG_DIR,
    OSL_FILTERED_RENAME, SHORTAGE_RATING_MAP, SHORTAGE_RATING_ORDER,
    VALIDATION_RULES, PROFILE_SETTINGS, ANZSCO_MAJOR_GROUP_LABELS,
)
from utils.wrangling_utils import (
    get_logger, TransformationLog,
    run_profile, clean_headers, drop_empty_rows_cols, remove_duplicates,
    cast_numeric_cols, cast_categorical_cols, apply_value_map,
    drop_rows_missing_key, report_missing, validate_dataset, save_parquet,
    flag_outliers_iqr, standardise_text_col,
)

DATASET = "osl_filtered"


def run():
    logger = get_logger(DATASET, LOG_DIR)
    tlog   = TransformationLog(DATASET)
    src    = RAW_FILES[DATASET]

    # ── 1. DISCOVER ──────────────────────────────────────────────────────────
    logger.info("=== STEP 1: DISCOVERY — profiling raw data ===")
    raw = pd.read_csv(src)
    logger.info(f"Loaded {raw.shape[0]:,} rows × {raw.shape[1]} cols from {src.name}")
    tlog.record("load", f"Read raw CSV from {src}", rows_after=len(raw))

    run_profile(raw, f"[RAW] {DATASET}",
                PROFILE_DIR / f"raw_{DATASET}.html",
                minimal=PROFILE_SETTINGS["minimal"])
    logger.info("Raw profile written")

    # ── 2. STRUCTURE ─────────────────────────────────────────────────────────
    logger.info("=== STEP 2: STRUCTURE — reshape ===")
    df = raw.copy()

    # ── 3. CLEAN ─────────────────────────────────────────────────────────────
    logger.info("=== STEP 3: CLEAN ===")

    # 3a. Header normalisation
    df = clean_headers(df, rename_map=OSL_FILTERED_RENAME)
    logger.info(f"Headers after rename: {df.columns.tolist()}")
    tlog.record("clean_headers", "Applied rename map and snake-cased all headers")

    # 3b. Drop near-empty rows/cols
    df = drop_empty_rows_cols(df, logger, tlog, empty_threshold=0.95)

    # 3c. Cast ANZSCO code to integer — it must be a 6-digit integer
    df = cast_numeric_cols(df, ["anzsco_code", "skill_level"], logger, tlog)
    df["anzsco_code"] = df["anzsco_code"].astype("Int64")  # nullable int
    df["skill_level"] = df["skill_level"].astype("Int64")

    # 3d. Standardise occupation title text
    df = standardise_text_col(df, "occupation_title", case="title")

    # 3e. Standardise shortage rating values using the central map
    rating_cols = [c for c in df.columns if "rating" in c.lower()]
    for col in rating_cols:
        df = apply_value_map(df, col, SHORTAGE_RATING_MAP, logger, tlog)

    # 3f. Cast rating columns to ordered Categorical
    df = cast_categorical_cols(df, rating_cols, SHORTAGE_RATING_ORDER, logger, tlog)

    # 3g. Add ANZSCO major group (1-digit) derived from code
    df["major_group_code"] = (
        df["anzsco_code"]
        .astype(str)
        .str[0]
        .pipe(pd.to_numeric, errors="coerce")
        .astype("Int64")
    )
    df["major_group_label"] = df["major_group_code"].map(ANZSCO_MAJOR_GROUP_LABELS)

    # 3h. Remove genuine duplicates on ANZSCO code
    df = remove_duplicates(df, subset=["anzsco_code"], logger=logger, tlog=tlog)

    # 3i. Drop rows with no ANZSCO code (cannot participate in any join)
    df = drop_rows_missing_key(df, ["anzsco_code"], logger, tlog)

    # 3j. Report remaining missing values
    report_missing(df, logger)

    # ── 4. VALIDATE ──────────────────────────────────────────────────────────
    logger.info("=== STEP 4: VALIDATE ===")
    issues = validate_dataset(df, VALIDATION_RULES.get(DATASET, {}),
                              DATASET, logger)
    tlog.record("validate",
                f"Validation complete — {len(issues)} issues",
                details={"issues": issues})

    # ── 5. PROFILE (post-clean) ──────────────────────────────────────────────
    logger.info("=== STEP 5: PROFILE cleaned data ===")
    run_profile(df, f"[CLEAN] {DATASET}",
                PROFILE_DIR / f"clean_{DATASET}.html",
                minimal=PROFILE_SETTINGS["minimal"])

    # ── 6. PUBLISH ───────────────────────────────────────────────────────────
    logger.info("=== STEP 6: PUBLISH ===")
    logger.info(f"Final shape: {df.shape[0]:,} rows × {df.shape[1]} cols")
    logger.info(f"Columns: {df.columns.tolist()}")
    save_parquet(df, SILVER_FILES[DATASET], logger, tlog)
    audit_path = tlog.save(LOG_DIR)
    logger.info(f"Audit log → {audit_path}")
    return df


if __name__ == "__main__":
    run()

"""
07_clean_apprentices.py — Apprentices and Trainees 2025 (Sep Qtr Estimates Review)
====================================================================================
Input : TA28_DG_RawData_ApprenticesTrainees2025_SepQtr_IT1_20260330.xlsx
Output: silver/clean_apprentices.parquet

This workbook is an estimation review dashboard.
The Analysis table sheet has clean column headers in row 1.
Key cleaning tasks:
  - Drop Excel formula columns (CONCAT, COUNT) and formula-value cells
  - Parse the review_quarter datetime column correctly
  - Standardise contract_type and estimate_type
  - Compute an accuracy flag: is estimate within ±5% of final count?
  - Flag accuracy outliers

ANZSCO note: This dataset covers aggregate contract counts (commencements,
completions, etc.) at state level — no occupation-level breakdown.
anzsco_join_note column is added to document this.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import pandas as pd
import numpy as np

from config import (
    RAW_FILES, SILVER_FILES, PROFILE_DIR, LOG_DIR,
    APPRENTICES_CFG, APPRENTICES_RENAME,
    VALIDATION_RULES, PROFILE_SETTINGS,
)
from utils.wrangling_utils import (
    get_logger, TransformationLog,
    run_profile, clean_headers, drop_empty_rows_cols, remove_duplicates,
    cast_numeric_cols, report_missing, validate_dataset, save_parquet,
    standardise_text_col, drop_rows_missing_key, flag_outliers_iqr,
    drop_formula_cols,
)

DATASET = "apprentices"

CONTRACT_TYPE_MAP = {
    "cancellations/withdrawals": "Cancellations/Withdrawals",
    "Cancellations/withdrawals":  "Cancellations/Withdrawals",
    "commencements":              "Commencements",
    "Commencements":              "Commencements",
    "completions":                "Completions",
    "Completions":                "Completions",
    "in-training":                "In-Training",
    "In-training":                "In-Training",
}

ESTIMATE_TYPE_MAP = {
    "Initial":       "Initial",
    "initial":       "Initial",
    "1st revision":  "1st Revision",
    "1st Revision":  "1st Revision",
}

STATE_NAME_MAP = {
    "Nsw":              "New South Wales",
    "NSW":              "New South Wales",
    "Vic":              "Victoria",
    "VIC":              "Victoria",
    "Qld":              "Queensland",
    "QLD":              "Queensland",
    "Sa":               "South Australia",
    "SA":               "South Australia",
    "Wa":               "Western Australia",
    "WA":               "Western Australia",
    "Tas":              "Tasmania",
    "TAS":              "Tasmania",
    "Nt":               "Northern Territory",
    "NT":               "Northern Territory",
    "Act":              "Australian Capital Territory",
    "ACT":              "Australian Capital Territory",
    "Australia":        "Australia",
}


def run():
    logger = get_logger(DATASET, LOG_DIR)
    tlog   = TransformationLog(DATASET)
    src    = RAW_FILES[DATASET]
    cfg    = APPRENTICES_CFG

    # ── 1. DISCOVER ──────────────────────────────────────────────────────────
    logger.info("=== STEP 1: DISCOVER ===")
    raw = pd.read_excel(src, sheet_name=cfg["sheet"],
                        header=0, engine="openpyxl")
    logger.info(f"Raw shape: {raw.shape}")
    tlog.record("load", f"Read Analysis table sheet", rows_after=len(raw))

    run_profile(raw.head(200), f"[RAW] {DATASET}",
                PROFILE_DIR / f"raw_{DATASET}.html",
                minimal=PROFILE_SETTINGS["minimal"])

    # ── 2. STRUCTURE ─────────────────────────────────────────────────────────
    logger.info("=== STEP 2: STRUCTURE ===")
    df = raw.copy()

    # Drop the COUNT column which contains a formula range reference
    cols_to_drop = [
        c for c in df.columns
        if (
            str(c).strip().upper() in {d.upper() for d in cfg["drop_cols"]}
            or str(c).strip() == ""
            or str(c).lower().startswith("unnamed")
        )
    ]
    if cols_to_drop:
        df = df.drop(columns=cols_to_drop)
        logger.info(f"Dropped helper cols: {cols_to_drop}")
        tlog.record("drop_helper_cols", f"Removed {cols_to_drop}")

    # Drop formula-value columns (first non-null cell starts with '=')
    df = drop_formula_cols(df, cfg["formula_prefix"], logger, tlog)

    # ── 3. CLEAN ─────────────────────────────────────────────────────────────
    logger.info("=== STEP 3: CLEAN ===")

    # Rename all columns
    df = clean_headers(df, rename_map=APPRENTICES_RENAME)

    # Drop near-empty rows/cols
    df = drop_empty_rows_cols(df, logger, tlog, empty_threshold=0.90)

    # Parse the review_quarter_date column (stored as datetime by openpyxl)
    if "review_quarter_date" in df.columns:
        df["review_quarter_date"] = pd.to_datetime(
            df["review_quarter_date"], errors="coerce")
        logger.info(f"review_quarter_date range: "
                    f"{df['review_quarter_date'].min()} – "
                    f"{df['review_quarter_date'].max()}")
        tlog.record("parse_dates", "Parsed review_quarter_date to datetime")

    # Parse collection_quarter (stored as float year.quarter e.g. 2023.3)
    if "collection_quarter" in df.columns:
        df["collection_quarter"] = pd.to_numeric(
            df["collection_quarter"], errors="coerce")

    # Standardise categorical text columns
    if "state" in df.columns:
        df = standardise_text_col(df, "state", case="title")
        df["state"] = df["state"].map(
            lambda v: STATE_NAME_MAP.get(str(v).strip(), str(v).strip())
            if pd.notna(v) else v
        )

    if "contract_type" in df.columns:
        df["contract_type"] = df["contract_type"].map(
            lambda v: CONTRACT_TYPE_MAP.get(str(v).strip(), str(v).strip())
            if pd.notna(v) else v
        )

    if "estimate_type" in df.columns:
        df["estimate_type"] = df["estimate_type"].map(
            lambda v: ESTIMATE_TYPE_MAP.get(str(v).strip(), str(v).strip())
            if pd.notna(v) else v
        )

    # Cast numeric measurement columns
    num_cols = ["estimate", "model_estimate", "ci_lower_95", "ci_upper_95",
                "final_count", "pct_of_final_count", "raw_collected_count",
                "model_pct_of_final_count", "collection_number"]
    df = cast_numeric_cols(df, num_cols, logger, tlog)

    # Publish count-like fields at business-friendly precision.
    for col in ["estimate", "model_estimate"]:
        if col in df.columns:
            df[col] = df[col].round(1)

    for col in ["ci_lower_95", "ci_upper_95", "final_count",
                "raw_collected_count", "collection_number"]:
        if col in df.columns:
            df[col] = df[col].round().astype("Int64")

    if "collection_quarter" in df.columns:
        year = np.floor(df["collection_quarter"]).astype("Int64")
        quarter = ((df["collection_quarter"] - year.astype(float)) * 10).round().astype("Int64")
        df["collection_year"] = year
        df["collection_quarter_number"] = quarter
        df["collection_quarter_label"] = (
            year.astype("string") + "-Q" + quarter.astype("string")
        )

    # ── 4. ENRICH — derive accuracy columns ──────────────────────────────────
    logger.info("=== STEP 4: ENRICH — derive accuracy metrics ===")

    if all(c in df.columns for c in ["estimate", "final_count"]):
        df["abs_pct_error"] = (
            (df["estimate"] - df["final_count"]).abs() /
            df["final_count"].replace(0, np.nan) * 100
        ).round(2)
        df["within_5pct_of_final"] = df["abs_pct_error"].le(5)
        logger.info(f"abs_pct_error: mean={df['abs_pct_error'].mean():.2f}%, "
                    f"median={df['abs_pct_error'].median():.2f}%")
        tlog.record("derive_accuracy",
                    "Computed abs_pct_error and within_5pct_of_final",
                    details={
                        "mean_error": float(df["abs_pct_error"].mean()),
                        "median_error": float(df["abs_pct_error"].median()),
                    })

    # Flag outlier accuracy values
    if "pct_of_final_count" in df.columns:
        df = flag_outliers_iqr(df, "pct_of_final_count",
                               k=3.0, logger=logger, tlog=tlog)

    # ANZSCO join note
    df["anzsco_join_note"] = ("Aggregate contract counts by state/contract_type. "
                               "No ANZSCO occupation code available at this level.")

    # ── 5. DROP ROWS with no key ──────────────────────────────────────────────
    df = drop_rows_missing_key(df, ["state", "contract_type"], logger, tlog)
    df = remove_duplicates(
        df,
        subset=["state", "contract_type", "collection_number", "estimate_type"],
        logger=logger, tlog=tlog)

    report_missing(df, logger)

    # ── 6. VALIDATE ──────────────────────────────────────────────────────────
    logger.info("=== STEP 6: VALIDATE ===")
    issues = validate_dataset(df, VALIDATION_RULES.get(DATASET, {}),
                              DATASET, logger)
    tlog.record("validate", f"{len(issues)} issues", details={"issues": issues})

    # ── 7. PROFILE ───────────────────────────────────────────────────────────
    logger.info("=== STEP 7: PROFILE cleaned data ===")
    run_profile(df, f"[CLEAN] {DATASET}",
                PROFILE_DIR / f"clean_{DATASET}.html",
                minimal=PROFILE_SETTINGS["minimal"])

    # ── 8. PUBLISH ───────────────────────────────────────────────────────────
    logger.info("=== STEP 8: PUBLISH ===")
    logger.info(f"Final shape: {df.shape[0]:,} rows × {df.shape[1]} cols")
    logger.info(f"Contract types: {df['contract_type'].unique().tolist()}")
    logger.info(f"Estimate types: {df['estimate_type'].unique().tolist()}")
    save_parquet(df, SILVER_FILES[DATASET], logger, tlog)
    audit_path = tlog.save(LOG_DIR)
    logger.info(f"Audit log → {audit_path}")
    return df


if __name__ == "__main__":
    run()

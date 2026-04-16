"""
02_clean_osl_full.py — Occupation Shortage List 2025 (Full ANZSCO6 XLSX)
=========================================================================
Input : TA28_DG_RawData_OSL2025_ANZSCO6_Full_IT1_20260330.xlsx
Output: silver/clean_osl_full.parquet

This workbook has two rating sheets (ANZSCO 2022 and OSCA 2024).
We clean both, stack them with a 'classification_system' tag, and output
a unified file.  Dynamic header detection handles the multi-row title block.

Pipeline steps
--------------
1. DISCOVER  — profile raw sheets
2. STRUCTURE — detect header row, load both sheets
3. CLEAN     — rename, cast, standardise, deduplicate
4. ENRICH    — add major group derived field
5. VALIDATE
6. PROFILE cleaned
7. PUBLISH
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import pandas as pd
import numpy as np

from config import (
    RAW_FILES, SILVER_FILES, PROFILE_DIR, LOG_DIR,
    OSL_FULL_SHEET_CFG, OSL_FULL_RENAME,
    SHORTAGE_RATING_MAP, SHORTAGE_RATING_ORDER,
    VALIDATION_RULES, PROFILE_SETTINGS, ANZSCO_MAJOR_GROUP_LABELS,
)
from utils.wrangling_utils import (
    get_logger, TransformationLog,
    run_profile, clean_headers, drop_empty_rows_cols, remove_duplicates,
    cast_numeric_cols, cast_categorical_cols, apply_value_map,
    drop_rows_missing_key, report_missing, validate_dataset, save_parquet,
    standardise_text_col, read_excel_with_dynamic_header,
)

DATASET = "osl_full"

# The OSCA 2024 sheet shares most rating columns with the ANZSCO sheet.
OSCA_RENAME = {
    **OSL_FULL_RENAME,
    "Occupation code (OSCA 2024)": "anzsco_code",
}


def _clean_osl_sheet(path, sheet_cfg, rename_map, classification_label,
                     logger, tlog):
    """Generic cleaner for either OSL sheet — keeps logic DRY."""
    df = read_excel_with_dynamic_header(
        path,
        sheet_name=sheet_cfg["sheet"],
        anchor=sheet_cfg["header_anchor"],
        skiprows_fallback=sheet_cfg.get("skiprows_fallback", 7),
    )
    logger.info(f"Loaded sheet '{sheet_cfg['sheet']}': {df.shape}")

    # Profile raw sheet
    run_profile(df, f"[RAW] {DATASET} — {sheet_cfg['sheet']}",
                PROFILE_DIR / f"raw_{DATASET}_{classification_label}.html",
                minimal=PROFILE_SETTINGS["minimal"])

    df = drop_empty_rows_cols(df, logger, tlog, empty_threshold=0.90)
    df = clean_headers(df, rename_map=rename_map)

    # Drop any trailing navigation/note rows (cells with "back to contents")
    text_mask = df.apply(lambda r: r.astype(str).str.lower()
                         .str.contains("back to").any(), axis=1)
    df = df[~text_mask].reset_index(drop=True)

    # Standardise ANZSCO code
    df = cast_numeric_cols(df, ["anzsco_code"], logger, tlog)
    df["anzsco_code"] = df["anzsco_code"].astype("Int64")
    df = drop_rows_missing_key(df, ["anzsco_code"], logger, tlog)

    # Occupation title
    df = standardise_text_col(df, "occupation_title", case="title")

    # Harmonise any raw state code columns that survived auto header cleaning.
    state_code_map = {
        "nsw": "nsw_rating", "vic": "vic_rating", "qld": "qld_rating",
        "sa": "sa_rating", "wa": "wa_rating", "tas": "tas_rating",
        "nt": "nt_rating", "act": "act_rating",
        "ns_no_shortage_s_shortage_r_regional_shortage_m_metro_shortage": "national_shortage_rating",
    }
    df = df.rename(columns={k: v for k, v in state_code_map.items() if k in df.columns and v not in df.columns})

    # Skill level
    if "skill_level" in df.columns:
        df = cast_numeric_cols(df, ["skill_level"], logger, tlog)
        df["skill_level"] = df["skill_level"].astype("Int64")

    # All rating columns
    rating_cols = [c for c in df.columns
                   if any(x in c.lower() for x in ("rating", "_nsw", "_vic",
                                                     "_qld", "_sa", "_wa",
                                                     "_tas", "_nt", "_act"))]
    for col in rating_cols:
        df = apply_value_map(df, col, SHORTAGE_RATING_MAP, logger, tlog)
    df = cast_categorical_cols(df, rating_cols, SHORTAGE_RATING_ORDER, logger, tlog)

    # Add classification system tag
    df["classification_system"] = classification_label

    # Major group derived
    df["major_group_code"] = (
        df["anzsco_code"].astype(str).str[0]
        .pipe(pd.to_numeric, errors="coerce").astype("Int64")
    )
    df["major_group_label"] = df["major_group_code"].map(ANZSCO_MAJOR_GROUP_LABELS)

    df = remove_duplicates(df, subset=["anzsco_code"], logger=logger, tlog=tlog)
    return df


def run():
    logger = get_logger(DATASET, LOG_DIR)
    tlog   = TransformationLog(DATASET)
    src    = RAW_FILES[DATASET]

    logger.info("=== STEP 1–2: DISCOVER & STRUCTURE both OSL sheets ===")

    df_anzsco = _clean_osl_sheet(
        src,
        sheet_cfg=OSL_FULL_SHEET_CFG,
        rename_map=OSL_FULL_RENAME,
        classification_label="ANZSCO_2022",
        logger=logger, tlog=tlog,
    )

    # OSCA 2024 sheet — same cleaning, different sheet name and rename map
    osca_cfg = {
        "sheet": "2025 OSL (OSCA 2024)",
        "header_anchor": "Occupation code",
        "skiprows_fallback": 7,
    }
    df_osca = _clean_osl_sheet(
        src,
        sheet_cfg=osca_cfg,
        rename_map=OSCA_RENAME,
        classification_label="OSCA_2024",
        logger=logger, tlog=tlog,
    )

    # ── 3. STACK both sheets ─────────────────────────────────────────────────
    logger.info("=== STEP 3: STACK both classification sheets ===")
    df = pd.concat([df_anzsco, df_osca], ignore_index=True)
    logger.info(f"Stacked shape: {df.shape}")
    tlog.record("concat", "Stacked ANZSCO_2022 + OSCA_2024 sheets",
                rows_after=len(df), cols_after=df.shape[1])

    # ── 4. VALIDATE ──────────────────────────────────────────────────────────
    logger.info("=== STEP 4: VALIDATE ===")
    # Only validate the ANZSCO rows against strict rules
    df_anzsco_only = df[df["classification_system"] == "ANZSCO_2022"]
    issues = validate_dataset(df_anzsco_only,
                              VALIDATION_RULES.get(DATASET, {}),
                              DATASET, logger)
    tlog.record("validate", f"{len(issues)} issues", details={"issues": issues})

    # ── 5. PROFILE ───────────────────────────────────────────────────────────
    logger.info("=== STEP 5: PROFILE cleaned data ===")
    report_missing(df, logger)
    run_profile(df, f"[CLEAN] {DATASET}",
                PROFILE_DIR / f"clean_{DATASET}.html",
                minimal=PROFILE_SETTINGS["minimal"])

    # ── 6. PUBLISH ───────────────────────────────────────────────────────────
    logger.info("=== STEP 6: PUBLISH ===")
    logger.info(f"Final shape: {df.shape[0]:,} rows × {df.shape[1]} cols")
    save_parquet(df, SILVER_FILES[DATASET], logger, tlog)
    audit_path = tlog.save(LOG_DIR)
    logger.info(f"Audit log → {audit_path}")
    return df


if __name__ == "__main__":
    run()

"""
08_clean_anzsco_reference.py — ANZSCO standard title reference
===============================================================
Input : TA28_DG_ANZSCOStandardTitle_I2_20260415.xls
Output: silver/clean_anzsco_reference.parquet

This workbook is the authoritative ANZSCO title index. It contains the
6-digit occupation code together with principal titles, alternative titles,
specialisations, and NEC-category titles. We clean it into a reusable
reference table so downstream datasets can enrich missing ANZSCO labels and
hierarchy fields without relying on partial OSL coverage.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import pandas as pd

from config import (
    RAW_FILES, SILVER_FILES, PROFILE_DIR, LOG_DIR,
    ANZSCO_REFERENCE_CFG, ANZSCO_TITLE_TYPE_MAP,
    ANZSCO_MAJOR_GROUP_LABELS, VALIDATION_RULES, PROFILE_SETTINGS,
)
from utils.wrangling_utils import (
    get_logger, TransformationLog,
    run_profile, clean_headers, drop_empty_rows_cols, remove_duplicates,
    cast_numeric_cols, drop_rows_missing_key, report_missing,
    validate_dataset, save_parquet, normalise_anzsco_title_series,
)

DATASET = "anzsco_reference"


def _read_reference_table(path: Path, cfg: dict) -> pd.DataFrame:
    """Read the ANZSCO title index with a robust engine for legacy .xls files."""
    return pd.read_excel(
        path,
        sheet_name=cfg["sheet"],
        header=cfg["header_row"],
        engine="calamine",
    )


def _clean_title_text(series: pd.Series) -> pd.Series:
    """Remove reference markers while preserving the core occupation title."""
    s = series.astype("string").fillna("").str.strip()
    s = s.str.replace(r"\s*\(([PASN])\)\s*$", "", regex=True)
    s = s.str.replace(r"\s*\((Aus|NZ)\)", "", regex=True)
    s = s.str.replace(r"\s+", " ", regex=True).str.strip()
    return s.mask(s.eq(""), pd.NA)


def _derive_preferred_titles(df: pd.DataFrame) -> pd.DataFrame:
    """
    Pick one canonical occupation title per 6-digit code.
    Australian principal titles are preferred, then generic principal titles,
    then New Zealand principal titles, then non-principal variants.
    """
    title_priority = {
        "principal": 0,
        "alternative": 1,
        "specialisation": 2,
        "nec_category": 3,
    }
    scope_priority = {
        "Australia": 0,
        "Generic": 1,
        "New Zealand": 2,
    }

    ranked = df.assign(
        _title_priority=df["title_type"].map(title_priority).fillna(9),
        _scope_priority=df["jurisdiction_scope"].map(scope_priority).fillna(9),
    )
    preferred = (
        ranked.sort_values(
            ["anzsco_code", "_title_priority", "_scope_priority", "occupation_title"],
            kind="stable",
        )
        .drop_duplicates("anzsco_code")
        .rename(
            columns={
                "occupation_title": "preferred_occupation_title",
                "title_type": "preferred_title_type",
                "jurisdiction_scope": "preferred_jurisdiction_scope",
            }
        )
    )
    return preferred[
        [
            "anzsco_code",
            "preferred_occupation_title",
            "preferred_title_type",
            "preferred_jurisdiction_scope",
        ]
    ]


def run():
    logger = get_logger(DATASET, LOG_DIR)
    tlog = TransformationLog(DATASET)
    src = RAW_FILES[DATASET]
    cfg = ANZSCO_REFERENCE_CFG

    # ── 1. DISCOVER ──────────────────────────────────────────────────────────
    logger.info("=== STEP 1: DISCOVER ===")
    raw_preview = pd.read_excel(
        src,
        sheet_name=cfg["sheet"],
        header=None,
        nrows=15,
        engine="calamine",
    )
    run_profile(
        raw_preview,
        f"[RAW] {DATASET}",
        PROFILE_DIR / f"raw_{DATASET}.html",
        minimal=PROFILE_SETTINGS["minimal"],
    )

    # ── 2. STRUCTURE — load title index table ───────────────────────────────
    logger.info("=== STEP 2: STRUCTURE ===")
    df_raw = _read_reference_table(src, cfg)
    tlog.record("load", f"Read {cfg['sheet']} from {src.name}", rows_after=len(df_raw))

    # ── 3. CLEAN ─────────────────────────────────────────────────────────────
    logger.info("=== STEP 3: CLEAN ===")
    df = clean_headers(df_raw, rename_map={"Code": "anzsco_code", "Title": "raw_title"})
    df = drop_empty_rows_cols(df, logger, tlog, empty_threshold=0.95)
    df = drop_rows_missing_key(df, ["anzsco_code"], logger, tlog)
    df = cast_numeric_cols(df, ["anzsco_code"], logger, tlog)
    df["anzsco_code"] = df["anzsco_code"].astype("Int64")
    df = df[df["raw_title"].notna()].copy()

    df["raw_title"] = df["raw_title"].astype("string").str.strip()
    df["title_type_code"] = df["raw_title"].str.extract(r"\(([PASN])\)\s*$")[0]
    df["title_type"] = df["title_type_code"].map(ANZSCO_TITLE_TYPE_MAP)
    df["jurisdiction_scope"] = (
        df["raw_title"]
        .str.extract(r"\((Aus|NZ)\)")[0]
        .map({"Aus": "Australia", "NZ": "New Zealand"})
        .fillna("Generic")
    )
    df["occupation_title"] = _clean_title_text(df["raw_title"])
    df["normalised_title"] = normalise_anzsco_title_series(df["occupation_title"])

    df["major_group_code"] = pd.to_numeric(df["anzsco_code"].astype("string").str[:1], errors="coerce").astype("Int64")
    df["sub_major_group_code"] = pd.to_numeric(df["anzsco_code"].astype("string").str[:2], errors="coerce").astype("Int64")
    df["minor_group_code"] = pd.to_numeric(df["anzsco_code"].astype("string").str[:3], errors="coerce").astype("Int64")
    df["unit_group_code"] = pd.to_numeric(df["anzsco_code"].astype("string").str[:4], errors="coerce").astype("Int64")
    df["major_group_label"] = df["major_group_code"].map(ANZSCO_MAJOR_GROUP_LABELS)

    preferred = _derive_preferred_titles(df)
    df = df.merge(preferred, on="anzsco_code", how="left")
    df["is_preferred_title"] = df["occupation_title"].eq(df["preferred_occupation_title"])

    df = remove_duplicates(
        df,
        subset=["anzsco_code", "occupation_title", "title_type", "jurisdiction_scope"],
        logger=logger,
        tlog=tlog,
    )

    # ── 4. VALIDATE ──────────────────────────────────────────────────────────
    logger.info("=== STEP 4: VALIDATE ===")
    report_missing(df, logger)
    issues = validate_dataset(df, VALIDATION_RULES.get(DATASET, {}), DATASET, logger)
    tlog.record("validate", f"{len(issues)} issues", details={"issues": issues})

    # ── 5. PROFILE ───────────────────────────────────────────────────────────
    logger.info("=== STEP 5: PROFILE ===")
    run_profile(
        df,
        f"[CLEAN] {DATASET}",
        PROFILE_DIR / f"clean_{DATASET}.html",
        minimal=PROFILE_SETTINGS["minimal"],
    )

    # ── 6. PUBLISH ───────────────────────────────────────────────────────────
    logger.info("=== STEP 6: PUBLISH ===")
    save_parquet(df, SILVER_FILES[DATASET], logger, tlog)
    audit_path = tlog.save(LOG_DIR)
    logger.info(f"Audit log → {audit_path}")
    return df


if __name__ == "__main__":
    run()

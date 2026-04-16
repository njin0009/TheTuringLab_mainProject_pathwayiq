"""
healthcheck_pipeline.py — End-to-end pipeline health check
===========================================================
Runs preflight checks, executes the full wrangling pipeline, exports CSVs,
audits cleaned outputs, and writes a machine-readable health report.

Scope:
- Includes the wrangling pipeline, logs, profiles, silver, and cleaned_data
- Excludes api/ and database/ by design
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import pandas as pd

import run_pipeline
from audit_cleaned_data import run as run_cleaned_audit
from config import CLEANED_DIR, LOG_DIR, PROFILE_DIR, RAW_FILES, SILVER_DIR
from utils.wrangling_utils import get_logger


EXPECTED_SILVER_FILES = [
    "clean_osl_filtered.parquet",
    "clean_osl_full.parquet",
    "clean_anzsco_reference.parquet",
    "clean_osd.parquet",
    "clean_vet_outcomes.parquet",
    "clean_vet_outcomes_occ_long.parquet",
    "clean_vet_outcomes_ind_long.parquet",
    "clean_vnda.parquet",
    "clean_vnda_course_metrics.parquet",
    "clean_vnda_course_occupations.parquet",
    "clean_vnda_qual_by_occ.parquet",
    "clean_vnda_national.parquet",
    "clean_vnda_state.parquet",
    "clean_vnda_aqf.parquet",
    "clean_vnda_aqf_foe_national.parquet",
    "clean_vnda_aqf_foe_state.parquet",
    "clean_seuv.parquet",
    "clean_seuv_overall.parquet",
    "clean_seuv_state_territory.parquet",
    "clean_seuv_employer_size.parquet",
    "clean_seuv_industry.parquet",
    "clean_seuv_training_type.parquet",
    "clean_apprentices.parquet",
]

EXPECTED_CSV_FILES = [name.replace(".parquet", ".csv") for name in EXPECTED_SILVER_FILES]


def _file_status(base_dir: Path, filenames: list[str]) -> list[dict]:
    """Report existence and size for a set of expected files."""
    statuses = []
    for filename in filenames:
        path = base_dir / filename
        statuses.append({
            "base_dir": str(base_dir),
            "filename": filename,
            "exists": path.exists(),
            "size_kb": round(path.stat().st_size / 1024, 1) if path.exists() else None,
        })
    return statuses


def run() -> dict:
    logger = get_logger("pipeline_healthcheck", LOG_DIR)
    logger.info("Starting end-to-end pipeline healthcheck")

    summary_df = run_pipeline.run_pipeline(export_csv=True, audit_cleaned=False)
    audit_outputs = run_cleaned_audit()

    raw_status = [
        {"dataset": dataset, "path": str(path), "exists": path.exists()}
        for dataset, path in RAW_FILES.items()
    ]
    silver_status = _file_status(SILVER_DIR, EXPECTED_SILVER_FILES)
    csv_status = _file_status(CLEANED_DIR, EXPECTED_CSV_FILES)

    report = {
        "generated_at": datetime.now().isoformat(),
        "scope": "pathwayiq-Data Pipeline (excluding api/ and database/)",
        "raw_files": raw_status,
        "silver_outputs": silver_status,
        "cleaned_csv_outputs": csv_status,
        "pipeline_summary_rows": summary_df.to_dict(orient="records"),
        "audit_outputs": {key: str(value) for key, value in audit_outputs.items()},
        "directories": {
            "silver_dir": str(SILVER_DIR),
            "cleaned_dir": str(CLEANED_DIR),
            "profile_dir": str(PROFILE_DIR),
            "log_dir": str(LOG_DIR),
        },
    }

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = LOG_DIR / f"pipeline_healthcheck_{stamp}.json"
    csv_path = LOG_DIR / f"pipeline_healthcheck_files_{stamp}.csv"

    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    pd.DataFrame(raw_status + silver_status + csv_status).to_csv(csv_path, index=False)

    logger.info(f"Healthcheck report saved → {json_path}")
    logger.info(f"Healthcheck file inventory saved → {csv_path}")
    return {"json_path": json_path, "csv_path": csv_path}


if __name__ == "__main__":
    run()

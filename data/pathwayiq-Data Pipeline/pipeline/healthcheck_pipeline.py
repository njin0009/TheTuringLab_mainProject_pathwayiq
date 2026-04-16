"""
healthcheck_pipeline.py — End-to-end pipeline health check
===========================================================
Runs preflight checks, executes the full wrangling pipeline when possible,
audits cleaned outputs, and writes a machine-readable health report.

Scope:
- Includes the wrangling pipeline, logs, profiles, silver, and cleaned_data
- Excludes api/ and database/ by design

The healthcheck is intentionally defensive: it should produce a useful
diagnostic report even when optional dependencies or raw files are missing.
"""

from __future__ import annotations

import csv
import importlib
import json
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any


PIPELINE_DIR = Path(__file__).parent
if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))

EXPECTED_SILVER_OUTPUTS = {
    "osl_filtered": ["clean_osl_filtered.parquet"],
    "osl_full": ["clean_osl_full.parquet"],
    "anzsco_reference": ["clean_anzsco_reference.parquet"],
    "osd": ["clean_osd.parquet"],
    "vet_outcomes": [
        "clean_vet_outcomes.parquet",
        "clean_vet_outcomes_occ_long.parquet",
        "clean_vet_outcomes_ind_long.parquet",
    ],
    "vnda": [
        "clean_vnda.parquet",
        "clean_vnda_course_metrics.parquet",
        "clean_vnda_course_occupations.parquet",
        "clean_vnda_qual_by_occ.parquet",
        "clean_vnda_national.parquet",
        "clean_vnda_state.parquet",
        "clean_vnda_aqf.parquet",
        "clean_vnda_aqf_foe_national.parquet",
        "clean_vnda_aqf_foe_state.parquet",
    ],
    "seuv": [
        "clean_seuv.parquet",
        "clean_seuv_overall.parquet",
        "clean_seuv_state_territory.parquet",
        "clean_seuv_employer_size.parquet",
        "clean_seuv_industry.parquet",
        "clean_seuv_training_type.parquet",
    ],
    "apprentices": ["clean_apprentices.parquet"],
}
EXPECTED_SILVER_FILES = [
    filename
    for dataset_files in EXPECTED_SILVER_OUTPUTS.values()
    for filename in dataset_files
]
EXPECTED_CSV_FILES = [Path(name).with_suffix(".csv").name for name in EXPECTED_SILVER_FILES]


class _FallbackLogger:
    def info(self, message: str) -> None:
        print(message)

    def warning(self, message: str) -> None:
        print(message)

    def error(self, message: str) -> None:
        print(message)


def _safe_import(module_name: str) -> tuple[Any | None, str | None]:
    try:
        return importlib.import_module(module_name), None
    except Exception as exc:  # pragma: no cover - diagnostic path
        return None, f"{type(exc).__name__}: {exc}"


def _runtime_context() -> dict[str, Any]:
    context: dict[str, Any] = {"dependency_status": {}}

    pandas_mod, pandas_error = _safe_import("pandas")
    context["pandas"] = pandas_mod
    context["dependency_status"]["pandas"] = {
        "available": pandas_mod is not None,
        "error": pandas_error,
    }

    config_mod, config_error = _safe_import("config")
    context["config"] = config_mod
    context["dependency_status"]["config"] = {
        "available": config_mod is not None,
        "error": config_error,
    }

    run_pipeline_mod, run_pipeline_error = _safe_import("run_pipeline")
    context["run_pipeline"] = run_pipeline_mod
    context["dependency_status"]["run_pipeline"] = {
        "available": run_pipeline_mod is not None,
        "error": run_pipeline_error,
    }

    audit_mod, audit_error = _safe_import("audit_cleaned_data")
    context["audit_cleaned_data"] = audit_mod
    context["dependency_status"]["audit_cleaned_data"] = {
        "available": audit_mod is not None,
        "error": audit_error,
    }

    utils_mod, utils_error = _safe_import("utils.wrangling_utils")
    context["dependency_status"]["wrangling_utils"] = {
        "available": utils_mod is not None,
        "error": utils_error,
    }

    get_logger = getattr(utils_mod, "get_logger", None) if utils_mod else None
    context["logger_factory"] = get_logger

    if config_mod:
        context["cleaned_dir"] = getattr(config_mod, "CLEANED_DIR", PIPELINE_DIR.parent / "cleaned_data")
        context["log_dir"] = getattr(config_mod, "LOG_DIR", PIPELINE_DIR / "logs")
        context["profile_dir"] = getattr(config_mod, "PROFILE_DIR", PIPELINE_DIR / "profiles")
        context["silver_dir"] = getattr(config_mod, "SILVER_DIR", PIPELINE_DIR / "silver")
        context["raw_files"] = getattr(config_mod, "RAW_FILES", {})
    else:
        context["cleaned_dir"] = PIPELINE_DIR.parent / "cleaned_data"
        context["log_dir"] = PIPELINE_DIR / "logs"
        context["profile_dir"] = PIPELINE_DIR / "profiles"
        context["silver_dir"] = PIPELINE_DIR / "silver"
        context["raw_files"] = {}

    return context


def _get_logger(log_dir: Path, logger_factory: Any | None):
    if logger_factory is None:
        return _FallbackLogger()
    try:
        return logger_factory("pipeline_healthcheck", log_dir)
    except Exception:  # pragma: no cover - diagnostic path
        return _FallbackLogger()


def _ensure_writable_dir(path: Path, fallback_leaf: str) -> Path:
    try:
        path.mkdir(parents=True, exist_ok=True)
        return path
    except OSError:  # pragma: no cover - sandbox / permission fallback
        fallback = Path(tempfile.gettempdir()) / "pathwayiq_pipeline_healthcheck" / fallback_leaf
        fallback.mkdir(parents=True, exist_ok=True)
        return fallback


def _file_status(base_dir: Path, filenames: list[str]) -> list[dict[str, Any]]:
    statuses = []
    for filename in filenames:
        path = base_dir / filename
        suffix = Path(filename).suffix.lower()
        statuses.append(
            {
                "base_dir": str(base_dir),
                "filename": filename,
                "exists": path.exists(),
                "expected_format": suffix.lstrip("."),
                "size_kb": round(path.stat().st_size / 1024, 1) if path.exists() else None,
            }
        )
    return statuses


def _write_inventory_csv(rows: list[dict[str, Any]], csv_path: Path, pandas_mod: Any | None) -> None:
    if pandas_mod is not None:
        pandas_mod.DataFrame(rows).to_csv(csv_path, index=False)
        return

    fieldnames = sorted({key for row in rows for key in row.keys()})
    with csv_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def run() -> dict[str, Path]:
    context = _runtime_context()
    log_dir: Path = context["log_dir"]
    cleaned_dir: Path = context["cleaned_dir"]
    profile_dir: Path = context["profile_dir"]
    silver_dir: Path = context["silver_dir"]
    raw_files: dict[str, Path] = context["raw_files"]
    pandas_mod = context["pandas"]

    log_dir = _ensure_writable_dir(log_dir, "logs")

    logger = _get_logger(log_dir, context["logger_factory"])
    logger.info("Starting end-to-end pipeline healthcheck")

    pipeline_summary_rows: list[dict[str, Any]] = []
    audit_outputs: dict[str, str] = {}
    pipeline_run_error: str | None = None
    audit_error: str | None = None

    run_pipeline_mod = context["run_pipeline"]
    if run_pipeline_mod and hasattr(run_pipeline_mod, "run_pipeline"):
        try:
            summary_df = run_pipeline_mod.run_pipeline(export_csv=True, audit_cleaned=False)
            if hasattr(summary_df, "to_dict"):
                pipeline_summary_rows = summary_df.to_dict(orient="records")
        except Exception as exc:  # pragma: no cover - diagnostic path
            pipeline_run_error = f"{type(exc).__name__}: {exc}"
            logger.error(f"Pipeline execution failed: {pipeline_run_error}")
    else:
        run_pipeline_error = context["dependency_status"]["run_pipeline"]["error"]
        pipeline_run_error = run_pipeline_error or "run_pipeline module unavailable"
        logger.warning(f"Pipeline execution skipped: {pipeline_run_error}")

    audit_mod = context["audit_cleaned_data"]
    run_cleaned_audit = getattr(audit_mod, "run", None) if audit_mod else None
    if run_cleaned_audit is not None:
        try:
            audit_outputs = {key: str(value) for key, value in run_cleaned_audit().items()}
        except Exception as exc:  # pragma: no cover - diagnostic path
            audit_error = f"{type(exc).__name__}: {exc}"
            logger.error(f"Cleaned-data audit failed: {audit_error}")
    else:
        audit_error = context["dependency_status"]["audit_cleaned_data"]["error"] or "audit_cleaned_data.run unavailable"
        logger.warning(f"Cleaned-data audit skipped: {audit_error}")

    raw_status = [
        {"dataset": dataset, "path": str(path), "exists": path.exists()}
        for dataset, path in raw_files.items()
    ]
    silver_status = _file_status(silver_dir, EXPECTED_SILVER_FILES)
    csv_status = _file_status(cleaned_dir, EXPECTED_CSV_FILES)

    report = {
        "generated_at": datetime.now().isoformat(),
        "scope": "pathwayiq-Data Pipeline (excluding api/ and database/)",
        "dependency_status": context["dependency_status"],
        "pipeline_run_error": pipeline_run_error,
        "audit_error": audit_error,
        "raw_files": raw_status,
        "silver_outputs": silver_status,
        "cleaned_csv_outputs": csv_status,
        "pipeline_summary_rows": pipeline_summary_rows,
        "audit_outputs": audit_outputs,
        "directories": {
            "silver_dir": str(silver_dir),
            "cleaned_dir": str(cleaned_dir),
            "profile_dir": str(profile_dir),
            "log_dir": str(log_dir),
        },
    }

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = log_dir / f"pipeline_healthcheck_{stamp}.json"
    csv_path = log_dir / f"pipeline_healthcheck_files_{stamp}.csv"

    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    _write_inventory_csv(raw_status + silver_status + csv_status, csv_path, pandas_mod)

    logger.info(f"Healthcheck report saved -> {json_path}")
    logger.info(f"Healthcheck file inventory saved -> {csv_path}")
    return {"json_path": json_path, "csv_path": csv_path}


if __name__ == "__main__":
    run()

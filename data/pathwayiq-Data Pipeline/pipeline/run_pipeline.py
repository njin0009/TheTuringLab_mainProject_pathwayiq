"""
run_pipeline.py — TA28 Data Group Full Pipeline Orchestrator
=============================================================
Runs all cleaning scripts in dependency order:

  01 → osl_filtered   (master ANZSCO lookup — must run first)
  02 → osl_full
  08 → anzsco_reference (authoritative ANZSCO title index)
  03 → osd
  04 → vet_outcomes
  05 → vnda           (depends on ANZSCO reference for occupation enrichment)
  06 → seuv
  07 → apprentices

Usage
-----
  python run_pipeline.py                    # run all
  python run_pipeline.py --only osl_filtered osd   # run specific datasets
  python run_pipeline.py --skip seuv        # skip specific datasets

After all scripts complete, prints a summary table of:
  - Silver file produced
  - Row count
  - Column count
  - File size
  - Validation issues
  - ANZSCO coverage %
"""

import argparse
import py_compile
import sys
import time
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))

from config import SILVER_FILES, LOG_DIR, CLEANED_DIR, RAW_FILES, PROFILE_DIR
from utils.wrangling_utils import get_logger

# Ordered run sequence
PIPELINE_ORDER = [
    ("osl_filtered",  "01_clean_osl_filtered"),
    ("osl_full",      "02_clean_osl_full"),
    ("anzsco_reference", "08_clean_anzsco_reference"),
    ("osd",           "03_clean_osd"),
    ("vet_outcomes",  "04_clean_vet_outcomes"),
    ("vnda",          "05_clean_vnda"),
    ("seuv",          "06_clean_seuv"),
    ("apprentices",   "07_clean_apprentices"),
]


def _import_module(module_name: str):
    import importlib
    return importlib.import_module(module_name)


def _silver_stats(dataset_key: str) -> dict:
    """Read the silver parquet and compute summary stats."""
    path = SILVER_FILES.get(dataset_key)
    stats = {"path": str(path), "exists": False,
             "rows": None, "cols": None, "size_kb": None,
             "anzsco_coverage_pct": None}
    if path and path.exists():
        stats["exists"] = True
        df = pd.read_parquet(path)
        stats["rows"] = len(df)
        stats["cols"] = df.shape[1]
        stats["size_kb"] = round(path.stat().st_size / 1024, 1)
        if "anzsco_code" in df.columns:
            stats["anzsco_coverage_pct"] = round(
                df["anzsco_code"].notna().mean() * 100, 1)
    stats["path"] = f"cleaned_data/{path.name}" if path else None
    return stats


def _ensure_runtime_dirs() -> None:
    """Create the runtime directories needed for reproducible pipeline runs."""
    for path in (LOG_DIR, PROFILE_DIR, CLEANED_DIR):
        path.mkdir(parents=True, exist_ok=True)


def _preflight_check(logger,
                     run_these: list[str] | None = None,
                     skip_these: list[str] | None = None) -> tuple[list[dict], set[str]]:
    """
    Validate the pipeline environment before running:
    - raw files exist for datasets that are actually going to run
    - pipeline Python sources compile

    Returns:
        (checks, missing_raw_set)
    """
    _ensure_runtime_dirs()
    checks: list[dict] = []

    datasets_to_run = []
    for dataset_key, _ in PIPELINE_ORDER:
        if run_these and dataset_key not in run_these:
            continue
        if skip_these and dataset_key in skip_these:
            continue
        datasets_to_run.append(dataset_key)

    missing_raw = sorted(
        dataset
        for dataset in datasets_to_run
        if dataset in RAW_FILES and not RAW_FILES[dataset].exists()
    )
    missing_raw_set = set(missing_raw)

    checks.append({
        "check": "raw_files_present",
        "status": "OK" if not missing_raw else "WARNING",
        "details": {
            "checked_datasets": datasets_to_run,
            "missing_datasets": missing_raw,
            "missing_paths": {
                dataset: str(RAW_FILES[dataset])
                for dataset in missing_raw
                if dataset in RAW_FILES
            },
        },
    })
    if missing_raw:
        logger.warning(
            "Missing raw files for datasets that would run: %s. "
            "These datasets will be skipped.",
            missing_raw,
        )

    pipeline_dir = Path(__file__).parent
    py_files = [
        path for path in pipeline_dir.rglob("*.py")
        if "__pycache__" not in path.parts
    ]
    compile_errors = []
    for path in py_files:
        try:
            py_compile.compile(str(path), doraise=True)
        except py_compile.PyCompileError as exc:
            compile_errors.append({"path": str(path), "error": str(exc)})

    checks.append({
        "check": "python_compile",
        "status": "OK" if not compile_errors else "ERROR",
        "details": {"checked_files": len(py_files), "errors": compile_errors},
    })
    if compile_errors:
        raise RuntimeError(f"Python compile preflight failed for {len(compile_errors)} files.")

    logger.info(
        f"Preflight checks completed ({len(py_files)} Python files compiled, "
        f"{len(datasets_to_run)} datasets checked)."
    )
    return checks, missing_raw_set


def export_parquet_to_csv():
    import pandas as pd

    PIPELINE_DIR = Path(__file__).parent
    SILVER_DIR = PIPELINE_DIR / "silver"
    CLEANED_DIR.mkdir(parents=True, exist_ok=True)

    print("\n=== EXPORTING PARQUET → CSV ===")

    exported = []
    for file in SILVER_DIR.glob("*.parquet"):
        df = pd.read_parquet(file)
        output_file = CLEANED_DIR / (file.stem + ".csv")
        df.to_csv(output_file, index=False)
        print(f"✓ {file.name} → {output_file.name}")
        exported.append(output_file)

    print("=== CSV EXPORT COMPLETE ===")
    return exported


def run_pipeline(run_these: list[str] | None = None,
                 skip_these: list[str] | None = None, 
                 export_csv: bool = False,
                 audit_cleaned: bool = False):

    logger = get_logger("pipeline_orchestrator", LOG_DIR)
    logger.info("=" * 60)
    logger.info("TA28 DATA GROUP PIPELINE — START")
    logger.info("=" * 60)
    preflight_checks, missing_raw = _preflight_check(
        logger,
        run_these=run_these,
        skip_these=skip_these,
    )

    results = {}
    total_start = time.time()

    for dataset_key, module_name in PIPELINE_ORDER:
        if run_these and dataset_key not in run_these:
            logger.info(f"SKIP  {dataset_key} (not in --only list)")
            continue
        if skip_these and dataset_key in skip_these:
            logger.info(f"SKIP  {dataset_key} (in --skip list)")
            continue
        if dataset_key in missing_raw:
            logger.warning(f"SKIP  {dataset_key} (raw file missing: {RAW_FILES[dataset_key]})")
            results[dataset_key] = {"status": "SKIPPED: missing raw file", "elapsed_s": 0.0}
            continue

        logger.info(f"\n{'─'*60}")
        logger.info(f"RUNNING: {module_name}")
        logger.info(f"{'─'*60}")

        t0 = time.time()
        try:
            mod = _import_module(module_name)
            mod.run()
            elapsed = round(time.time() - t0, 1)
            results[dataset_key] = {"status": "OK", "elapsed_s": elapsed}
            logger.info(f"✓ {dataset_key} completed in {elapsed}s")
        except Exception as exc:
            elapsed = round(time.time() - t0, 1)
            results[dataset_key] = {"status": f"ERROR: {exc}", "elapsed_s": elapsed}
            logger.error(f"✗ {dataset_key} FAILED: {exc}")

    total_elapsed = round(time.time() - total_start, 1)

    logger.info("\n" + "=" * 70)
    logger.info("PIPELINE SUMMARY")
    logger.info("=" * 70)

    summary_rows = []
    for dataset_key, _ in PIPELINE_ORDER:
        if dataset_key not in results:
            continue
        run_info = results[dataset_key]
        stats = _silver_stats(dataset_key)
        summary_rows.append({
            "Dataset":         dataset_key,
            "Status":          run_info["status"],
            "Time(s)":         run_info["elapsed_s"],
            "Rows":            stats["rows"],
            "Cols":            stats["cols"],
            "Size(KB)":        stats["size_kb"],
            "ANZSCO_cov%":     stats["anzsco_coverage_pct"],
        })

    summary_df = pd.DataFrame(summary_rows)
    logger.info("\n" + summary_df.to_string(index=False))
    logger.info(f"\nTotal pipeline time: {total_elapsed}s")

    summary_path = LOG_DIR / "pipeline_summary.csv"
    summary_df.to_csv(summary_path, index=False)
    logger.info(f"Summary saved → {summary_path}")

    # Export CSVs after pipeline completes
    audit_outputs = None
    if export_csv:
        exported_csvs = export_parquet_to_csv()
        logger.info(f"Exported {len(exported_csvs)} cleaned CSV files → {CLEANED_DIR}")

    if audit_cleaned:
        import audit_cleaned_data

        audit_outputs = audit_cleaned_data.run()
        logger.info(f"Cleaned-data audit complete → {audit_outputs['summary_path']}")

    preflight_path = LOG_DIR / "pipeline_preflight_checks.csv"
    pd.DataFrame(preflight_checks).to_csv(preflight_path, index=False)
    logger.info(f"Preflight summary saved → {preflight_path}")

    return summary_df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TA28 Data Group Wrangling Pipeline")
    parser.add_argument(
        "--only", nargs="+", metavar="DATASET",
        help=f"Run only these datasets: {[k for k,_ in PIPELINE_ORDER]}"
    )
    parser.add_argument(
        "--skip", nargs="+", metavar="DATASET",
        help="Skip these datasets"
    )
    parser.add_argument(
        "--export-csv",
        action="store_true",
        help="Export silver parquet files to CSV"
    )
    parser.add_argument(
        "--audit-cleaned",
        action="store_true",
        help="Audit exported cleaned CSV files after the run"
    )
    args = parser.parse_args()

    run_pipeline(
        run_these=args.only,
        skip_these=args.skip,
        export_csv=args.export_csv,
        audit_cleaned=args.audit_cleaned,
    )

# TA28 Data Group — Data Wrangling Pipeline

## Purpose

A set of modular Python/Pandas scripts that clean the TA28 raw datasets
into analysis-ready **Silver** Parquet files, with:

- YData Profiling at discovery and post-clean stages
- A structured audit trail (JSON log) for every transformation
- ANZSCO 6-digit code as the universal joining key wherever applicable
- All transformations driven by `config.py` — no hardcoded values in scripts
- Deterministic model benchmarking for VET income imputation
- End-to-end health checks for the wrangling pipeline, logs, profiles, and outputs

---

## Directory layout

```
pathwayiq-Data Pipeline/
├── raw_data/                  ← raw TA28 workbooks / CSVs
├── cleaned_data/              ← exported clean CSVs
├── docs/                      ← supporting documentation
└── pipeline/
    ├── config.py                  ← settings, paths, renames, rules
    ├── run_pipeline.py            ← orchestrator
    ├── healthcheck_pipeline.py    ← end-to-end pipeline QA runner
    ├── audit_cleaned_data.py      ← post-export CSV audit
    ├── 01_clean_osl_filtered.py
    ├── 02_clean_osl_full.py
    ├── 03_clean_osd.py
    ├── 04_clean_vet_outcomes.py
    ├── 05_clean_vnda.py
    ├── 06_clean_seuv.py
    ├── 07_clean_apprentices.py
    ├── 08_clean_anzsco_reference.py
    ├── utils/
    │   ├── __init__.py
    │   └── wrangling_utils.py
    ├── silver/                    ← clean parquet outputs
    ├── profiles/                  ← profiling outputs
    └── logs/                      ← audit logs, summaries, model reports
```

---

## Setup

### 1 — Python environment

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install pandas pyarrow openpyxl ydata-profiling rapidfuzz scikit-learn
```

> `rapidfuzz` is optional but strongly recommended — it powers fuzzy
> ANZSCO matching for datasets that only have occupation title strings
> (OSD, VNDA qualification-by-occupation sheet).

### 2 — Place raw files

Ensure the raw files are in `raw_data/`, or update `RAW_DIR` in `config.py`
if your local folder is different.

### 3 — Run the full pipeline

```bash
cd ta28_pipeline
python run_pipeline.py --export-csv --audit-cleaned
```

This runs the full wrangling stack in dependency order, exports the
cleaned CSVs, and audits the final outputs.

### 4 — Run individual scripts

```bash
python 01_clean_osl_filtered.py   # master lookup — run this first
python 03_clean_osd.py            # enriches via OSL lookup
```

### 5 — Run selective datasets

```bash
python run_pipeline.py --only osl_filtered osd vnda --export-csv
python run_pipeline.py --skip seuv apprentices
python healthcheck_pipeline.py
```

---

## What each script produces

| Script | Input | Silver output | Key join key |
|--------|-------|---------------|--------------|
| 01 | OSL filtered CSV | `clean_osl_filtered.parquet` | `anzsco_code` (native) |
| 02 | OSL full XLSX | `clean_osl_full.parquet` | `anzsco_code` (native) |
| 03 | OSD XLSX | `clean_osd.parquet` | `anzsco_code` (fuzzy-matched) |
| 04 | VET outcomes XLSX | `clean_vet_outcomes.parquet` + `_occ_long.parquet` + `_ind_long.parquet` | `anzsco_major_group_code` (1-digit) |
| 05 | VNDA XLSX | `clean_vnda.parquet` + `clean_vnda_qual_by_occ.parquet` | `anzsco_code` (fuzzy on qual×occ sheet) |
| 06 | SEUV XLSX | `clean_seuv.parquet` | n/a — employer survey (state/industry level) |
| 07 | Apprentices XLSX | `clean_apprentices.parquet` | n/a — aggregate state/contract level |

---

## ANZSCO joining strategy

Every Silver file that can carry a 6-digit ANZSCO code does so.

**Datasets with native codes (01, 02):**
The raw data already contains numeric ANZSCO codes.  Scripts cast them
to `Int64` (nullable integer) and validate the range 100000–999999.

**Datasets with occupation title strings (03, 05):**
1. `01_clean_osl_filtered.py` must run first to produce the OSL lookup.
2. `build_anzsco_lookup()` in `wrangling_utils.py` builds a normalised
   `title → code` lookup from the OSL.
3. `exact_match_anzsco()` does a normalised string join (lower + strip +
   remove punctuation).
4. `fuzzy_match_anzsco()` uses `rapidfuzz.token_sort_ratio` on residuals.
   The threshold (default 80/100) is set in `config.py`.
5. `merge_anzsco_cols()` combines both into a single `anzsco_code` column.

**Datasets at aggregate level (06, 07):**
These collect data by employer or by state/contract_type — not by
occupation.  They carry an `anzsco_join_note` column explaining this
so downstream analysts are not confused.

**VET outcomes (04):**
Top-3 occupation columns contain ANZSCO major group labels (e.g.
"Labourers"). These are mapped to 1-digit `anzsco_major_group_code`
using `ANZSCO_MAJOR_GROUP_MAP` in `config.py`.

For `median_annual_income`, the pipeline now uses a hybrid strategy:
1. Hard business rules first:
   - `Certificate I` rows are treated as structural non-vocational cases.
   - Their industries are set to `Foundation/Non-Vocational`.
   - Their income remains null.
2. Candidate imputers are benchmarked on known non-structural rows with
   cross-validated `MAE`, `RMSE`, and `R²`.
3. The best-performing candidate is selected deterministically and used
   only for the remaining non-structural missing incomes.
4. Every run writes the benchmark report to `logs/`.

---

## How to adapt to a new data release

Because no transformation logic is hardcoded, adapting to a new annual
release requires only changes to `config.py`:

1. Update `RAW_FILES` paths to point to the new file names.
2. If any column was renamed in the new release, update the relevant
   `*_RENAME` dict (e.g. `OSL_FILTERED_RENAME`).
3. If a new shortage rating category was introduced, add it to
   `SHORTAGE_RATING_MAP` and `SHORTAGE_RATING_ORDER`.
4. If a new OSD table was added, append it to `OSD_TABLES_CFG`.
5. Re-run `python run_pipeline.py`.

---

## Outputs explained

### Silver Parquet files
Parquet is used instead of CSV because:
- Preserves column dtypes (Int64, Categorical, datetime) exactly.
- ~5–10× smaller file size than CSV for this data.
- Faster to load in pandas, Spark, DuckDB, and BI tools.

To read into pandas:
```python
import pandas as pd
osl = pd.read_parquet("silver/clean_osl_filtered.parquet")
osd = pd.read_parquet("silver/clean_osd.parquet")

# Join by ANZSCO code
merged = osl.merge(osd, on="anzsco_code", how="left")
```

### YData Profiling HTML reports
Two reports per dataset — one for the raw data and one post-cleaning.
Open in any browser:
```bash
open profiles/raw_osl_filtered.html
open profiles/clean_osl_filtered.html
```

The reports show: missing value matrix, distribution of each column,
correlation heatmap, and duplicate detection.

### Audit logs
Each script writes a JSON audit log to `logs/audit_{dataset}_{timestamp}.json`.
Each step in the log records:
- `step` name
- `description` of the transformation
- `rows_before` / `rows_after`
- `cols_before` / `cols_after`
- `details` dict (e.g. which columns were dropped, imputation values used)

This satisfies the **Traceability and Reproducibility** requirement —
every mutation is documented and the pipeline is fully re-runnable.

Additional operational logs now include:
- `pipeline_summary.csv`
- `pipeline_preflight_checks.csv`
- `vet_outcomes_income_model_benchmark_*.csv`
- `vet_outcomes_income_model_benchmark_*.json`
- `cleaned_data_audit_*.json/csv`

### Health check
Run a full operational check for the wrangling project with:

```bash
python healthcheck_pipeline.py
```

This verifies:
- raw files exist
- Python pipeline modules compile
- the full wrangling pipeline runs
- CSV exports are produced
- cleaned outputs pass the audit step
- logs, profiles, silver, and cleaned-data folders are populated

---

## Relational database and frontend publish layer

The cleaned CSV outputs can now be turned into a **Cloudflare D1-compatible relational database** and a smaller set of **frontend CSV exports**.

From the repository root:

```bash
python3 "data/pathwayiq-Data Pipeline/database/build_d1_database.py"
```

This creates:

- `data/pathwayiq-Data Pipeline/database/build/pathwayiq.sqlite`
- `data/pathwayiq-Data Pipeline/database/build/pathwayiq_d1_import.sql`
- `data/pathwayiq-Data Pipeline/frontend_exports/occupations.csv`
- `data/pathwayiq-Data Pipeline/frontend_exports/programs.csv`
- `data/pathwayiq-Data Pipeline/frontend_exports/pathways.csv`

See `data/pathwayiq-Data Pipeline/database/README.md` for the D1 schema, quality controls, and Cloudflare publish steps.

---

## The V-Model quality gates

| V-Model Stage | Implemented by |
|---------------|----------------|
| Discovery (Profiling) | `run_profile()` called before any cleaning |
| Structuring | `read_excel_with_dynamic_header()`, `melt_timeseries()`, `_build_occupation_columns()` |
| Cleaning | `drop_empty_rows_cols()`, `remove_duplicates()`, `cast_numeric_cols()`, `apply_value_map()`, `standardise_text_col()` |
| Enriching | `exact_match_anzsco()`, `fuzzy_match_anzsco()`, derived `major_group_code`, `abs_pct_error` |
| Validation | `validate_dataset()` applied after cleaning in every script |
| Publishing | `save_parquet()` + audit log JSON |

# PathwayIQ Relational Database

This folder turns the cleaned CSV pipeline into a **Cloudflare D1-ready relational database** and then publishes **frontend-sized CSV exports** for Cloudflare R2.

## Why this design

The schema follows the database design lifecycle used in your workshop material and textbook:

- **Requirements to structure**: datasets are grouped by business subject, not by file convenience.
- **Normalization**: `program_occupation_pathway` resolves the many-to-many relationship between courses and occupations; `occupation_title_alias` separates repeatable ANZSCO title aliases from the core occupation record.
- **Entity integrity**: primary keys are mandatory and unique.
- **Referential integrity**: foreign keys connect facts to shared dimensions such as occupations, states, AQF levels, and survey tables.
- **Domain integrity**: `CHECK` constraints enforce 6-digit ANZSCO codes, valid shortage ratings, valid year ranges, and boolean flags.

## Quality principles covered

- **Accuracy**: ANZSCO-linked datasets are measured against the authoritative ANZSCO title reference.
- **Completeness**: required-field fill ratios are stored in `data_quality_metric`.
- **Consistency**: occupation pathway linkage coverage is measured after normalization.
- **Validity**: only rows that conform to the load rules are inserted.
- **Uniqueness**: business-key uniqueness is measured per dataset.
- **Timeliness**: file freshness is measured from the cleaned CSV modified timestamp.
- **Referential integrity**: enforced with foreign keys and measured after load.

## Main outputs

- `schema.sql`
  D1 / SQLite schema with tables, indexes, and frontend views.
- `build_d1_database.py`
  Builds a local SQLite database, writes a D1-importable SQL file, and exports frontend CSVs.
- `upload_frontend_exports_r2.py`
  Uploads the frontend CSVs to Cloudflare R2.
- `build/pathwayiq.sqlite`
  Generated local database for validation.
- `build/pathwayiq_d1_import.sql`
  Generated SQL import file for `wrangler d1 execute --file`.

## Frontend exports

The build script produces:

- `../frontend_exports/occupations.csv`
  Occupation summary rows for search cards and filters.
- `../frontend_exports/programs.csv`
  Program/course summary rows.
- `../frontend_exports/pathways.csv`
  Program-to-occupation bridge rows for pathway displays.

These exports are intentionally denormalized for the UI, but they are derived from the normalized database so the frontend does not become the source of truth.

## Build locally

From the repository root:

```bash
python3 "data/pathwayiq-Data Pipeline/database/build_d1_database.py"
```

That command will:

1. Create `build/pathwayiq.sqlite`
2. Write `build/pathwayiq_d1_import.sql`
3. Export CSV files into `frontend_exports/`

## Import into Cloudflare D1

1. Create a D1 database with Wrangler.
2. Import the generated SQL file.

```bash
npx wrangler d1 create pathwayiq-production
npx wrangler d1 execute pathwayiq-production --remote --file="data/pathwayiq-Data Pipeline/database/build/pathwayiq_d1_import.sql"
```

## Publish frontend CSVs to R2

```bash
R2_ACCOUNT_ID=xxx \
R2_ACCESS_KEY=xxx \
R2_SECRET_KEY=xxx \
R2_BUCKET=pathwayiq-data \
python3 "data/pathwayiq-Data Pipeline/database/upload_frontend_exports_r2.py"
```

Optional:

```bash
R2_PREFIX=frontend/v1
```

## Design notes

- `clean_vnda.csv`, `clean_vnda_qual_by_occ.csv`, and the split `clean_seuv_*` files are not loaded separately because they duplicate already-canonical datasets.
- `clean_osl_full.csv` contains both `ANZSCO_2022` and `OSCA_2024` classifications. The build keeps the `ANZSCO_2022` rows as the canonical relational source so the ANZSCO foreign keys stay semantically consistent.

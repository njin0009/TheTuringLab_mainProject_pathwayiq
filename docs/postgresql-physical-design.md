# PostgreSQL Physical Design And Load Strategy

## Physical Design Overview

The physical design implements the logical model in three PostgreSQL schemas:

- `pathwayiq_stage`
- `pathwayiq_core`
- `pathwayiq_mart`

This layering keeps raw cleaned data separate from normalized core tables and from frontend-facing views.

## Why The Physical Model Uses Surrogate Keys

The design preserves business keys and also adds identity primary keys.

- `occupation_code` remains the stable ANZSCO alternate key
- `program_code` remains the stable program alternate key
- identity primary keys improve foreign-key joins and indexing consistency

The physical design also stores `occupation.salary_median` as a persisted occupation-level attribute so the frontend can render a career card directly from the occupation mart without recalculating salary from pathways on every request.

This is a common PostgreSQL pattern because it supports both natural-business lookup and efficient relational joins.

## Physical Tables

### Stage Tables

The stage schema stores one raw landing table per cleaned CSV.

- `stg_anzsco_reference`
- `stg_osl_filtered`
- `stg_vnda_course_occupations`
- `stg_vnda_course_metrics`
- `stg_vet_outcomes`

Design choices:

- `UNLOGGED` tables for faster bulk loads
- mostly text columns to reduce type-conversion failures during `COPY`
- optional `ingestion_batch_id` and `source_row_no` columns for traceability

### Core Tables

The normalized core stores:

- lineage and release metadata
- reference dimensions
- canonical entity tables
- fact tables
- the many-to-many pathway bridge

### Mart Views

The mart exposes:

- `vw_frontend_occupations`
- `vw_frontend_programs`
- `vw_frontend_pathways`
- `vw_frontend_career_cards`

`vw_frontend_career_cards` is intended for export to Cloudflare and for direct frontend consumption.

## Domains And Constraints

The schema uses PostgreSQL domains and constraints to enforce quality at the database level.

- `percentage_value`
- `non_negative_amount`
- `anzsco_code_value`

This supports the quality dimensions requested in the assignment:

- validity
- consistency
- accuracy safeguards
- uniqueness
- referential integrity

## Indexing Strategy

The schema adds indexes for the most likely workload:

- lookup by occupation title
- lookup by program name
- joins between occupation and shortage
- joins between program and metrics
- joins between program and pathway bridge
- frontend filtering by shortage status

Important indexes include:

- `idx_occupation_normalized_title`
- `idx_alias_normalized_title`
- `idx_program_name_normalized`
- `idx_pathway_program`
- `idx_pathway_occupation`
- `idx_occupation_shortage_victoria`

## How Median Salary Is Derived

The frontend requires a single salary figure.

The ETL therefore pre-computes `occupation.salary_median` as:

- first preference: `program_graduate_metric.median_income`
- fallback: `program_vet_outcome.median_annual_income`

For each occupation, the load process uses `percentile_cont(0.5)` across all linked program salary values and stores the result on the occupation master row.

The mart views then read `occupation.salary_median` directly.

## How Industry Is Derived

Industry is not hard-coded from ANZSCO group codes.

Instead, the physical design uses:

- `field_of_education`
- `industry_bucket`
- `field_of_education_industry_map`

This makes industry assignment explicit, reviewable, and easier to maintain.

## How Pathway Is Derived

The schema persists `program_graduate_metric.is_apprenticeship` so the frontend does not depend on a query-time magic number.

That flag should be loaded using the same derivation rule as the pipeline:

- `pct_apprentice_trainees > 30`

The mart uses:

- `Apprenticeship` when `is_apprenticeship = true`
- `University` when AQF mapping says university and apprenticeship is false
- `TAFE` otherwise

## Recommended Build Steps

1. Create the schemas.
2. Create the domains and trigger function.
3. Create lineage tables.
4. Create reference tables.
5. Create core entity, fact, and bridge tables.
6. Create secondary indexes.
7. Create unlogged stage tables.
8. Bulk load cleaned CSVs into stage tables with `COPY` or `\copy`.
9. Insert reference values first.
10. Insert canonical entities.
11. Insert facts and bridge rows.
12. Unpivot VET top-3 columns into child tables.
13. Create mart views.
14. Run `ANALYZE`.
15. Export mart output to JSON or CSV for Cloudflare hosting.

## Recommended Load Order

```text
ingestion_batch
-> dataset_source
-> dataset_release
-> stage tables
-> major_group
-> shortage_rating
-> aqf_level
-> field_of_education
-> industry_bucket
-> field_of_education_industry_map
-> occupation
-> occupation_title_alias
-> occupation_shortage_snapshot
-> program
-> program_graduate_metric
-> program_vet_outcome
-> program_vet_top_occupation_group
-> program_vet_top_industry
-> program_occupation_pathway
-> mart views
```

## Example Load Approach

### 1. Register The Load Batch

```sql
INSERT INTO pathwayiq_core.ingestion_batch (batch_name, initiated_by, batch_notes)
VALUES ('2026-04-16-initial-postgres-load', 'codex', 'Initial load from cleaned CSVs');
```

### 2. Register Dataset Sources

```sql
INSERT INTO pathwayiq_core.dataset_source (source_code, source_name)
VALUES
  ('anzsco_reference', 'ANZSCO Reference'),
  ('osl_filtered', 'Occupation Shortage List Filtered'),
  ('vnda_course_occupations', 'VNDA Course Occupation Links'),
  ('vnda_course_metrics', 'VNDA Course Metrics'),
  ('vet_outcomes', 'VET Student Outcomes');
```

### 3. Load Stage Tables

```sql
\copy pathwayiq_stage.stg_osl_filtered
FROM 'data/pathwayiq-Data Pipeline/cleaned_data/clean_osl_filtered.csv'
WITH (FORMAT csv, HEADER true);
```

### 4. Load Reference Dimensions

```sql
INSERT INTO pathwayiq_core.shortage_rating (shortage_rating_code, display_label, frontend_status)
VALUES
  ('Shortage', 'Shortage', 'In Shortage'),
  ('Metro Shortage', 'Metro Shortage', 'In Shortage'),
  ('Regional Shortage', 'Regional Shortage', 'In Shortage'),
  ('No Shortage', 'No Shortage', 'Not in Shortage')
ON CONFLICT (shortage_rating_code) DO NOTHING;
```

### 5. Load Programs And Occupations

Load `occupation` from the preferred titles in ANZSCO reference and `program` from the union of VNDA and VET program descriptors.

At this stage, keep `occupation.salary_median` null until all salary-bearing program facts are loaded.

### 6. Load Facts

Load:

- `occupation_shortage_snapshot`
- `program_graduate_metric`
- `program_vet_outcome`
- `program_occupation_pathway`

When loading `program_graduate_metric`, derive `is_apprenticeship` using the pipeline-compatible rule:

```sql
COALESCE(pct_apprentice_trainees, 0) > 30
```

### 7. Unpivot Repeating VET Columns

Use `UNION ALL` or `CROSS JOIN LATERAL` to turn top-3 repeated columns into child rows.

### 8. Backfill Occupation Salary

After program metrics and pathways are loaded, pre-compute salary onto the occupation master.

```sql
UPDATE pathwayiq_core.occupation o
SET salary_median = src.salary_median
FROM (
  SELECT
    pop.occupation_id,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY salary_value) AS salary_median
  FROM pathwayiq_core.program_occupation_pathway pop
  JOIN pathwayiq_core.program p
    ON p.program_id = pop.program_id
  LEFT JOIN pathwayiq_core.program_graduate_metric pgm
    ON pgm.program_id = p.program_id
  LEFT JOIN pathwayiq_core.program_vet_outcome pvo
    ON pvo.program_id = p.program_id
  CROSS JOIN LATERAL (
    VALUES (COALESCE(pgm.median_income, pvo.median_annual_income))
  ) AS salary_source(salary_value)
  WHERE pop.occupation_id IS NOT NULL
    AND salary_value IS NOT NULL
  GROUP BY pop.occupation_id
) src
WHERE o.occupation_id = src.occupation_id;
```

This makes the occupation mart directly usable by the frontend even before pathway details are fetched.

### 9. Refresh Statistics

```sql
ANALYZE pathwayiq_core.occupation;
ANALYZE pathwayiq_core.program;
ANALYZE pathwayiq_core.program_occupation_pathway;
```

## Cloudflare Export Strategy

After the mart is populated, export:

- `vw_frontend_occupations`
- `vw_frontend_programs`
- `vw_frontend_pathways`
- `vw_frontend_career_cards`

The most useful export for the app is `vw_frontend_career_cards`, which returns:

```json
[
  {
    "anzsco_code": "351311",
    "title": "Chef",
    "industry": "Hospitality",
    "median_salary": 62000,
    "pathway": "TAFE",
    "shortage_status": "In Shortage"
  }
]
```

This can be published to Cloudflare R2 as JSON or CSV and served directly to the frontend.

`vw_frontend_career_cards` now uses `vw_frontend_occupations` as its primary source so unmatched pathway rows do not suppress otherwise valid occupations from the frontend list.

## Important Caveat

The current source set is strong for TAFE and apprenticeship-style journeys. It is weaker for university pathways because no higher-education course-to-occupation dataset is currently included. If university coverage becomes a frontend requirement, an extra source should be added in a future iteration.

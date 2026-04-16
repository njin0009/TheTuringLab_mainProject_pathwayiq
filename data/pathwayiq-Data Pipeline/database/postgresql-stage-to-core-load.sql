BEGIN;

INSERT INTO pathwayiq_core.ingestion_batch (
  batch_name,
  initiated_by,
  batch_notes,
  started_at,
  completed_at
)
VALUES (
  'render_stage_to_core_load',
  CURRENT_USER,
  'Populate PostgreSQL core tables from populated stage tables',
  NOW(),
  NULL
)
ON CONFLICT (batch_name) DO UPDATE
SET initiated_by = EXCLUDED.initiated_by,
    batch_notes = EXCLUDED.batch_notes,
    started_at = NOW(),
    completed_at = NULL;

INSERT INTO pathwayiq_core.dataset_source (
  source_code,
  source_name,
  description
)
VALUES
  ('anzsco_reference', 'ANZSCO Reference', 'Canonical occupation titles and hierarchy'),
  ('osl_filtered', 'Occupation Shortage List Filtered', 'Occupation shortage ratings used by the frontend'),
  ('vnda_course_occupations', 'VNDA Course Occupation Links', 'Course-to-occupation pathway bridge'),
  ('vnda_course_metrics', 'VNDA Course Metrics', 'Graduate employment and income facts'),
  ('vet_outcomes', 'VET Student Outcomes', 'VET satisfaction, study, and income outcomes')
ON CONFLICT (source_code) DO UPDATE
SET source_name = EXCLUDED.source_name,
    description = EXCLUDED.description;

UPDATE pathwayiq_core.dataset_release dr
SET is_current = FALSE
FROM pathwayiq_core.dataset_source ds
WHERE dr.dataset_source_id = ds.dataset_source_id
  AND ds.source_code IN (
    'anzsco_reference',
    'osl_filtered',
    'vnda_course_occupations',
    'vnda_course_metrics',
    'vet_outcomes'
  );

WITH active_batch AS (
  SELECT ingestion_batch_id
  FROM pathwayiq_core.ingestion_batch
  WHERE batch_name = 'render_stage_to_core_load'
),
release_rows AS (
  SELECT *
  FROM (
    VALUES
      ('anzsco_reference', 'clean_anzsco_reference.csv'),
      ('osl_filtered', 'clean_osl_filtered.csv'),
      ('vnda_course_occupations', 'clean_vnda_course_occupations.csv'),
      ('vnda_course_metrics', 'clean_vnda_course_metrics.csv'),
      ('vet_outcomes', 'clean_vet_outcomes.csv')
  ) AS x(source_code, source_object_name)
)
INSERT INTO pathwayiq_core.dataset_release (
  dataset_source_id,
  ingestion_batch_id,
  source_object_name,
  release_label,
  release_date,
  source_checksum,
  is_current
)
SELECT
  ds.dataset_source_id,
  ab.ingestion_batch_id,
  rr.source_object_name,
  'cleaned_csv_current',
  CURRENT_DATE,
  NULL,
  TRUE
FROM release_rows rr
JOIN pathwayiq_core.dataset_source ds
  ON ds.source_code = rr.source_code
CROSS JOIN active_batch ab
ON CONFLICT (dataset_source_id, source_object_name, release_label) DO UPDATE
SET ingestion_batch_id = EXCLUDED.ingestion_batch_id,
    release_date = EXCLUDED.release_date,
    source_checksum = EXCLUDED.source_checksum,
    is_current = EXCLUDED.is_current;

INSERT INTO pathwayiq_core.major_group (
  major_group_code,
  major_group_label
)
SELECT DISTINCT
  TRIM(major_group_code) AS major_group_code,
  TRIM(major_group_label) AS major_group_label
FROM (
  SELECT major_group_code, major_group_label
  FROM pathwayiq_stage.stg_anzsco_reference
  UNION ALL
  SELECT major_group_code, major_group_label
  FROM pathwayiq_stage.stg_osl_filtered
) src
WHERE NULLIF(TRIM(major_group_code), '') IS NOT NULL
  AND NULLIF(TRIM(major_group_label), '') IS NOT NULL
ON CONFLICT (major_group_code) DO UPDATE
SET major_group_label = EXCLUDED.major_group_label;

INSERT INTO pathwayiq_core.shortage_rating (
  shortage_rating_code,
  display_label,
  frontend_status
)
VALUES
  ('Shortage', 'Shortage', 'In Shortage'),
  ('Metro Shortage', 'Metro Shortage', 'In Shortage'),
  ('Regional Shortage', 'Regional Shortage', 'In Shortage'),
  ('No Shortage', 'No Shortage', 'Not in Shortage')
ON CONFLICT (shortage_rating_code) DO UPDATE
SET display_label = EXCLUDED.display_label,
    frontend_status = EXCLUDED.frontend_status;

WITH raw_levels AS (
  SELECT DISTINCT TRIM(aqf_level) AS aqf_level_name
  FROM pathwayiq_stage.stg_vnda_course_metrics
  WHERE NULLIF(TRIM(aqf_level), '') IS NOT NULL
  UNION
  SELECT DISTINCT TRIM(qualification_level) AS aqf_level_name
  FROM pathwayiq_stage.stg_vet_outcomes
  WHERE NULLIF(TRIM(qualification_level), '') IS NOT NULL
)
INSERT INTO pathwayiq_core.aqf_level (
  aqf_level_name,
  pathway_type,
  sort_order
)
SELECT
  aqf_level_name,
  CASE
    WHEN aqf_level_name IN ('Associate Degree', 'Bachelor Degree', 'Masters Degree', 'Doctoral Degree') THEN 'University'
    ELSE 'TAFE'
  END AS pathway_type,
  CASE aqf_level_name
    WHEN 'Certificate I' THEN 1
    WHEN 'Certificate II' THEN 2
    WHEN 'Certificate III' THEN 3
    WHEN 'Certificate IV' THEN 4
    WHEN 'Diploma' THEN 5
    WHEN 'Advanced Diploma' THEN 6
    WHEN 'Associate Degree' THEN 7
    WHEN 'Bachelor Degree' THEN 8
    WHEN 'Graduate Certificate' THEN 9
    WHEN 'Graduate Diploma' THEN 10
    WHEN 'Masters Degree' THEN 11
    WHEN 'Doctoral Degree' THEN 12
    ELSE 99
  END AS sort_order
FROM raw_levels
ON CONFLICT (aqf_level_name) DO UPDATE
SET pathway_type = EXCLUDED.pathway_type,
    sort_order = EXCLUDED.sort_order;

WITH raw_foe AS (
  SELECT DISTINCT
    CASE
      WHEN TRIM(foe) = 'Agriculture, Environmental And Related Studies' THEN 'Agriculture, Environment And Related Studies'
      ELSE TRIM(foe)
    END AS field_of_education_name
  FROM pathwayiq_stage.stg_vnda_course_metrics
  WHERE NULLIF(TRIM(foe), '') IS NOT NULL
  UNION
  SELECT DISTINCT
    CASE
      WHEN TRIM(field_of_education) = 'Agriculture, Environmental And Related Studies' THEN 'Agriculture, Environment And Related Studies'
      ELSE TRIM(field_of_education)
    END AS field_of_education_name
  FROM pathwayiq_stage.stg_vet_outcomes
  WHERE NULLIF(TRIM(field_of_education), '') IS NOT NULL
)
INSERT INTO pathwayiq_core.field_of_education (
  field_of_education_name
)
SELECT field_of_education_name
FROM raw_foe
ON CONFLICT (field_of_education_name) DO NOTHING;

WITH mapping AS (
  SELECT *
  FROM (
    VALUES
      ('Agriculture, Environment And Related Studies', 'Agriculture & Environment', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Architecture And Building', 'Construction', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Creative Arts', 'Creative Industries', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Education', 'Education', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Engineering And Related Technologies', 'Engineering', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Food, Hospitality And Personal Services', 'Hospitality', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Health', 'Healthcare', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Information Technology', 'Technology', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Management And Commerce', 'Business', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Mixed Field Programmes', 'General Studies', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Natural And Physical Sciences', 'Science', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Society And Culture', 'Community Services', 'Mapped from FOE to a student-friendly industry bucket')
  ) AS x(field_of_education_name, industry_name, mapping_note)
)
INSERT INTO pathwayiq_core.industry_bucket (
  industry_name
)
SELECT DISTINCT industry_name
FROM mapping
ON CONFLICT (industry_name) DO NOTHING;

WITH mapping AS (
  SELECT *
  FROM (
    VALUES
      ('Agriculture, Environment And Related Studies', 'Agriculture & Environment', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Architecture And Building', 'Construction', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Creative Arts', 'Creative Industries', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Education', 'Education', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Engineering And Related Technologies', 'Engineering', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Food, Hospitality And Personal Services', 'Hospitality', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Health', 'Healthcare', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Information Technology', 'Technology', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Management And Commerce', 'Business', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Mixed Field Programmes', 'General Studies', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Natural And Physical Sciences', 'Science', 'Mapped from FOE to a student-friendly industry bucket'),
      ('Society And Culture', 'Community Services', 'Mapped from FOE to a student-friendly industry bucket')
  ) AS x(field_of_education_name, industry_name, mapping_note)
)
INSERT INTO pathwayiq_core.field_of_education_industry_map (
  field_of_education_id,
  industry_bucket_id,
  mapping_note
)
SELECT
  foe.field_of_education_id,
  ib.industry_bucket_id,
  mapping.mapping_note
FROM mapping
JOIN pathwayiq_core.field_of_education foe
  ON foe.field_of_education_name = mapping.field_of_education_name
JOIN pathwayiq_core.industry_bucket ib
  ON ib.industry_name = mapping.industry_name
ON CONFLICT (field_of_education_id) DO UPDATE
SET industry_bucket_id = EXCLUDED.industry_bucket_id,
    mapping_note = EXCLUDED.mapping_note;

WITH preferred_titles AS (
  SELECT DISTINCT ON (TRIM(ar.anzsco_code))
    TRIM(ar.anzsco_code) AS occupation_code,
    TRIM(ar.occupation_title) AS preferred_title,
    COALESCE(NULLIF(TRIM(ar.normalised_title), ''), LOWER(REGEXP_REPLACE(TRIM(ar.occupation_title), '[^a-z0-9]+', ' ', 'g'))) AS normalized_preferred_title,
    NULLIF(TRIM(osl.skill_level), '')::NUMERIC::SMALLINT AS skill_level,
    mg.major_group_id
  FROM pathwayiq_stage.stg_anzsco_reference ar
  JOIN pathwayiq_core.major_group mg
    ON mg.major_group_code = TRIM(ar.major_group_code)
  LEFT JOIN pathwayiq_stage.stg_osl_filtered osl
    ON TRIM(osl.anzsco_code) = TRIM(ar.anzsco_code)
  WHERE COALESCE(NULLIF(TRIM(ar.is_preferred_title), ''), 'False')::BOOLEAN = TRUE
    AND NULLIF(TRIM(ar.anzsco_code), '') IS NOT NULL
  ORDER BY TRIM(ar.anzsco_code), TRIM(ar.occupation_title)
)
INSERT INTO pathwayiq_core.occupation (
  occupation_code,
  preferred_title,
  normalized_preferred_title,
  skill_level,
  major_group_id
)
SELECT
  occupation_code,
  preferred_title,
  normalized_preferred_title,
  skill_level,
  major_group_id
FROM preferred_titles
ON CONFLICT (occupation_code) DO UPDATE
SET preferred_title = EXCLUDED.preferred_title,
    normalized_preferred_title = EXCLUDED.normalized_preferred_title,
    skill_level = EXCLUDED.skill_level,
    major_group_id = EXCLUDED.major_group_id;

INSERT INTO pathwayiq_core.occupation (
  occupation_code,
  preferred_title,
  normalized_preferred_title,
  skill_level,
  major_group_id
)
SELECT DISTINCT
  TRIM(osl.anzsco_code) AS occupation_code,
  TRIM(osl.occupation_title) AS preferred_title,
  LOWER(REGEXP_REPLACE(TRIM(osl.occupation_title), '[^a-z0-9]+', ' ', 'g')) AS normalized_preferred_title,
  NULLIF(TRIM(osl.skill_level), '')::NUMERIC::SMALLINT AS skill_level,
  mg.major_group_id
FROM pathwayiq_stage.stg_osl_filtered osl
JOIN pathwayiq_core.major_group mg
  ON mg.major_group_code = TRIM(osl.major_group_code)
LEFT JOIN pathwayiq_core.occupation o
  ON o.occupation_code = TRIM(osl.anzsco_code)
WHERE NULLIF(TRIM(osl.anzsco_code), '') IS NOT NULL
  AND NULLIF(TRIM(osl.occupation_title), '') IS NOT NULL
  AND o.occupation_id IS NULL
ON CONFLICT (occupation_code) DO NOTHING;

INSERT INTO pathwayiq_core.occupation_title_alias (
  occupation_id,
  title_text,
  normalized_title_text,
  title_type_code,
  title_type_label,
  jurisdiction_scope,
  is_preferred_title
)
SELECT
  o.occupation_id,
  TRIM(ar.occupation_title) AS title_text,
  COALESCE(NULLIF(TRIM(ar.normalised_title), ''), LOWER(REGEXP_REPLACE(TRIM(ar.occupation_title), '[^a-z0-9]+', ' ', 'g'))) AS normalized_title_text,
  COALESCE(NULLIF(TRIM(ar.title_type_code), ''), '') AS title_type_code,
  NULLIF(TRIM(ar.title_type), '') AS title_type_label,
  COALESCE(NULLIF(TRIM(ar.jurisdiction_scope), ''), '') AS jurisdiction_scope,
  COALESCE(NULLIF(TRIM(ar.is_preferred_title), ''), 'False')::BOOLEAN AS is_preferred_title
FROM pathwayiq_stage.stg_anzsco_reference ar
JOIN pathwayiq_core.occupation o
  ON o.occupation_code = TRIM(ar.anzsco_code)
WHERE NULLIF(TRIM(ar.occupation_title), '') IS NOT NULL
ON CONFLICT (occupation_id, normalized_title_text, title_type_code, jurisdiction_scope) DO UPDATE
SET title_text = EXCLUDED.title_text,
    title_type_label = EXCLUDED.title_type_label,
    is_preferred_title = EXCLUDED.is_preferred_title;

INSERT INTO pathwayiq_core.occupation_title_alias (
  occupation_id,
  title_text,
  normalized_title_text,
  title_type_code,
  title_type_label,
  jurisdiction_scope,
  is_preferred_title
)
SELECT
  o.occupation_id,
  TRIM(osl.occupation_title) AS title_text,
  LOWER(REGEXP_REPLACE(TRIM(osl.occupation_title), '[^a-z0-9]+', ' ', 'g')) AS normalized_title_text,
  '' AS title_type_code,
  'osl_title' AS title_type_label,
  '' AS jurisdiction_scope,
  (o.preferred_title = TRIM(osl.occupation_title)) AS is_preferred_title
FROM pathwayiq_stage.stg_osl_filtered osl
JOIN pathwayiq_core.occupation o
  ON o.occupation_code = TRIM(osl.anzsco_code)
WHERE NULLIF(TRIM(osl.occupation_title), '') IS NOT NULL
ON CONFLICT (occupation_id, normalized_title_text, title_type_code, jurisdiction_scope) DO UPDATE
SET title_text = EXCLUDED.title_text,
    title_type_label = EXCLUDED.title_type_label,
    is_preferred_title = EXCLUDED.is_preferred_title;

WITH current_release AS (
  SELECT dr.dataset_release_id
  FROM pathwayiq_core.dataset_release dr
  JOIN pathwayiq_core.dataset_source ds
    ON ds.dataset_source_id = dr.dataset_source_id
  WHERE ds.source_code = 'osl_filtered'
    AND dr.is_current = TRUE
)
INSERT INTO pathwayiq_core.occupation_shortage_snapshot (
  dataset_release_id,
  occupation_id,
  national_shortage_rating_id,
  victoria_shortage_rating_id
)
SELECT
  cr.dataset_release_id,
  o.occupation_id,
  nsr.shortage_rating_id,
  vsr.shortage_rating_id
FROM pathwayiq_stage.stg_osl_filtered osl
CROSS JOIN current_release cr
JOIN pathwayiq_core.occupation o
  ON o.occupation_code = TRIM(osl.anzsco_code)
JOIN pathwayiq_core.shortage_rating nsr
  ON nsr.shortage_rating_code = TRIM(osl.national_shortage_rating)
JOIN pathwayiq_core.shortage_rating vsr
  ON vsr.shortage_rating_code = TRIM(osl.victoria_shortage_rating)
ON CONFLICT (dataset_release_id, occupation_id) DO UPDATE
SET national_shortage_rating_id = EXCLUDED.national_shortage_rating_id,
    victoria_shortage_rating_id = EXCLUDED.victoria_shortage_rating_id;

WITH unified_programs AS (
  SELECT
    TRIM(course_id) AS program_code,
    TRIM(course_name) AS program_name,
    TRIM(aqf_level) AS aqf_level_name,
    CASE
      WHEN TRIM(foe) = 'Agriculture, Environmental And Related Studies' THEN 'Agriculture, Environment And Related Studies'
      ELSE TRIM(foe)
    END AS field_of_education_name,
    1 AS source_priority
  FROM pathwayiq_stage.stg_vnda_course_metrics
  WHERE NULLIF(TRIM(course_id), '') IS NOT NULL

  UNION ALL

  SELECT
    TRIM(program_id) AS program_code,
    TRIM(program_name) AS program_name,
    TRIM(qualification_level) AS aqf_level_name,
    CASE
      WHEN TRIM(field_of_education) = 'Agriculture, Environmental And Related Studies' THEN 'Agriculture, Environment And Related Studies'
      ELSE TRIM(field_of_education)
    END AS field_of_education_name,
    2 AS source_priority
  FROM pathwayiq_stage.stg_vet_outcomes
  WHERE NULLIF(TRIM(program_id), '') IS NOT NULL
),
ranked_programs AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY program_code
      ORDER BY
        CASE WHEN NULLIF(program_name, '') IS NULL THEN 2 ELSE 1 END,
        source_priority,
        program_name
    ) AS rn
  FROM unified_programs
)
INSERT INTO pathwayiq_core.program (
  program_code,
  program_name,
  normalized_program_name,
  aqf_level_id,
  field_of_education_id
)
SELECT
  rp.program_code,
  rp.program_name,
  LOWER(REGEXP_REPLACE(rp.program_name, '[^a-z0-9]+', ' ', 'g')) AS normalized_program_name,
  aq.aqf_level_id,
  foe.field_of_education_id
FROM ranked_programs rp
LEFT JOIN pathwayiq_core.aqf_level aq
  ON aq.aqf_level_name = rp.aqf_level_name
LEFT JOIN pathwayiq_core.field_of_education foe
  ON foe.field_of_education_name = rp.field_of_education_name
WHERE rp.rn = 1
  AND NULLIF(rp.program_name, '') IS NOT NULL
ON CONFLICT (program_code) DO UPDATE
SET program_name = EXCLUDED.program_name,
    normalized_program_name = EXCLUDED.normalized_program_name,
    aqf_level_id = EXCLUDED.aqf_level_id,
    field_of_education_id = EXCLUDED.field_of_education_id;

WITH current_release AS (
  SELECT dr.dataset_release_id
  FROM pathwayiq_core.dataset_release dr
  JOIN pathwayiq_core.dataset_source ds
    ON ds.dataset_source_id = dr.dataset_source_id
  WHERE ds.source_code = 'vnda_course_metrics'
    AND dr.is_current = TRUE
)
INSERT INTO pathwayiq_core.program_graduate_metric (
  dataset_release_id,
  program_id,
  course_rank,
  count_of_unique_occupations,
  pct_employed_post,
  pct_employed_tot_post,
  pct_higher_vet_progression,
  pct_any_vet_progression,
  pct_apprentice_trainees,
  is_apprenticeship,
  median_income,
  median_income_total,
  total_ft_median_income
)
SELECT
  cr.dataset_release_id,
  p.program_id,
  NULLIF(TRIM(s.course_rank), '')::NUMERIC::INTEGER AS course_rank,
  NULLIF(TRIM(s.count_of_unique_occupations), '')::NUMERIC::INTEGER AS count_of_unique_occupations,
  NULLIF(TRIM(s.pct_employed_post), '')::NUMERIC(5,2) AS pct_employed_post,
  NULLIF(TRIM(s.pct_employed_tot_post), '')::NUMERIC(5,2) AS pct_employed_tot_post,
  NULLIF(TRIM(s.pct_higher_vet_progression), '')::NUMERIC(5,2) AS pct_higher_vet_progression,
  NULLIF(TRIM(s.pct_any_vet_progression), '')::NUMERIC(5,2) AS pct_any_vet_progression,
  NULLIF(TRIM(s.pct_apprentice_trainees), '')::NUMERIC(5,2) AS pct_apprentice_trainees,
  COALESCE(NULLIF(TRIM(s.pct_apprentice_trainees), '')::NUMERIC, 0) > 30 AS is_apprenticeship,
  NULLIF(TRIM(s.median_income), '')::NUMERIC(12,2) AS median_income,
  NULLIF(TRIM(s.median_income_total), '')::NUMERIC(12,2) AS median_income_total,
  NULLIF(TRIM(s.total_ft_median_income), '')::NUMERIC(12,2) AS total_ft_median_income
FROM pathwayiq_stage.stg_vnda_course_metrics s
CROSS JOIN current_release cr
JOIN pathwayiq_core.program p
  ON p.program_code = TRIM(s.course_id)
ON CONFLICT (dataset_release_id, program_id) DO UPDATE
SET course_rank = EXCLUDED.course_rank,
    count_of_unique_occupations = EXCLUDED.count_of_unique_occupations,
    pct_employed_post = EXCLUDED.pct_employed_post,
    pct_employed_tot_post = EXCLUDED.pct_employed_tot_post,
    pct_higher_vet_progression = EXCLUDED.pct_higher_vet_progression,
    pct_any_vet_progression = EXCLUDED.pct_any_vet_progression,
    pct_apprentice_trainees = EXCLUDED.pct_apprentice_trainees,
    is_apprenticeship = EXCLUDED.is_apprenticeship,
    median_income = EXCLUDED.median_income,
    median_income_total = EXCLUDED.median_income_total,
    total_ft_median_income = EXCLUDED.total_ft_median_income;

WITH current_release AS (
  SELECT dr.dataset_release_id
  FROM pathwayiq_core.dataset_release dr
  JOIN pathwayiq_core.dataset_source ds
    ON ds.dataset_source_id = dr.dataset_source_id
  WHERE ds.source_code = 'vet_outcomes'
    AND dr.is_current = TRUE
)
INSERT INTO pathwayiq_core.program_vet_outcome (
  dataset_release_id,
  program_id,
  n_respondents,
  pct_employed_or_study,
  pct_improved_employment,
  pct_commenced_further_study,
  pct_satisfied,
  median_annual_income,
  median_annual_income_imputed_flag,
  median_annual_income_value_source,
  median_annual_income_imputation_basis,
  median_annual_income_structural_missing_flag
)
SELECT
  cr.dataset_release_id,
  p.program_id,
  NULLIF(TRIM(s.n_respondents), '')::NUMERIC::INTEGER AS n_respondents,
  NULLIF(TRIM(s.pct_employed_or_study), '')::NUMERIC(5,2) AS pct_employed_or_study,
  NULLIF(TRIM(s.pct_improved_employment), '')::NUMERIC(5,2) AS pct_improved_employment,
  NULLIF(TRIM(s.pct_commenced_further_study), '')::NUMERIC(5,2) AS pct_commenced_further_study,
  NULLIF(TRIM(s.pct_satisfied), '')::NUMERIC(5,2) AS pct_satisfied,
  NULLIF(TRIM(s.median_annual_income), '')::NUMERIC(12,2) AS median_annual_income,
  COALESCE(NULLIF(TRIM(s.median_annual_income_imputed_flag), ''), 'False')::BOOLEAN AS median_annual_income_imputed_flag,
  NULLIF(TRIM(s.median_annual_income_value_source), '') AS median_annual_income_value_source,
  NULLIF(TRIM(s.median_annual_income_imputation_basis), '') AS median_annual_income_imputation_basis,
  COALESCE(NULLIF(TRIM(s.median_annual_income_structural_missing_flag), ''), 'False')::BOOLEAN AS median_annual_income_structural_missing_flag
FROM pathwayiq_stage.stg_vet_outcomes s
CROSS JOIN current_release cr
JOIN pathwayiq_core.program p
  ON p.program_code = TRIM(s.program_id)
ON CONFLICT (dataset_release_id, program_id) DO UPDATE
SET n_respondents = EXCLUDED.n_respondents,
    pct_employed_or_study = EXCLUDED.pct_employed_or_study,
    pct_improved_employment = EXCLUDED.pct_improved_employment,
    pct_commenced_further_study = EXCLUDED.pct_commenced_further_study,
    pct_satisfied = EXCLUDED.pct_satisfied,
    median_annual_income = EXCLUDED.median_annual_income,
    median_annual_income_imputed_flag = EXCLUDED.median_annual_income_imputed_flag,
    median_annual_income_value_source = EXCLUDED.median_annual_income_value_source,
    median_annual_income_imputation_basis = EXCLUDED.median_annual_income_imputation_basis,
    median_annual_income_structural_missing_flag = EXCLUDED.median_annual_income_structural_missing_flag;

WITH current_release AS (
  SELECT dr.dataset_release_id
  FROM pathwayiq_core.dataset_release dr
  JOIN pathwayiq_core.dataset_source ds
    ON ds.dataset_source_id = dr.dataset_source_id
  WHERE ds.source_code = 'vet_outcomes'
    AND dr.is_current = TRUE
),
long_occ AS (
  SELECT TRIM(program_id) AS program_code, 1 AS rank_no, NULLIF(TRIM(occupation_1), '') AS occupation_group_label, NULLIF(TRIM(occupation_1_pct), '')::NUMERIC(5,2) AS share_pct
  FROM pathwayiq_stage.stg_vet_outcomes
  UNION ALL
  SELECT TRIM(program_id), 2, NULLIF(TRIM(occupation_2), ''), NULLIF(TRIM(occupation_2_pct), '')::NUMERIC(5,2)
  FROM pathwayiq_stage.stg_vet_outcomes
  UNION ALL
  SELECT TRIM(program_id), 3, NULLIF(TRIM(occupation_3), ''), NULLIF(TRIM(occupation_3_pct), '')::NUMERIC(5,2)
  FROM pathwayiq_stage.stg_vet_outcomes
)
INSERT INTO pathwayiq_core.program_vet_top_occupation_group (
  program_vet_outcome_id,
  rank_no,
  occupation_group_label,
  share_pct
)
SELECT
  pvo.program_vet_outcome_id,
  lo.rank_no,
  lo.occupation_group_label,
  lo.share_pct
FROM long_occ lo
JOIN pathwayiq_core.program p
  ON p.program_code = lo.program_code
JOIN current_release cr
  ON TRUE
JOIN pathwayiq_core.program_vet_outcome pvo
  ON pvo.program_id = p.program_id
 AND pvo.dataset_release_id = cr.dataset_release_id
WHERE lo.occupation_group_label IS NOT NULL
ON CONFLICT (program_vet_outcome_id, rank_no) DO UPDATE
SET occupation_group_label = EXCLUDED.occupation_group_label,
    share_pct = EXCLUDED.share_pct;

WITH current_release AS (
  SELECT dr.dataset_release_id
  FROM pathwayiq_core.dataset_release dr
  JOIN pathwayiq_core.dataset_source ds
    ON ds.dataset_source_id = dr.dataset_source_id
  WHERE ds.source_code = 'vet_outcomes'
    AND dr.is_current = TRUE
),
long_ind AS (
  SELECT TRIM(program_id) AS program_code, 1 AS rank_no, NULLIF(TRIM(industry_1), '') AS industry_label, NULLIF(TRIM(industry_1_pct), '')::NUMERIC(5,2) AS share_pct
  FROM pathwayiq_stage.stg_vet_outcomes
  UNION ALL
  SELECT TRIM(program_id), 2, NULLIF(TRIM(industry_2), ''), NULLIF(TRIM(industry_2_pct), '')::NUMERIC(5,2)
  FROM pathwayiq_stage.stg_vet_outcomes
  UNION ALL
  SELECT TRIM(program_id), 3, NULLIF(TRIM(industry_3), ''), NULLIF(TRIM(industry_3_pct), '')::NUMERIC(5,2)
  FROM pathwayiq_stage.stg_vet_outcomes
)
INSERT INTO pathwayiq_core.program_vet_top_industry (
  program_vet_outcome_id,
  rank_no,
  industry_label,
  share_pct
)
SELECT
  pvo.program_vet_outcome_id,
  li.rank_no,
  li.industry_label,
  li.share_pct
FROM long_ind li
JOIN pathwayiq_core.program p
  ON p.program_code = li.program_code
JOIN current_release cr
  ON TRUE
JOIN pathwayiq_core.program_vet_outcome pvo
  ON pvo.program_id = p.program_id
 AND pvo.dataset_release_id = cr.dataset_release_id
WHERE li.industry_label IS NOT NULL
ON CONFLICT (program_vet_outcome_id, rank_no) DO UPDATE
SET industry_label = EXCLUDED.industry_label,
    share_pct = EXCLUDED.share_pct;

WITH current_release AS (
  SELECT dr.dataset_release_id
  FROM pathwayiq_core.dataset_release dr
  JOIN pathwayiq_core.dataset_source ds
    ON ds.dataset_source_id = dr.dataset_source_id
  WHERE ds.source_code = 'vnda_course_occupations'
    AND dr.is_current = TRUE
)
INSERT INTO pathwayiq_core.program_occupation_pathway (
  dataset_release_id,
  program_id,
  occupation_id,
  occupation_title_text,
  pathway_rank_no,
  share_pct,
  match_method,
  match_score,
  match_status
)
SELECT
  cr.dataset_release_id,
  p.program_id,
  o.occupation_id,
  COALESCE(NULLIF(TRIM(s.anzsco_occupation_title), ''), TRIM(s.occupation_name)) AS occupation_title_text,
  NULLIF(TRIM(s.course_occupation_rank), '')::NUMERIC::INTEGER AS pathway_rank_no,
  NULLIF(TRIM(s.pct_share), '')::NUMERIC(5,2) AS share_pct,
  NULLIF(TRIM(s.anzsco_match_method), '') AS match_method,
  NULLIF(TRIM(s.anzsco_match_score), '')::NUMERIC(5,2) AS match_score,
  COALESCE(NULLIF(TRIM(s.anzsco_match_status), ''), 'unmatched') AS match_status
FROM pathwayiq_stage.stg_vnda_course_occupations s
CROSS JOIN current_release cr
JOIN pathwayiq_core.program p
  ON p.program_code = TRIM(s.course_id)
LEFT JOIN pathwayiq_core.occupation o
  ON o.occupation_code = NULLIF(TRIM(s.anzsco_code), '')
ON CONFLICT (dataset_release_id, program_id, pathway_rank_no) DO UPDATE
SET occupation_id = EXCLUDED.occupation_id,
    occupation_title_text = EXCLUDED.occupation_title_text,
    share_pct = EXCLUDED.share_pct,
    match_method = EXCLUDED.match_method,
    match_score = EXCLUDED.match_score,
    match_status = EXCLUDED.match_status;

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

UPDATE pathwayiq_core.ingestion_batch
SET completed_at = NOW()
WHERE batch_name = 'render_stage_to_core_load';

ANALYZE pathwayiq_core.occupation;
ANALYZE pathwayiq_core.program;
ANALYZE pathwayiq_core.program_occupation_pathway;
ANALYZE pathwayiq_core.program_graduate_metric;
ANALYZE pathwayiq_core.program_vet_outcome;

COMMIT;

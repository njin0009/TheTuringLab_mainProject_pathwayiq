CREATE SCHEMA IF NOT EXISTS pathwayiq_stage;
CREATE SCHEMA IF NOT EXISTS pathwayiq_core;
CREATE SCHEMA IF NOT EXISTS pathwayiq_mart;

CREATE DOMAIN pathwayiq_core.percentage_value AS NUMERIC(5,2)
  CHECK (VALUE >= 0 AND VALUE <= 100);

CREATE DOMAIN pathwayiq_core.non_negative_amount AS NUMERIC(12,2)
  CHECK (VALUE >= 0);

CREATE DOMAIN pathwayiq_core.anzsco_code_value AS TEXT
  CHECK (VALUE ~ '^[0-9]{6}$');

CREATE OR REPLACE FUNCTION pathwayiq_core.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS pathwayiq_core.ingestion_batch (
  ingestion_batch_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_name TEXT NOT NULL UNIQUE,
  initiated_by TEXT,
  batch_notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.dataset_source (
  dataset_source_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_code TEXT NOT NULL UNIQUE,
  source_name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.dataset_release (
  dataset_release_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset_source_id BIGINT NOT NULL REFERENCES pathwayiq_core.dataset_source (dataset_source_id),
  ingestion_batch_id BIGINT NOT NULL REFERENCES pathwayiq_core.ingestion_batch (ingestion_batch_id),
  source_object_name TEXT NOT NULL,
  release_label TEXT NOT NULL DEFAULT '',
  release_date DATE,
  source_checksum TEXT,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dataset_source_id, source_object_name, release_label)
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.major_group (
  major_group_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  major_group_code TEXT NOT NULL UNIQUE,
  major_group_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.shortage_rating (
  shortage_rating_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shortage_rating_code TEXT NOT NULL UNIQUE,
  display_label TEXT NOT NULL,
  frontend_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.aqf_level (
  aqf_level_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aqf_level_name TEXT NOT NULL UNIQUE,
  pathway_type TEXT NOT NULL,
  sort_order SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (pathway_type IN ('TAFE', 'University'))
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.field_of_education (
  field_of_education_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  field_of_education_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.industry_bucket (
  industry_bucket_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  industry_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.field_of_education_industry_map (
  field_of_education_id BIGINT PRIMARY KEY REFERENCES pathwayiq_core.field_of_education (field_of_education_id),
  industry_bucket_id BIGINT NOT NULL REFERENCES pathwayiq_core.industry_bucket (industry_bucket_id),
  mapping_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.occupation (
  occupation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occupation_code pathwayiq_core.anzsco_code_value NOT NULL UNIQUE,
  preferred_title TEXT NOT NULL,
  normalized_preferred_title TEXT NOT NULL,
  skill_level SMALLINT,
  salary_median pathwayiq_core.non_negative_amount,
  major_group_id BIGINT NOT NULL REFERENCES pathwayiq_core.major_group (major_group_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (skill_level BETWEEN 1 AND 5 OR skill_level IS NULL)
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.occupation_title_alias (
  occupation_title_alias_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occupation_id BIGINT NOT NULL REFERENCES pathwayiq_core.occupation (occupation_id),
  title_text TEXT NOT NULL,
  normalized_title_text TEXT NOT NULL,
  title_type_code TEXT NOT NULL DEFAULT '',
  title_type_label TEXT,
  jurisdiction_scope TEXT NOT NULL DEFAULT '',
  is_preferred_title BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (occupation_id, normalized_title_text, title_type_code, jurisdiction_scope)
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.occupation_shortage_snapshot (
  occupation_shortage_snapshot_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset_release_id BIGINT NOT NULL REFERENCES pathwayiq_core.dataset_release (dataset_release_id),
  occupation_id BIGINT NOT NULL REFERENCES pathwayiq_core.occupation (occupation_id),
  national_shortage_rating_id BIGINT NOT NULL REFERENCES pathwayiq_core.shortage_rating (shortage_rating_id),
  victoria_shortage_rating_id BIGINT NOT NULL REFERENCES pathwayiq_core.shortage_rating (shortage_rating_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dataset_release_id, occupation_id)
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.program (
  program_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  program_code TEXT NOT NULL UNIQUE,
  program_name TEXT NOT NULL,
  normalized_program_name TEXT NOT NULL,
  aqf_level_id BIGINT REFERENCES pathwayiq_core.aqf_level (aqf_level_id),
  field_of_education_id BIGINT REFERENCES pathwayiq_core.field_of_education (field_of_education_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.program_graduate_metric (
  program_graduate_metric_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset_release_id BIGINT NOT NULL REFERENCES pathwayiq_core.dataset_release (dataset_release_id),
  program_id BIGINT NOT NULL REFERENCES pathwayiq_core.program (program_id),
  course_rank INTEGER,
  count_of_unique_occupations INTEGER,
  pct_employed_post pathwayiq_core.percentage_value,
  pct_employed_tot_post pathwayiq_core.percentage_value,
  pct_higher_vet_progression pathwayiq_core.percentage_value,
  pct_any_vet_progression pathwayiq_core.percentage_value,
  pct_apprentice_trainees pathwayiq_core.percentage_value,
  is_apprenticeship BOOLEAN NOT NULL DEFAULT FALSE,
  median_income pathwayiq_core.non_negative_amount,
  median_income_total pathwayiq_core.non_negative_amount,
  total_ft_median_income pathwayiq_core.non_negative_amount,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dataset_release_id, program_id)
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.program_vet_outcome (
  program_vet_outcome_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset_release_id BIGINT NOT NULL REFERENCES pathwayiq_core.dataset_release (dataset_release_id),
  program_id BIGINT NOT NULL REFERENCES pathwayiq_core.program (program_id),
  n_respondents INTEGER,
  pct_employed_or_study pathwayiq_core.percentage_value,
  pct_improved_employment pathwayiq_core.percentage_value,
  pct_commenced_further_study pathwayiq_core.percentage_value,
  pct_satisfied pathwayiq_core.percentage_value,
  median_annual_income pathwayiq_core.non_negative_amount,
  median_annual_income_imputed_flag BOOLEAN NOT NULL DEFAULT FALSE,
  median_annual_income_value_source TEXT,
  median_annual_income_imputation_basis TEXT,
  median_annual_income_structural_missing_flag BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dataset_release_id, program_id)
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.program_vet_top_occupation_group (
  program_vet_top_occupation_group_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  program_vet_outcome_id BIGINT NOT NULL REFERENCES pathwayiq_core.program_vet_outcome (program_vet_outcome_id),
  rank_no SMALLINT NOT NULL CHECK (rank_no BETWEEN 1 AND 3),
  occupation_group_label TEXT NOT NULL,
  share_pct pathwayiq_core.percentage_value,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_vet_outcome_id, rank_no)
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.program_vet_top_industry (
  program_vet_top_industry_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  program_vet_outcome_id BIGINT NOT NULL REFERENCES pathwayiq_core.program_vet_outcome (program_vet_outcome_id),
  rank_no SMALLINT NOT NULL CHECK (rank_no BETWEEN 1 AND 3),
  industry_label TEXT NOT NULL,
  share_pct pathwayiq_core.percentage_value,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_vet_outcome_id, rank_no)
);

CREATE TABLE IF NOT EXISTS pathwayiq_core.program_occupation_pathway (
  program_occupation_pathway_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset_release_id BIGINT NOT NULL REFERENCES pathwayiq_core.dataset_release (dataset_release_id),
  program_id BIGINT NOT NULL REFERENCES pathwayiq_core.program (program_id),
  occupation_id BIGINT REFERENCES pathwayiq_core.occupation (occupation_id),
  occupation_title_text TEXT NOT NULL,
  pathway_rank_no INTEGER,
  share_pct pathwayiq_core.percentage_value,
  match_method TEXT,
  match_score NUMERIC(5,2),
  match_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (dataset_release_id, program_id, pathway_rank_no)
);

CREATE INDEX IF NOT EXISTS idx_occupation_normalized_title
  ON pathwayiq_core.occupation (normalized_preferred_title);

CREATE INDEX IF NOT EXISTS idx_occupation_salary_median
  ON pathwayiq_core.occupation (salary_median);

CREATE INDEX IF NOT EXISTS idx_alias_normalized_title
  ON pathwayiq_core.occupation_title_alias (normalized_title_text);

CREATE INDEX IF NOT EXISTS idx_occupation_shortage_occupation
  ON pathwayiq_core.occupation_shortage_snapshot (occupation_id);

CREATE INDEX IF NOT EXISTS idx_occupation_shortage_victoria
  ON pathwayiq_core.occupation_shortage_snapshot (victoria_shortage_rating_id);

CREATE INDEX IF NOT EXISTS idx_program_name_normalized
  ON pathwayiq_core.program (normalized_program_name);

CREATE INDEX IF NOT EXISTS idx_program_foe
  ON pathwayiq_core.program (field_of_education_id);

CREATE INDEX IF NOT EXISTS idx_graduate_metric_program
  ON pathwayiq_core.program_graduate_metric (program_id);

CREATE INDEX IF NOT EXISTS idx_vet_outcome_program
  ON pathwayiq_core.program_vet_outcome (program_id);

CREATE INDEX IF NOT EXISTS idx_pathway_program
  ON pathwayiq_core.program_occupation_pathway (program_id);

CREATE INDEX IF NOT EXISTS idx_pathway_occupation
  ON pathwayiq_core.program_occupation_pathway (occupation_id);

CREATE INDEX IF NOT EXISTS idx_pathway_match_status
  ON pathwayiq_core.program_occupation_pathway (match_status);

CREATE TRIGGER trg_dataset_source_updated_at
BEFORE UPDATE ON pathwayiq_core.dataset_source
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_dataset_release_updated_at
BEFORE UPDATE ON pathwayiq_core.dataset_release
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_major_group_updated_at
BEFORE UPDATE ON pathwayiq_core.major_group
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_shortage_rating_updated_at
BEFORE UPDATE ON pathwayiq_core.shortage_rating
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_aqf_level_updated_at
BEFORE UPDATE ON pathwayiq_core.aqf_level
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_field_of_education_updated_at
BEFORE UPDATE ON pathwayiq_core.field_of_education
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_industry_bucket_updated_at
BEFORE UPDATE ON pathwayiq_core.industry_bucket
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_foe_industry_map_updated_at
BEFORE UPDATE ON pathwayiq_core.field_of_education_industry_map
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_occupation_updated_at
BEFORE UPDATE ON pathwayiq_core.occupation
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_occupation_title_alias_updated_at
BEFORE UPDATE ON pathwayiq_core.occupation_title_alias
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_occupation_shortage_snapshot_updated_at
BEFORE UPDATE ON pathwayiq_core.occupation_shortage_snapshot
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_program_updated_at
BEFORE UPDATE ON pathwayiq_core.program
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_program_graduate_metric_updated_at
BEFORE UPDATE ON pathwayiq_core.program_graduate_metric
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_program_vet_outcome_updated_at
BEFORE UPDATE ON pathwayiq_core.program_vet_outcome
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_program_vet_top_occupation_group_updated_at
BEFORE UPDATE ON pathwayiq_core.program_vet_top_occupation_group
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_program_vet_top_industry_updated_at
BEFORE UPDATE ON pathwayiq_core.program_vet_top_industry
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE TRIGGER trg_program_occupation_pathway_updated_at
BEFORE UPDATE ON pathwayiq_core.program_occupation_pathway
FOR EACH ROW EXECUTE FUNCTION pathwayiq_core.set_updated_at();

CREATE UNLOGGED TABLE IF NOT EXISTS pathwayiq_stage.stg_anzsco_reference (
  ingestion_batch_id BIGINT,
  source_row_no BIGINT,
  anzsco_code TEXT,
  raw_title TEXT,
  title_type_code TEXT,
  title_type TEXT,
  jurisdiction_scope TEXT,
  occupation_title TEXT,
  normalised_title TEXT,
  major_group_code TEXT,
  sub_major_group_code TEXT,
  minor_group_code TEXT,
  unit_group_code TEXT,
  major_group_label TEXT,
  preferred_occupation_title TEXT,
  preferred_title_type TEXT,
  preferred_jurisdiction_scope TEXT,
  is_preferred_title TEXT
);

CREATE UNLOGGED TABLE IF NOT EXISTS pathwayiq_stage.stg_osl_filtered (
  ingestion_batch_id BIGINT,
  source_row_no BIGINT,
  anzsco_code TEXT,
  occupation_title TEXT,
  national_shortage_rating TEXT,
  victoria_shortage_rating TEXT,
  skill_level TEXT,
  major_group_code TEXT,
  major_group_label TEXT
);

CREATE UNLOGGED TABLE IF NOT EXISTS pathwayiq_stage.stg_vnda_course_occupations (
  ingestion_batch_id BIGINT,
  source_row_no BIGINT,
  course_id TEXT,
  course_name TEXT,
  occupation_name TEXT,
  pct_share TEXT,
  source_sheet TEXT,
  anzsco_code TEXT,
  anzsco_occupation_title TEXT,
  anzsco_major_group_code TEXT,
  anzsco_major_group_label TEXT,
  anzsco_sub_major_group_code TEXT,
  anzsco_minor_group_code TEXT,
  anzsco_unit_group_code TEXT,
  anzsco_match_method TEXT,
  anzsco_match_score TEXT,
  anzsco_match_status TEXT,
  course_occupation_rank TEXT
);

CREATE UNLOGGED TABLE IF NOT EXISTS pathwayiq_stage.stg_vnda_course_metrics (
  ingestion_batch_id BIGINT,
  source_row_no BIGINT,
  course_id TEXT,
  course_name TEXT,
  aqf_level TEXT,
  foe TEXT,
  course_rank TEXT,
  small_count_flag TEXT,
  pct_employed_prior TEXT,
  pct_employed_post TEXT,
  pptchange_employment TEXT,
  pct_employed_tot_prior TEXT,
  pct_employed_tot_post TEXT,
  pctpt_change_in_tot_employment TEXT,
  pct_employed_pt_prior TEXT,
  pct_employed_pt_post TEXT,
  pctpt_change_in_pt_employment TEXT,
  pct_employed_ft_prior TEXT,
  pct_employed_ft_post TEXT,
  pctpt_change_in_ft_employment TEXT,
  median_income TEXT,
  median_income_change TEXT,
  median_income_total TEXT,
  median_income_total_change TEXT,
  total_ft_median_income TEXT,
  total_ft_median_income_change TEXT,
  income_support_exit_rate TEXT,
  pct_higher_vet_progression TEXT,
  pct_any_vet_progression TEXT,
  pct_female TEXT,
  pct_disability TEXT,
  pct_apprentice_trainees TEXT,
  pct_first_nations TEXT,
  pct_no_yr12_no_cert_iii TEXT,
  pct_government_funded TEXT,
  median_completion_age_yrs TEXT,
  median_completion_time_days TEXT,
  pct_remote TEXT,
  pct_regional TEXT,
  pct_major_city TEXT,
  count_of_unique_occupations TEXT,
  source_sheet TEXT,
  suppressed_value_count TEXT,
  has_suppressed_values TEXT,
  median_income_outlier_flag TEXT,
  median_income_change_outlier_flag TEXT,
  median_income_total_outlier_flag TEXT,
  median_income_total_change_outlier_flag TEXT,
  total_ft_median_income_outlier_flag TEXT,
  total_ft_median_income_change_outlier_flag TEXT
);

CREATE UNLOGGED TABLE IF NOT EXISTS pathwayiq_stage.stg_vet_outcomes (
  ingestion_batch_id BIGINT,
  source_row_no BIGINT,
  program_id TEXT,
  program_name TEXT,
  field_of_education TEXT,
  qualification_level TEXT,
  n_respondents TEXT,
  pct_employed_or_study TEXT,
  pct_improved_employment TEXT,
  pct_commenced_further_study TEXT,
  pct_satisfied TEXT,
  median_annual_income TEXT,
  occupation_1 TEXT,
  occupation_1_pct TEXT,
  occupation_2 TEXT,
  occupation_2_pct TEXT,
  occupation_3 TEXT,
  occupation_3_pct TEXT,
  industry_1 TEXT,
  industry_1_pct TEXT,
  industry_2 TEXT,
  industry_2_pct TEXT,
  industry_3 TEXT,
  industry_3_pct TEXT,
  median_annual_income_original TEXT,
  median_annual_income_imputed_flag TEXT,
  median_annual_income_value_source TEXT,
  median_annual_income_imputation_basis TEXT,
  median_annual_income_structural_missing_flag TEXT,
  median_annual_income_model_prediction TEXT,
  median_annual_income_prediction_clipped_flag TEXT,
  industry_profile_note TEXT,
  occupation_pct_normalized_flag TEXT,
  occupation_top3_pct_total TEXT,
  occupation_other_pct TEXT,
  industry_pct_normalized_flag TEXT,
  industry_top3_pct_total TEXT,
  median_annual_income_outlier_flag TEXT
);

CREATE OR REPLACE VIEW pathwayiq_mart.vw_frontend_occupations AS
WITH current_osl AS (
  SELECT dr.dataset_release_id
  FROM pathwayiq_core.dataset_release dr
  JOIN pathwayiq_core.dataset_source ds ON ds.dataset_source_id = dr.dataset_source_id
  WHERE ds.source_code = 'osl_filtered'
    AND dr.is_current = TRUE
)
SELECT
  o.occupation_code AS anzsco_code,
  o.preferred_title AS occupation_title,
  mg.major_group_label,
  o.skill_level,
  o.salary_median AS median_salary,
  nsr.display_label AS national_shortage_rating,
  vsr.display_label AS victoria_shortage_rating,
  COALESCE(vsr.frontend_status, 'Unknown') AS shortage_status
FROM pathwayiq_core.occupation o
JOIN pathwayiq_core.major_group mg
  ON mg.major_group_id = o.major_group_id
LEFT JOIN pathwayiq_core.occupation_shortage_snapshot oss
  ON oss.occupation_id = o.occupation_id
 AND oss.dataset_release_id IN (SELECT dataset_release_id FROM current_osl)
LEFT JOIN pathwayiq_core.shortage_rating nsr
  ON nsr.shortage_rating_id = oss.national_shortage_rating_id
LEFT JOIN pathwayiq_core.shortage_rating vsr
  ON vsr.shortage_rating_id = oss.victoria_shortage_rating_id;

CREATE OR REPLACE VIEW pathwayiq_mart.vw_frontend_programs AS
WITH current_vnda_metrics AS (
  SELECT dr.dataset_release_id
  FROM pathwayiq_core.dataset_release dr
  JOIN pathwayiq_core.dataset_source ds ON ds.dataset_source_id = dr.dataset_source_id
  WHERE ds.source_code = 'vnda_course_metrics'
    AND dr.is_current = TRUE
),
current_vet_outcomes AS (
  SELECT dr.dataset_release_id
  FROM pathwayiq_core.dataset_release dr
  JOIN pathwayiq_core.dataset_source ds ON ds.dataset_source_id = dr.dataset_source_id
  WHERE ds.source_code = 'vet_outcomes'
    AND dr.is_current = TRUE
)
SELECT
  p.program_code,
  p.program_name,
  aq.aqf_level_name,
  CASE
    WHEN COALESCE(pgm.is_apprenticeship, FALSE) THEN 'Apprenticeship'
    WHEN aq.pathway_type = 'University' THEN 'University'
    ELSE 'TAFE'
  END AS pathway,
  foe.field_of_education_name,
  ib.industry_name,
  COALESCE(pgm.median_income, pvo.median_annual_income) AS median_salary,
  pgm.pct_employed_post,
  pvo.pct_employed_or_study,
  pvo.pct_satisfied,
  COALESCE(pgm.pct_apprentice_trainees, 0) AS pct_apprentice_trainees,
  COALESCE(pgm.is_apprenticeship, FALSE) AS is_apprenticeship
FROM pathwayiq_core.program p
LEFT JOIN pathwayiq_core.aqf_level aq
  ON aq.aqf_level_id = p.aqf_level_id
LEFT JOIN pathwayiq_core.field_of_education foe
  ON foe.field_of_education_id = p.field_of_education_id
LEFT JOIN pathwayiq_core.field_of_education_industry_map fim
  ON fim.field_of_education_id = foe.field_of_education_id
LEFT JOIN pathwayiq_core.industry_bucket ib
  ON ib.industry_bucket_id = fim.industry_bucket_id
LEFT JOIN pathwayiq_core.program_graduate_metric pgm
  ON pgm.program_id = p.program_id
 AND pgm.dataset_release_id IN (SELECT dataset_release_id FROM current_vnda_metrics)
LEFT JOIN pathwayiq_core.program_vet_outcome pvo
  ON pvo.program_id = p.program_id
 AND pvo.dataset_release_id IN (SELECT dataset_release_id FROM current_vet_outcomes);

CREATE OR REPLACE VIEW pathwayiq_mart.vw_frontend_pathways AS
WITH current_pathways AS (
  SELECT dr.dataset_release_id
  FROM pathwayiq_core.dataset_release dr
  JOIN pathwayiq_core.dataset_source ds ON ds.dataset_source_id = dr.dataset_source_id
  WHERE ds.source_code = 'vnda_course_occupations'
    AND dr.is_current = TRUE
),
current_osl AS (
  SELECT dr.dataset_release_id
  FROM pathwayiq_core.dataset_release dr
  JOIN pathwayiq_core.dataset_source ds ON ds.dataset_source_id = dr.dataset_source_id
  WHERE ds.source_code = 'osl_filtered'
    AND dr.is_current = TRUE
),
current_vnda_metrics AS (
  SELECT dr.dataset_release_id
  FROM pathwayiq_core.dataset_release dr
  JOIN pathwayiq_core.dataset_source ds ON ds.dataset_source_id = dr.dataset_source_id
  WHERE ds.source_code = 'vnda_course_metrics'
    AND dr.is_current = TRUE
),
current_vet_outcomes AS (
  SELECT dr.dataset_release_id
  FROM pathwayiq_core.dataset_release dr
  JOIN pathwayiq_core.dataset_source ds ON ds.dataset_source_id = dr.dataset_source_id
  WHERE ds.source_code = 'vet_outcomes'
    AND dr.is_current = TRUE
)
SELECT
  p.program_code,
  p.program_name,
  o.occupation_code AS anzsco_code,
  o.preferred_title AS occupation_title,
  pop.pathway_rank_no,
  pop.share_pct AS occupation_share_pct,
  pop.match_status,
  aq.aqf_level_name,
  CASE
    WHEN COALESCE(pgm.is_apprenticeship, FALSE) THEN 'Apprenticeship'
    WHEN aq.pathway_type = 'University' THEN 'University'
    ELSE 'TAFE'
  END AS pathway,
  COALESCE(pgm.median_income, pvo.median_annual_income) AS median_salary,
  COALESCE(sr.frontend_status, 'Unknown') AS shortage_status
FROM pathwayiq_core.program_occupation_pathway pop
JOIN pathwayiq_core.program p
  ON p.program_id = pop.program_id
LEFT JOIN pathwayiq_core.aqf_level aq
  ON aq.aqf_level_id = p.aqf_level_id
LEFT JOIN pathwayiq_core.occupation o
  ON o.occupation_id = pop.occupation_id
LEFT JOIN pathwayiq_core.program_graduate_metric pgm
  ON pgm.program_id = p.program_id
 AND pgm.dataset_release_id IN (SELECT dataset_release_id FROM current_vnda_metrics)
LEFT JOIN pathwayiq_core.program_vet_outcome pvo
  ON pvo.program_id = p.program_id
 AND pvo.dataset_release_id IN (SELECT dataset_release_id FROM current_vet_outcomes)
LEFT JOIN pathwayiq_core.occupation_shortage_snapshot oss
  ON oss.occupation_id = o.occupation_id
 AND oss.dataset_release_id IN (SELECT dataset_release_id FROM current_osl)
LEFT JOIN pathwayiq_core.shortage_rating sr
  ON sr.shortage_rating_id = oss.victoria_shortage_rating_id
WHERE pop.dataset_release_id IN (SELECT dataset_release_id FROM current_pathways)
  AND pop.occupation_id IS NOT NULL;

CREATE OR REPLACE VIEW pathwayiq_mart.vw_frontend_career_cards AS
WITH pathway_base AS (
  SELECT
    vp.anzsco_code,
    vp.pathway,
    vp.median_salary,
    vp.pathway_rank_no,
    pop.share_pct AS occupation_share_pct,
    pop.match_status,
    p.field_of_education_id
  FROM pathwayiq_mart.vw_frontend_pathways vp
  JOIN pathwayiq_core.program p
    ON p.program_code = vp.program_code
  JOIN pathwayiq_core.occupation o
    ON o.occupation_code = vp.anzsco_code
  JOIN pathwayiq_core.program_occupation_pathway pop
    ON pop.program_id = p.program_id
   AND pop.occupation_id = o.occupation_id
   AND COALESCE(pop.pathway_rank_no, -1) = COALESCE(vp.pathway_rank_no, -1)
),
pathway_evidence AS (
  SELECT
    pb.*,
    CASE
      WHEN COALESCE(pb.pathway_rank_no, 999) <= 5 THEN 1
      WHEN COALESCE(pb.pathway_rank_no, 999) <= 10 THEN 2
      ELSE 3
    END AS evidence_tier
  FROM pathway_base pb
  WHERE pb.match_status IN ('matched_exact', 'matched_fuzzy')
    AND COALESCE(pb.occupation_share_pct, 0) > 0
),
selected_evidence AS (
  SELECT pe.*
  FROM pathway_evidence pe
  JOIN (
    SELECT
      anzsco_code,
      MIN(evidence_tier) AS best_evidence_tier
    FROM pathway_evidence
    GROUP BY anzsco_code
  ) best
    ON best.anzsco_code = pe.anzsco_code
   AND best.best_evidence_tier = pe.evidence_tier
),
pathway_scores AS (
  SELECT
    se.anzsco_code,
    se.pathway,
    SUM(
      COALESCE(se.occupation_share_pct, 0)::NUMERIC
      / GREATEST(COALESCE(se.pathway_rank_no, 1), 1)
    ) AS pathway_weight,
    MIN(se.pathway_rank_no) AS best_rank_no,
    MAX(se.median_salary) AS best_median_salary
  FROM selected_evidence se
  GROUP BY se.anzsco_code, se.pathway
),
ranked_pathways AS (
  SELECT
    ps.*,
    ROW_NUMBER() OVER (
      PARTITION BY ps.anzsco_code
      ORDER BY
        ps.pathway_weight DESC,
        ps.best_rank_no,
        ps.best_median_salary DESC,
        ps.pathway
    ) AS occupation_choice_rank
  FROM pathway_scores ps
),
industry_scores AS (
  SELECT
    se.anzsco_code,
    ib.industry_name,
    SUM(
      COALESCE(se.occupation_share_pct, 0)::NUMERIC
      / GREATEST(COALESCE(se.pathway_rank_no, 1), 1)
    ) AS industry_weight,
    MIN(se.pathway_rank_no) AS best_rank_no
  FROM selected_evidence se
  JOIN pathwayiq_core.field_of_education_industry_map fim
    ON fim.field_of_education_id = se.field_of_education_id
  JOIN pathwayiq_core.industry_bucket ib
    ON ib.industry_bucket_id = fim.industry_bucket_id
  GROUP BY se.anzsco_code, ib.industry_name
),
industry_rollup AS (
  SELECT
    iscore.*,
    ROW_NUMBER() OVER (
      PARTITION BY iscore.anzsco_code
      ORDER BY
        iscore.industry_weight DESC,
        iscore.best_rank_no,
        iscore.industry_name
    ) AS industry_rank
  FROM industry_scores iscore
)
SELECT
  vo.anzsco_code,
  vo.occupation_title AS title,
  ir.industry_name AS industry,
  ROUND(vo.median_salary)::BIGINT AS median_salary,
  rp.pathway AS pathway,
  vo.shortage_status
FROM pathwayiq_mart.vw_frontend_occupations vo
JOIN ranked_pathways rp
  ON rp.anzsco_code = vo.anzsco_code
 AND rp.occupation_choice_rank = 1
JOIN industry_rollup ir
  ON ir.anzsco_code = vo.anzsco_code
 AND ir.industry_rank = 1
WHERE vo.median_salary IS NOT NULL
  AND vo.shortage_status <> 'Unknown';

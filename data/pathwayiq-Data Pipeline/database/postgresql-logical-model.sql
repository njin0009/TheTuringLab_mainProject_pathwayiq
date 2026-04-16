CREATE SCHEMA IF NOT EXISTS pathwayiq;

CREATE DOMAIN pathwayiq.percentage_value AS NUMERIC(5,2)
  CHECK (VALUE >= 0 AND VALUE <= 100);

CREATE DOMAIN pathwayiq.non_negative_amount AS NUMERIC(12,2)
  CHECK (VALUE >= 0);

CREATE DOMAIN pathwayiq.anzsco_code_value AS TEXT
  CHECK (VALUE ~ '^[0-9]{6}$');

CREATE TABLE IF NOT EXISTS pathwayiq.dataset_source (
  dataset_source_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_code TEXT NOT NULL UNIQUE,
  source_name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE IF NOT EXISTS pathwayiq.dataset_release (
  dataset_release_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset_source_id BIGINT NOT NULL REFERENCES pathwayiq.dataset_source (dataset_source_id),
  source_object_name TEXT NOT NULL,
  release_label TEXT NOT NULL DEFAULT '',
  release_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (dataset_source_id, source_object_name, release_label)
);

CREATE TABLE IF NOT EXISTS pathwayiq.major_group (
  major_group_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  major_group_code TEXT NOT NULL UNIQUE,
  major_group_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pathwayiq.shortage_rating (
  shortage_rating_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  shortage_rating_code TEXT NOT NULL UNIQUE,
  display_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pathwayiq.aqf_level (
  aqf_level_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aqf_level_name TEXT NOT NULL UNIQUE,
  pathway_type TEXT NOT NULL,
  CHECK (pathway_type IN ('TAFE', 'University'))
);

CREATE TABLE IF NOT EXISTS pathwayiq.field_of_education (
  field_of_education_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  field_of_education_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS pathwayiq.industry_bucket (
  industry_bucket_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  industry_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS pathwayiq.field_of_education_industry_map (
  field_of_education_id BIGINT PRIMARY KEY REFERENCES pathwayiq.field_of_education (field_of_education_id),
  industry_bucket_id BIGINT NOT NULL REFERENCES pathwayiq.industry_bucket (industry_bucket_id)
);

CREATE TABLE IF NOT EXISTS pathwayiq.occupation (
  occupation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occupation_code pathwayiq.anzsco_code_value NOT NULL UNIQUE,
  preferred_title TEXT NOT NULL,
  normalized_preferred_title TEXT NOT NULL,
  skill_level SMALLINT,
  salary_median pathwayiq.non_negative_amount,
  major_group_id BIGINT NOT NULL REFERENCES pathwayiq.major_group (major_group_id),
  CHECK (skill_level BETWEEN 1 AND 5 OR skill_level IS NULL)
);

CREATE TABLE IF NOT EXISTS pathwayiq.occupation_title_alias (
  occupation_title_alias_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occupation_id BIGINT NOT NULL REFERENCES pathwayiq.occupation (occupation_id),
  title_text TEXT NOT NULL,
  normalized_title_text TEXT NOT NULL,
  title_type_code TEXT NOT NULL DEFAULT '',
  title_type_label TEXT,
  jurisdiction_scope TEXT NOT NULL DEFAULT '',
  is_preferred_title BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (occupation_id, normalized_title_text, title_type_code, jurisdiction_scope)
);

CREATE TABLE IF NOT EXISTS pathwayiq.occupation_shortage_snapshot (
  occupation_shortage_snapshot_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset_release_id BIGINT NOT NULL REFERENCES pathwayiq.dataset_release (dataset_release_id),
  occupation_id BIGINT NOT NULL REFERENCES pathwayiq.occupation (occupation_id),
  national_shortage_rating_id BIGINT NOT NULL REFERENCES pathwayiq.shortage_rating (shortage_rating_id),
  victoria_shortage_rating_id BIGINT NOT NULL REFERENCES pathwayiq.shortage_rating (shortage_rating_id),
  UNIQUE (dataset_release_id, occupation_id)
);

CREATE TABLE IF NOT EXISTS pathwayiq.program (
  program_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  program_code TEXT NOT NULL UNIQUE,
  program_name TEXT NOT NULL,
  normalized_program_name TEXT NOT NULL,
  aqf_level_id BIGINT REFERENCES pathwayiq.aqf_level (aqf_level_id),
  field_of_education_id BIGINT REFERENCES pathwayiq.field_of_education (field_of_education_id)
);

CREATE TABLE IF NOT EXISTS pathwayiq.program_graduate_metric (
  program_graduate_metric_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset_release_id BIGINT NOT NULL REFERENCES pathwayiq.dataset_release (dataset_release_id),
  program_id BIGINT NOT NULL REFERENCES pathwayiq.program (program_id),
  course_rank INTEGER,
  count_of_unique_occupations INTEGER,
  pct_employed_post pathwayiq.percentage_value,
  pct_employed_tot_post pathwayiq.percentage_value,
  pct_higher_vet_progression pathwayiq.percentage_value,
  pct_any_vet_progression pathwayiq.percentage_value,
  pct_apprentice_trainees pathwayiq.percentage_value,
  is_apprenticeship BOOLEAN NOT NULL DEFAULT FALSE,
  median_income pathwayiq.non_negative_amount,
  median_income_total pathwayiq.non_negative_amount,
  total_ft_median_income pathwayiq.non_negative_amount,
  UNIQUE (dataset_release_id, program_id)
);

CREATE TABLE IF NOT EXISTS pathwayiq.program_vet_outcome (
  program_vet_outcome_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset_release_id BIGINT NOT NULL REFERENCES pathwayiq.dataset_release (dataset_release_id),
  program_id BIGINT NOT NULL REFERENCES pathwayiq.program (program_id),
  n_respondents INTEGER,
  pct_employed_or_study pathwayiq.percentage_value,
  pct_improved_employment pathwayiq.percentage_value,
  pct_commenced_further_study pathwayiq.percentage_value,
  pct_satisfied pathwayiq.percentage_value,
  median_annual_income pathwayiq.non_negative_amount,
  median_annual_income_imputed_flag BOOLEAN NOT NULL DEFAULT FALSE,
  median_annual_income_value_source TEXT,
  median_annual_income_structural_missing_flag BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (dataset_release_id, program_id)
);

CREATE TABLE IF NOT EXISTS pathwayiq.program_vet_top_occupation_group (
  program_vet_top_occupation_group_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  program_vet_outcome_id BIGINT NOT NULL REFERENCES pathwayiq.program_vet_outcome (program_vet_outcome_id),
  rank_no SMALLINT NOT NULL CHECK (rank_no BETWEEN 1 AND 3),
  occupation_group_label TEXT NOT NULL,
  share_pct pathwayiq.percentage_value,
  UNIQUE (program_vet_outcome_id, rank_no)
);

CREATE TABLE IF NOT EXISTS pathwayiq.program_vet_top_industry (
  program_vet_top_industry_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  program_vet_outcome_id BIGINT NOT NULL REFERENCES pathwayiq.program_vet_outcome (program_vet_outcome_id),
  rank_no SMALLINT NOT NULL CHECK (rank_no BETWEEN 1 AND 3),
  industry_label TEXT NOT NULL,
  share_pct pathwayiq.percentage_value,
  UNIQUE (program_vet_outcome_id, rank_no)
);

CREATE TABLE IF NOT EXISTS pathwayiq.program_occupation_pathway (
  program_occupation_pathway_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dataset_release_id BIGINT NOT NULL REFERENCES pathwayiq.dataset_release (dataset_release_id),
  program_id BIGINT NOT NULL REFERENCES pathwayiq.program (program_id),
  occupation_id BIGINT REFERENCES pathwayiq.occupation (occupation_id),
  occupation_title_text TEXT NOT NULL,
  pathway_rank_no INTEGER,
  share_pct pathwayiq.percentage_value,
  match_method TEXT,
  match_score NUMERIC(5,2),
  match_status TEXT NOT NULL,
  UNIQUE (dataset_release_id, program_id, pathway_rank_no)

);

 




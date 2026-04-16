PRAGMA foreign_keys = ON;

-- PathwayIQ Cloudflare D1 / SQLite schema
-- ---------------------------------------
-- Design intent:
-- 1. Each table represents a single subject area.
-- 2. M:N relationships are resolved with bridge tables.
-- 3. Natural keys are retained when stable (ANZSCO code, program ID).
-- 4. CHECK constraints enforce domain integrity at the database layer.
-- 5. Dataset metadata is stored so freshness and auditability are queryable.

CREATE TABLE IF NOT EXISTS ingestion_run (
  run_id TEXT PRIMARY KEY,
  loader_version TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS dataset_catalog (
  dataset_code TEXT PRIMARY KEY,
  dataset_name TEXT NOT NULL UNIQUE,
  source_organisation TEXT NOT NULL,
  source_grain TEXT NOT NULL,
  source_file_name TEXT NOT NULL,
  is_canonical INTEGER NOT NULL DEFAULT 1 CHECK (is_canonical IN (0, 1)),
  description TEXT
);

CREATE TABLE IF NOT EXISTS dataset_load (
  run_id TEXT NOT NULL,
  dataset_code TEXT NOT NULL,
  cleaned_csv_path TEXT NOT NULL,
  loaded_rows INTEGER NOT NULL CHECK (loaded_rows >= 0),
  skipped_rows INTEGER NOT NULL DEFAULT 0 CHECK (skipped_rows >= 0),
  file_modified_at TEXT,
  loaded_at TEXT NOT NULL,
  PRIMARY KEY (run_id, dataset_code),
  FOREIGN KEY (run_id) REFERENCES ingestion_run(run_id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (dataset_code) REFERENCES dataset_catalog(dataset_code) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS data_quality_issue (
  issue_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  dataset_code TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  record_key TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES ingestion_run(run_id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (dataset_code) REFERENCES dataset_catalog(dataset_code) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS data_quality_metric (
  metric_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  dataset_code TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  quality_dimension TEXT NOT NULL CHECK (
    quality_dimension IN (
      'accuracy',
      'completeness',
      'consistency',
      'validity',
      'uniqueness',
      'timeliness',
      'referential_integrity',
      'normalization'
    )
  ),
  numerator REAL NOT NULL,
  denominator REAL NOT NULL CHECK (denominator >= 0),
  score REAL NOT NULL,
  measure_name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES ingestion_run(run_id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (dataset_code) REFERENCES dataset_catalog(dataset_code) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS major_group (
  major_group_code INTEGER PRIMARY KEY CHECK (major_group_code BETWEEN 1 AND 8),
  major_group_label TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS shortage_rating (
  shortage_rating TEXT PRIMARY KEY CHECK (
    shortage_rating IN ('Shortage', 'Metro Shortage', 'Regional Shortage', 'No Shortage')
  ),
  display_order INTEGER NOT NULL UNIQUE CHECK (display_order BETWEEN 1 AND 4)
);

CREATE TABLE IF NOT EXISTS state_dim (
  state_code TEXT PRIMARY KEY,
  state_name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS aqf_level_dim (
  aqf_level TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS field_of_education_dim (
  field_of_education TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS survey_dataset_dim (
  slice_dataset TEXT PRIMARY KEY CHECK (
    slice_dataset IN ('overall', 'state_territory', 'industry', 'employer_size', 'training_type')
  )
);

CREATE TABLE IF NOT EXISTS contract_type_dim (
  contract_type TEXT PRIMARY KEY CHECK (
    contract_type IN ('Commencements', 'Completions', 'In-Training', 'Cancellations/Withdrawals')
  )
);

CREATE TABLE IF NOT EXISTS estimate_type_dim (
  estimate_type TEXT PRIMARY KEY CHECK (estimate_type IN ('Initial', '1st Revision'))
);

CREATE TABLE IF NOT EXISTS occupation (
  anzsco_code TEXT PRIMARY KEY CHECK (
    length(anzsco_code) = 6 AND anzsco_code GLOB '[0-9][0-9][0-9][0-9][0-9][0-9]'
  ),
  preferred_title TEXT NOT NULL,
  normalised_preferred_title TEXT NOT NULL,
  major_group_code INTEGER NOT NULL,
  sub_major_group_code TEXT CHECK (sub_major_group_code IS NULL OR length(sub_major_group_code) = 2),
  minor_group_code TEXT CHECK (minor_group_code IS NULL OR length(minor_group_code) = 3),
  unit_group_code TEXT CHECK (unit_group_code IS NULL OR length(unit_group_code) = 4),
  preferred_title_type TEXT,
  preferred_jurisdiction_scope TEXT,
  default_skill_level INTEGER CHECK (default_skill_level IS NULL OR default_skill_level BETWEEN 1 AND 5),
  created_from_reference INTEGER NOT NULL DEFAULT 1 CHECK (created_from_reference IN (0, 1)),
  FOREIGN KEY (major_group_code) REFERENCES major_group(major_group_code) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS occupation_title_alias (
  alias_id INTEGER PRIMARY KEY AUTOINCREMENT,
  anzsco_code TEXT NOT NULL,
  raw_title TEXT NOT NULL,
  normalised_title TEXT NOT NULL,
  title_type_code TEXT NOT NULL,
  title_type TEXT NOT NULL,
  jurisdiction_scope TEXT NOT NULL,
  is_preferred_title INTEGER NOT NULL DEFAULT 0 CHECK (is_preferred_title IN (0, 1)),
  UNIQUE (anzsco_code, normalised_title, title_type_code, jurisdiction_scope),
  FOREIGN KEY (anzsco_code) REFERENCES occupation(anzsco_code) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS occupation_shortage_snapshot (
  dataset_code TEXT NOT NULL,
  anzsco_code TEXT NOT NULL,
  occupation_title TEXT NOT NULL,
  national_shortage_rating TEXT NOT NULL,
  victoria_shortage_rating TEXT,
  skill_level INTEGER CHECK (skill_level IS NULL OR skill_level BETWEEN 1 AND 5),
  major_group_code INTEGER,
  PRIMARY KEY (dataset_code, anzsco_code),
  FOREIGN KEY (dataset_code) REFERENCES dataset_catalog(dataset_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (anzsco_code) REFERENCES occupation(anzsco_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (national_shortage_rating) REFERENCES shortage_rating(shortage_rating) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (victoria_shortage_rating) REFERENCES shortage_rating(shortage_rating) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (major_group_code) REFERENCES major_group(major_group_code) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS occupation_shortage_state_rating (
  dataset_code TEXT NOT NULL,
  anzsco_code TEXT NOT NULL,
  state_code TEXT NOT NULL,
  shortage_rating TEXT NOT NULL,
  PRIMARY KEY (dataset_code, anzsco_code, state_code),
  FOREIGN KEY (dataset_code) REFERENCES dataset_catalog(dataset_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (anzsco_code) REFERENCES occupation(anzsco_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (state_code) REFERENCES state_dim(state_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (shortage_rating) REFERENCES shortage_rating(shortage_rating) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS unit_group (
  unit_group_name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS occupation_shortage_driver (
  driver_id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_code TEXT NOT NULL,
  unit_group_name TEXT NOT NULL,
  driver_2024 TEXT,
  driver_2025 TEXT,
  source_table TEXT,
  source_tables TEXT,
  source_table_count INTEGER CHECK (source_table_count IS NULL OR source_table_count >= 0),
  source_type TEXT,
  source_id TEXT,
  ivi_ue_ratio REAL,
  employment_growth_5yr REAL,
  in_shortage_2025_flag INTEGER NOT NULL CHECK (in_shortage_2025_flag IN (0, 1)),
  new_shortage_2025_flag INTEGER NOT NULL CHECK (new_shortage_2025_flag IN (0, 1)),
  no_longer_shortage_2025_flag INTEGER NOT NULL CHECK (no_longer_shortage_2025_flag IN (0, 1)),
  driver_2024_source_mismatch_flag INTEGER NOT NULL CHECK (driver_2024_source_mismatch_flag IN (0, 1)),
  driver_2025_source_mismatch_flag INTEGER NOT NULL CHECK (driver_2025_source_mismatch_flag IN (0, 1)),
  source_status_conflict_flag INTEGER NOT NULL CHECK (source_status_conflict_flag IN (0, 1)),
  shortage_driver TEXT,
  driver_conflict TEXT,
  ivi_ue_ratio_negative_flag INTEGER NOT NULL CHECK (ivi_ue_ratio_negative_flag IN (0, 1)),
  employment_growth_extreme_flag INTEGER NOT NULL CHECK (employment_growth_extreme_flag IN (0, 1)),
  anzsco_join_note TEXT,
  UNIQUE (dataset_code, unit_group_name, source_id, source_table),
  FOREIGN KEY (dataset_code) REFERENCES dataset_catalog(dataset_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (unit_group_name) REFERENCES unit_group(unit_group_name) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS program (
  program_id TEXT PRIMARY KEY,
  program_name TEXT NOT NULL,
  aqf_level TEXT,
  field_of_education TEXT,
  has_vet_outcomes INTEGER NOT NULL DEFAULT 0 CHECK (has_vet_outcomes IN (0, 1)),
  has_vnda_metrics INTEGER NOT NULL DEFAULT 0 CHECK (has_vnda_metrics IN (0, 1)),
  FOREIGN KEY (aqf_level) REFERENCES aqf_level_dim(aqf_level) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (field_of_education) REFERENCES field_of_education_dim(field_of_education) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS program_vet_outcome (
  dataset_code TEXT NOT NULL,
  program_id TEXT NOT NULL,
  n_respondents INTEGER CHECK (n_respondents IS NULL OR n_respondents >= 0),
  pct_employed_or_study REAL CHECK (pct_employed_or_study IS NULL OR (pct_employed_or_study BETWEEN 0 AND 100)),
  pct_improved_employment REAL CHECK (pct_improved_employment IS NULL OR (pct_improved_employment BETWEEN 0 AND 100)),
  pct_commenced_further_study REAL CHECK (pct_commenced_further_study IS NULL OR (pct_commenced_further_study BETWEEN 0 AND 100)),
  pct_satisfied REAL CHECK (pct_satisfied IS NULL OR (pct_satisfied BETWEEN 0 AND 100)),
  median_annual_income REAL CHECK (median_annual_income IS NULL OR median_annual_income >= 0),
  median_annual_income_original REAL CHECK (median_annual_income_original IS NULL OR median_annual_income_original >= 0),
  median_annual_income_imputed_flag INTEGER NOT NULL CHECK (median_annual_income_imputed_flag IN (0, 1)),
  median_annual_income_value_source TEXT,
  median_annual_income_imputation_basis TEXT,
  median_annual_income_structural_missing_flag INTEGER NOT NULL CHECK (median_annual_income_structural_missing_flag IN (0, 1)),
  median_annual_income_model_prediction REAL CHECK (median_annual_income_model_prediction IS NULL OR median_annual_income_model_prediction >= 0),
  median_annual_income_prediction_clipped_flag INTEGER NOT NULL CHECK (median_annual_income_prediction_clipped_flag IN (0, 1)),
  industry_profile_note TEXT,
  occupation_pct_normalized_flag INTEGER NOT NULL CHECK (occupation_pct_normalized_flag IN (0, 1)),
  occupation_top3_pct_total REAL CHECK (occupation_top3_pct_total IS NULL OR occupation_top3_pct_total BETWEEN 0 AND 100),
  occupation_other_pct REAL CHECK (occupation_other_pct IS NULL OR occupation_other_pct BETWEEN 0 AND 100),
  industry_pct_normalized_flag INTEGER NOT NULL CHECK (industry_pct_normalized_flag IN (0, 1)),
  industry_top3_pct_total REAL CHECK (industry_top3_pct_total IS NULL OR industry_top3_pct_total BETWEEN 0 AND 100),
  median_annual_income_outlier_flag INTEGER NOT NULL CHECK (median_annual_income_outlier_flag IN (0, 1)),
  PRIMARY KEY (dataset_code, program_id),
  FOREIGN KEY (dataset_code) REFERENCES dataset_catalog(dataset_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (program_id) REFERENCES program(program_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS program_vet_top_occupation (
  dataset_code TEXT NOT NULL,
  program_id TEXT NOT NULL,
  rank_no INTEGER NOT NULL CHECK (rank_no BETWEEN 1 AND 3),
  occupation_label TEXT NOT NULL,
  pct_employed_in_occ REAL CHECK (pct_employed_in_occ IS NULL OR (pct_employed_in_occ BETWEEN 0 AND 100)),
  anzsco_major_group_code INTEGER,
  anzsco_major_group_label TEXT,
  PRIMARY KEY (dataset_code, program_id, rank_no),
  FOREIGN KEY (dataset_code, program_id) REFERENCES program_vet_outcome(dataset_code, program_id) ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (anzsco_major_group_code) REFERENCES major_group(major_group_code) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS program_vet_top_industry (
  dataset_code TEXT NOT NULL,
  program_id TEXT NOT NULL,
  rank_no INTEGER NOT NULL CHECK (rank_no BETWEEN 1 AND 3),
  industry_label TEXT NOT NULL,
  pct_employed_in_industry REAL CHECK (pct_employed_in_industry IS NULL OR (pct_employed_in_industry BETWEEN 0 AND 100)),
  PRIMARY KEY (dataset_code, program_id, rank_no),
  FOREIGN KEY (dataset_code, program_id) REFERENCES program_vet_outcome(dataset_code, program_id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS program_graduate_metric (
  dataset_code TEXT NOT NULL,
  program_id TEXT NOT NULL,
  course_rank INTEGER CHECK (course_rank IS NULL OR course_rank >= 0),
  small_count_flag INTEGER NOT NULL CHECK (small_count_flag IN (0, 1)),
  pct_employed_prior REAL CHECK (pct_employed_prior IS NULL OR pct_employed_prior BETWEEN 0 AND 100),
  pct_employed_post REAL CHECK (pct_employed_post IS NULL OR pct_employed_post BETWEEN 0 AND 100),
  pptchange_employment REAL,
  pct_employed_tot_prior REAL CHECK (pct_employed_tot_prior IS NULL OR pct_employed_tot_prior BETWEEN 0 AND 100),
  pct_employed_tot_post REAL CHECK (pct_employed_tot_post IS NULL OR pct_employed_tot_post BETWEEN 0 AND 100),
  pctpt_change_in_tot_employment REAL,
  pct_employed_pt_prior REAL CHECK (pct_employed_pt_prior IS NULL OR pct_employed_pt_prior BETWEEN 0 AND 100),
  pct_employed_pt_post REAL CHECK (pct_employed_pt_post IS NULL OR pct_employed_pt_post BETWEEN 0 AND 100),
  pctpt_change_in_pt_employment REAL,
  pct_employed_ft_prior REAL CHECK (pct_employed_ft_prior IS NULL OR pct_employed_ft_prior BETWEEN 0 AND 100),
  pct_employed_ft_post REAL CHECK (pct_employed_ft_post IS NULL OR pct_employed_ft_post BETWEEN 0 AND 100),
  pctpt_change_in_ft_employment REAL,
  median_income REAL CHECK (median_income IS NULL OR median_income >= 0),
  median_income_change REAL,
  median_income_total REAL CHECK (median_income_total IS NULL OR median_income_total >= 0),
  median_income_total_change REAL,
  total_ft_median_income REAL CHECK (total_ft_median_income IS NULL OR total_ft_median_income >= 0),
  total_ft_median_income_change REAL,
  income_support_exit_rate REAL CHECK (income_support_exit_rate IS NULL OR income_support_exit_rate BETWEEN 0 AND 100),
  pct_higher_vet_progression REAL CHECK (pct_higher_vet_progression IS NULL OR pct_higher_vet_progression BETWEEN 0 AND 100),
  pct_any_vet_progression REAL CHECK (pct_any_vet_progression IS NULL OR pct_any_vet_progression BETWEEN 0 AND 100),
  pct_female REAL CHECK (pct_female IS NULL OR pct_female BETWEEN 0 AND 100),
  pct_disability REAL CHECK (pct_disability IS NULL OR pct_disability BETWEEN 0 AND 100),
  pct_apprentice_trainees REAL CHECK (pct_apprentice_trainees IS NULL OR pct_apprentice_trainees BETWEEN 0 AND 100),
  pct_first_nations REAL CHECK (pct_first_nations IS NULL OR pct_first_nations BETWEEN 0 AND 100),
  pct_no_yr12_no_cert_iii REAL CHECK (pct_no_yr12_no_cert_iii IS NULL OR pct_no_yr12_no_cert_iii BETWEEN 0 AND 100),
  pct_government_funded REAL CHECK (pct_government_funded IS NULL OR pct_government_funded BETWEEN 0 AND 100),
  median_completion_age_yrs REAL CHECK (median_completion_age_yrs IS NULL OR median_completion_age_yrs >= 0),
  median_completion_time_days REAL CHECK (median_completion_time_days IS NULL OR median_completion_time_days >= 0),
  pct_remote REAL CHECK (pct_remote IS NULL OR pct_remote BETWEEN 0 AND 100),
  pct_regional REAL CHECK (pct_regional IS NULL OR pct_regional BETWEEN 0 AND 100),
  pct_major_city REAL CHECK (pct_major_city IS NULL OR pct_major_city BETWEEN 0 AND 100),
  count_of_unique_occupations INTEGER CHECK (count_of_unique_occupations IS NULL OR count_of_unique_occupations >= 0),
  source_sheet TEXT,
  suppressed_value_count INTEGER NOT NULL DEFAULT 0 CHECK (suppressed_value_count >= 0),
  has_suppressed_values INTEGER NOT NULL CHECK (has_suppressed_values IN (0, 1)),
  median_income_outlier_flag INTEGER NOT NULL CHECK (median_income_outlier_flag IN (0, 1)),
  median_income_change_outlier_flag INTEGER NOT NULL CHECK (median_income_change_outlier_flag IN (0, 1)),
  median_income_total_outlier_flag INTEGER NOT NULL CHECK (median_income_total_outlier_flag IN (0, 1)),
  median_income_total_change_outlier_flag INTEGER NOT NULL CHECK (median_income_total_change_outlier_flag IN (0, 1)),
  total_ft_median_income_outlier_flag INTEGER NOT NULL CHECK (total_ft_median_income_outlier_flag IN (0, 1)),
  total_ft_median_income_change_outlier_flag INTEGER NOT NULL CHECK (total_ft_median_income_change_outlier_flag IN (0, 1)),
  PRIMARY KEY (dataset_code, program_id),
  FOREIGN KEY (dataset_code) REFERENCES dataset_catalog(dataset_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (program_id) REFERENCES program(program_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS program_occupation_pathway (
  pathway_id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_code TEXT NOT NULL,
  program_id TEXT NOT NULL,
  occupation_name TEXT NOT NULL,
  pct_share REAL CHECK (pct_share IS NULL OR pct_share BETWEEN 0 AND 100),
  source_sheet TEXT NOT NULL,
  anzsco_code TEXT,
  anzsco_match_method TEXT,
  anzsco_match_score REAL CHECK (anzsco_match_score IS NULL OR (anzsco_match_score BETWEEN 0 AND 100)),
  anzsco_match_status TEXT,
  course_occupation_rank INTEGER CHECK (course_occupation_rank IS NULL OR course_occupation_rank >= 1),
  UNIQUE (dataset_code, program_id, source_sheet, course_occupation_rank, occupation_name),
  FOREIGN KEY (dataset_code) REFERENCES dataset_catalog(dataset_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (program_id) REFERENCES program(program_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (anzsco_code) REFERENCES occupation(anzsco_code) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS graduate_outcome_summary (
  summary_key TEXT PRIMARY KEY,
  dataset_code TEXT NOT NULL,
  summary_scope TEXT NOT NULL CHECK (
    summary_scope IN ('national_cohort', 'state', 'aqf', 'aqf_foe_national', 'aqf_foe_state')
  ),
  state_code TEXT,
  aqf_level TEXT,
  field_of_education TEXT,
  jurisdiction_label TEXT,
  cohort_group TEXT,
  cohort_label TEXT,
  aqf_foe_label TEXT,
  scope_share_pct REAL CHECK (scope_share_pct IS NULL OR scope_share_pct BETWEEN 0 AND 100),
  small_count_flag INTEGER CHECK (small_count_flag IS NULL OR small_count_flag IN (0, 1)),
  no_of_different_occupations INTEGER CHECK (no_of_different_occupations IS NULL OR no_of_different_occupations >= 0),
  cert_order INTEGER CHECK (cert_order IS NULL OR cert_order >= 0),
  pct_employed_prior REAL CHECK (pct_employed_prior IS NULL OR pct_employed_prior BETWEEN 0 AND 100),
  pct_employed_post REAL CHECK (pct_employed_post IS NULL OR pct_employed_post BETWEEN 0 AND 100),
  pptchange_employment REAL,
  pct_employed_tot_prior REAL CHECK (pct_employed_tot_prior IS NULL OR pct_employed_tot_prior BETWEEN 0 AND 100),
  pct_employed_tot_post REAL CHECK (pct_employed_tot_post IS NULL OR pct_employed_tot_post BETWEEN 0 AND 100),
  pctpt_change_in_tot_employment REAL,
  pct_employed_pt_prior REAL CHECK (pct_employed_pt_prior IS NULL OR pct_employed_pt_prior BETWEEN 0 AND 100),
  pct_employed_pt_post REAL CHECK (pct_employed_pt_post IS NULL OR pct_employed_pt_post BETWEEN 0 AND 100),
  pctpt_change_in_pt_employment REAL,
  pt_prior_ft_post_pct_of_all_students REAL CHECK (
    pt_prior_ft_post_pct_of_all_students IS NULL OR pt_prior_ft_post_pct_of_all_students BETWEEN 0 AND 100
  ),
  pct_employed_ft_prior REAL CHECK (pct_employed_ft_prior IS NULL OR pct_employed_ft_prior BETWEEN 0 AND 100),
  pct_employed_ft_post REAL CHECK (pct_employed_ft_post IS NULL OR pct_employed_ft_post BETWEEN 0 AND 100),
  pctpt_change_in_ft_employment REAL,
  median_income REAL CHECK (median_income IS NULL OR median_income >= 0),
  median_income_change REAL,
  median_income_total REAL CHECK (median_income_total IS NULL OR median_income_total >= 0),
  median_income_total_change REAL,
  total_ft_median_income REAL CHECK (total_ft_median_income IS NULL OR total_ft_median_income >= 0),
  total_ft_median_income_change REAL,
  income_support_exit_rate REAL CHECK (income_support_exit_rate IS NULL OR income_support_exit_rate BETWEEN 0 AND 100),
  pct_higher_vet_progression REAL CHECK (pct_higher_vet_progression IS NULL OR pct_higher_vet_progression BETWEEN 0 AND 100),
  pct_any_vet_progression REAL CHECK (pct_any_vet_progression IS NULL OR pct_any_vet_progression BETWEEN 0 AND 100),
  pct_female REAL CHECK (pct_female IS NULL OR pct_female BETWEEN 0 AND 100),
  pct_disability REAL CHECK (pct_disability IS NULL OR pct_disability BETWEEN 0 AND 100),
  pct_apprentice_trainees REAL CHECK (pct_apprentice_trainees IS NULL OR pct_apprentice_trainees BETWEEN 0 AND 100),
  pct_first_nations REAL CHECK (pct_first_nations IS NULL OR pct_first_nations BETWEEN 0 AND 100),
  pct_no_yr12_no_cert_iii REAL CHECK (pct_no_yr12_no_cert_iii IS NULL OR pct_no_yr12_no_cert_iii BETWEEN 0 AND 100),
  pct_government_funded REAL CHECK (pct_government_funded IS NULL OR pct_government_funded BETWEEN 0 AND 100),
  median_completion_age_yrs REAL CHECK (median_completion_age_yrs IS NULL OR median_completion_age_yrs >= 0),
  median_completion_time_days REAL CHECK (median_completion_time_days IS NULL OR median_completion_time_days >= 0),
  pct_remote REAL CHECK (pct_remote IS NULL OR pct_remote BETWEEN 0 AND 100),
  pct_regional REAL CHECK (pct_regional IS NULL OR pct_regional BETWEEN 0 AND 100),
  pct_major_city REAL CHECK (pct_major_city IS NULL OR pct_major_city BETWEEN 0 AND 100),
  source_sheet TEXT,
  suppressed_value_count INTEGER NOT NULL DEFAULT 0 CHECK (suppressed_value_count >= 0),
  has_suppressed_values INTEGER NOT NULL CHECK (has_suppressed_values IN (0, 1)),
  median_income_outlier_flag INTEGER NOT NULL CHECK (median_income_outlier_flag IN (0, 1)),
  median_income_change_outlier_flag INTEGER NOT NULL CHECK (median_income_change_outlier_flag IN (0, 1)),
  median_income_total_outlier_flag INTEGER NOT NULL CHECK (median_income_total_outlier_flag IN (0, 1)),
  median_income_total_change_outlier_flag INTEGER NOT NULL CHECK (median_income_total_change_outlier_flag IN (0, 1)),
  total_ft_median_income_outlier_flag INTEGER NOT NULL CHECK (total_ft_median_income_outlier_flag IN (0, 1)),
  total_ft_median_income_change_outlier_flag INTEGER NOT NULL CHECK (total_ft_median_income_change_outlier_flag IN (0, 1)),
  FOREIGN KEY (dataset_code) REFERENCES dataset_catalog(dataset_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (state_code) REFERENCES state_dim(state_code) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (aqf_level) REFERENCES aqf_level_dim(aqf_level) ON UPDATE CASCADE ON DELETE SET NULL,
  FOREIGN KEY (field_of_education) REFERENCES field_of_education_dim(field_of_education) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS survey_table (
  table_id TEXT PRIMARY KEY,
  table_number TEXT NOT NULL,
  table_title TEXT NOT NULL,
  slice_dataset TEXT NOT NULL,
  is_ai_module INTEGER NOT NULL CHECK (is_ai_module IN (0, 1)),
  anzsco_join_note TEXT,
  FOREIGN KEY (slice_dataset) REFERENCES survey_dataset_dim(slice_dataset) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS survey_metric (
  metric_id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id TEXT NOT NULL,
  slice_section TEXT NOT NULL,
  metric_label TEXT NOT NULL,
  measure_label TEXT NOT NULL,
  value_unit TEXT NOT NULL CHECK (value_unit IN ('count', 'pct')),
  UNIQUE (table_id, slice_section, metric_label, measure_label, value_unit),
  FOREIGN KEY (table_id) REFERENCES survey_table(table_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS survey_observation (
  metric_id INTEGER NOT NULL,
  survey_year INTEGER NOT NULL CHECK (survey_year BETWEEN 2000 AND 2100),
  value REAL,
  value_raw TEXT,
  value_status TEXT NOT NULL CHECK (value_status IN ('reported', 'not_available', 'not_publishable')),
  value_has_asterisk INTEGER NOT NULL CHECK (value_has_asterisk IN (0, 1)),
  value_outlier_flag INTEGER NOT NULL CHECK (value_outlier_flag IN (0, 1)),
  PRIMARY KEY (metric_id, survey_year),
  FOREIGN KEY (metric_id) REFERENCES survey_metric(metric_id) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS apprenticeship_estimate (
  estimate_id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_code TEXT NOT NULL,
  state_code TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  collection_quarter TEXT NOT NULL,
  collection_number INTEGER,
  review_quarter_date TEXT,
  estimate REAL,
  model_estimate REAL,
  estimate_type TEXT NOT NULL,
  ci_lower_95 REAL,
  ci_upper_95 REAL,
  final_count INTEGER CHECK (final_count IS NULL OR final_count >= 0),
  pct_of_final_count REAL CHECK (pct_of_final_count IS NULL OR pct_of_final_count >= 0),
  final_count_in_pi INTEGER CHECK (final_count_in_pi IS NULL OR final_count_in_pi >= 0),
  raw_collected_count INTEGER CHECK (raw_collected_count IS NULL OR raw_collected_count >= 0),
  model_pct_of_final_count REAL CHECK (model_pct_of_final_count IS NULL OR model_pct_of_final_count >= 0),
  collection_year INTEGER CHECK (collection_year IS NULL OR collection_year BETWEEN 2000 AND 2100),
  collection_quarter_number INTEGER CHECK (collection_quarter_number IS NULL OR collection_quarter_number BETWEEN 1 AND 4),
  collection_quarter_label TEXT,
  abs_pct_error REAL CHECK (abs_pct_error IS NULL OR abs_pct_error >= 0),
  within_5pct_of_final INTEGER NOT NULL CHECK (within_5pct_of_final IN (0, 1)),
  pct_of_final_count_outlier_flag INTEGER NOT NULL CHECK (pct_of_final_count_outlier_flag IN (0, 1)),
  anzsco_join_note TEXT,
  UNIQUE (dataset_code, state_code, contract_type, collection_quarter, estimate_type),
  FOREIGN KEY (dataset_code) REFERENCES dataset_catalog(dataset_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (state_code) REFERENCES state_dim(state_code) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (contract_type) REFERENCES contract_type_dim(contract_type) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (estimate_type) REFERENCES estimate_type_dim(estimate_type) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_occupation_major_group ON occupation (major_group_code);
CREATE INDEX IF NOT EXISTS idx_alias_normalised_title ON occupation_title_alias (normalised_title);
CREATE INDEX IF NOT EXISTS idx_shortage_vic_rating ON occupation_shortage_snapshot (victoria_shortage_rating);
CREATE INDEX IF NOT EXISTS idx_program_aqf_foe ON program (aqf_level, field_of_education);
CREATE INDEX IF NOT EXISTS idx_pathway_program ON program_occupation_pathway (program_id);
CREATE INDEX IF NOT EXISTS idx_pathway_anzsco ON program_occupation_pathway (anzsco_code);
CREATE INDEX IF NOT EXISTS idx_graduate_scope ON graduate_outcome_summary (summary_scope, state_code, aqf_level, field_of_education);
CREATE INDEX IF NOT EXISTS idx_survey_metric_table ON survey_metric (table_id);
CREATE INDEX IF NOT EXISTS idx_apprenticeship_state_contract ON apprenticeship_estimate (state_code, contract_type);

CREATE VIEW IF NOT EXISTS vw_frontend_occupations AS
SELECT
  o.anzsco_code,
  o.preferred_title AS occupation_title,
  o.major_group_code,
  mg.major_group_label,
  oss.skill_level,
  oss.national_shortage_rating,
  oss.victoria_shortage_rating,
  COUNT(DISTINCT pop.program_id) AS linked_program_count,
  COUNT(DISTINCT CASE WHEN p.has_vet_outcomes = 1 THEN p.program_id END) AS vet_program_count,
  COUNT(DISTINCT CASE WHEN p.has_vnda_metrics = 1 THEN p.program_id END) AS graduate_program_count
FROM occupation o
LEFT JOIN major_group mg
  ON mg.major_group_code = o.major_group_code
LEFT JOIN occupation_shortage_snapshot oss
  ON oss.dataset_code = 'osl_filtered'
 AND oss.anzsco_code = o.anzsco_code
LEFT JOIN program_occupation_pathway pop
  ON pop.dataset_code = 'vnda_course_occupations'
 AND pop.anzsco_code = o.anzsco_code
LEFT JOIN program p
  ON p.program_id = pop.program_id
GROUP BY
  o.anzsco_code,
  o.preferred_title,
  o.major_group_code,
  mg.major_group_label,
  oss.skill_level,
  oss.national_shortage_rating,
  oss.victoria_shortage_rating;

CREATE VIEW IF NOT EXISTS vw_frontend_programs AS
SELECT
  p.program_id,
  p.program_name,
  p.aqf_level,
  p.field_of_education,
  p.has_vet_outcomes,
  p.has_vnda_metrics,
  pvo.n_respondents,
  pvo.pct_employed_or_study,
  pvo.pct_satisfied,
  pvo.median_annual_income,
  pgm.pct_employed_post,
  pgm.median_income,
  pgm.median_income_total,
  pgm.total_ft_median_income,
  pgm.income_support_exit_rate,
  pgm.count_of_unique_occupations
FROM program p
LEFT JOIN program_vet_outcome pvo
  ON pvo.dataset_code = 'vet_outcomes'
 AND pvo.program_id = p.program_id
LEFT JOIN program_graduate_metric pgm
  ON pgm.dataset_code = 'vnda_course_metrics'
 AND pgm.program_id = p.program_id;

CREATE VIEW IF NOT EXISTS vw_frontend_pathways AS
SELECT
  pop.program_id,
  p.program_name,
  p.aqf_level,
  p.field_of_education,
  pop.course_occupation_rank,
  pop.occupation_name,
  pop.anzsco_code,
  o.preferred_title AS preferred_occupation_title,
  pop.pct_share,
  pop.anzsco_match_method,
  pop.anzsco_match_score,
  pop.anzsco_match_status,
  oss.victoria_shortage_rating,
  pgm.pct_employed_post,
  pgm.median_income,
  pvo.pct_employed_or_study,
  pvo.median_annual_income
FROM program_occupation_pathway pop
JOIN program p
  ON p.program_id = pop.program_id
LEFT JOIN occupation o
  ON o.anzsco_code = pop.anzsco_code
LEFT JOIN occupation_shortage_snapshot oss
  ON oss.dataset_code = 'osl_filtered'
 AND oss.anzsco_code = pop.anzsco_code
LEFT JOIN program_graduate_metric pgm
  ON pgm.dataset_code = 'vnda_course_metrics'
 AND pgm.program_id = pop.program_id
LEFT JOIN program_vet_outcome pvo
  ON pvo.dataset_code = 'vet_outcomes'
 AND pvo.program_id = pop.program_id
WHERE pop.dataset_code = 'vnda_course_occupations';

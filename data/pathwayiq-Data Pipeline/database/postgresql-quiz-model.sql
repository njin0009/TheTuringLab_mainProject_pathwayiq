-- PathwayIQ quiz model for PostgreSQL
-- -----------------------------------
-- Design goals:
-- 1. Keep quiz content in the database, not hardcoded in the frontend.
-- 2. Support both Quick Match and Deep Match from one shared dimension model.
-- 3. Keep results reproducible with quiz versioning and result snapshots.
-- 4. Support privacy-friendly analytics without storing direct personal identifiers.
-- 5. Keep occupation matching explainable via documented methodologies.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS quiz_version (
  quiz_version_id TEXT PRIMARY KEY,
  version_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'live', 'archived')),
  notes TEXT,
  published_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (retired_at IS NULL OR retired_at >= created_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_quiz_version_single_live
  ON quiz_version ((status))
  WHERE status = 'live';

CREATE TABLE IF NOT EXISTS quiz_mode (
  mode_id TEXT PRIMARY KEY,
  mode_name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_mode_definition (
  quiz_version_id TEXT NOT NULL,
  mode_id TEXT NOT NULL,
  title TEXT NOT NULL,
  duration_label TEXT NOT NULL,
  expected_duration_seconds INTEGER NOT NULL CHECK (expected_duration_seconds > 0),
  expected_question_count SMALLINT NOT NULL CHECK (expected_question_count > 0),
  blurb TEXT NOT NULL,
  helper_text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (quiz_version_id, mode_id),
  FOREIGN KEY (quiz_version_id) REFERENCES quiz_version (quiz_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (mode_id) REFERENCES quiz_mode (mode_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_quiz_mode_definition_active
  ON quiz_mode_definition (quiz_version_id, mode_id)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS quiz_dimension (
  dimension_id TEXT PRIMARY KEY,
  display_label TEXT NOT NULL UNIQUE,
  tagline TEXT NOT NULL,
  summary TEXT NOT NULL,
  illustration_path TEXT NOT NULL,
  explore_interest TEXT,
  fallback_search TEXT,
  display_order SMALLINT NOT NULL UNIQUE CHECK (display_order > 0),
  tie_break_rank SMALLINT NOT NULL UNIQUE CHECK (tie_break_rank > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (illustration_path LIKE '/quiz-styles/%')
);

CREATE INDEX IF NOT EXISTS idx_quiz_dimension_active
  ON quiz_dimension (display_order)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS quiz_dimension_work_like (
  dimension_id TEXT NOT NULL,
  display_order SMALLINT NOT NULL CHECK (display_order > 0),
  work_like_text TEXT NOT NULL,
  PRIMARY KEY (dimension_id, display_order),
  FOREIGN KEY (dimension_id) REFERENCES quiz_dimension (dimension_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_question_theme (
  theme_code TEXT PRIMARY KEY,
  theme_name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_question (
  quiz_version_id TEXT NOT NULL,
  question_code TEXT NOT NULL,
  mode_id TEXT NOT NULL,
  theme_code TEXT,
  prompt_text TEXT NOT NULL,
  helper_text TEXT,
  display_order SMALLINT NOT NULL CHECK (display_order > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (quiz_version_id, question_code),
  UNIQUE (quiz_version_id, mode_id, display_order),
  FOREIGN KEY (quiz_version_id) REFERENCES quiz_version (quiz_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (mode_id) REFERENCES quiz_mode (mode_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (theme_code) REFERENCES quiz_question_theme (theme_code)
    ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quiz_question_active
  ON quiz_question (quiz_version_id, mode_id, display_order)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS quiz_option (
  quiz_version_id TEXT NOT NULL,
  question_code TEXT NOT NULL,
  option_code TEXT NOT NULL,
  option_label TEXT NOT NULL,
  helper_text TEXT,
  display_order SMALLINT NOT NULL CHECK (display_order > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (quiz_version_id, question_code, option_code),
  UNIQUE (quiz_version_id, question_code, display_order),
  FOREIGN KEY (quiz_version_id, question_code) REFERENCES quiz_question (quiz_version_id, question_code)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CHECK (option_code ~ '^[a-zA-Z0-9_-]+$')
);

CREATE INDEX IF NOT EXISTS idx_quiz_option_active
  ON quiz_option (quiz_version_id, question_code, display_order)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS quiz_option_dimension_weight (
  quiz_version_id TEXT NOT NULL,
  question_code TEXT NOT NULL,
  option_code TEXT NOT NULL,
  dimension_id TEXT NOT NULL,
  weight NUMERIC(6,2) NOT NULL CHECK (weight > 0),
  PRIMARY KEY (quiz_version_id, question_code, option_code, dimension_id),
  FOREIGN KEY (quiz_version_id, question_code, option_code)
    REFERENCES quiz_option (quiz_version_id, question_code, option_code)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (dimension_id) REFERENCES quiz_dimension (dimension_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS quiz_archetype (
  quiz_version_id TEXT NOT NULL,
  primary_dimension_id TEXT NOT NULL,
  support_dimension_id TEXT NOT NULL,
  archetype_title TEXT NOT NULL,
  archetype_summary TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (quiz_version_id, primary_dimension_id, support_dimension_id),
  FOREIGN KEY (quiz_version_id) REFERENCES quiz_version (quiz_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (primary_dimension_id) REFERENCES quiz_dimension (dimension_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (support_dimension_id) REFERENCES quiz_dimension (dimension_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (primary_dimension_id <> support_dimension_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_archetype_active
  ON quiz_archetype (quiz_version_id, primary_dimension_id, support_dimension_id)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS quiz_scoring_parameter (
  quiz_version_id TEXT NOT NULL,
  scope_key TEXT NOT NULL CHECK (scope_key IN ('global', 'quick', 'deep')),
  parameter_key TEXT NOT NULL,
  numeric_value NUMERIC(10,4) NOT NULL,
  unit_label TEXT,
  description TEXT NOT NULL,
  PRIMARY KEY (quiz_version_id, scope_key, parameter_key),
  FOREIGN KEY (quiz_version_id) REFERENCES quiz_version (quiz_version_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS quiz_dimension_industry_signal (
  quiz_version_id TEXT NOT NULL,
  dimension_id TEXT NOT NULL,
  industry_name TEXT NOT NULL,
  signal_weight NUMERIC(5,4) NOT NULL CHECK (signal_weight > 0 AND signal_weight <= 1),
  rationale TEXT,
  PRIMARY KEY (quiz_version_id, dimension_id, industry_name),
  FOREIGN KEY (quiz_version_id) REFERENCES quiz_version (quiz_version_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (dimension_id) REFERENCES quiz_dimension (dimension_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_quiz_dimension_industry_signal
  ON quiz_dimension_industry_signal (quiz_version_id, dimension_id, signal_weight DESC);

CREATE TABLE IF NOT EXISTS quiz_dimension_pathway_signal (
  quiz_version_id TEXT NOT NULL,
  dimension_id TEXT NOT NULL,
  pathway_label TEXT NOT NULL CHECK (pathway_label IN ('TAFE', 'University', 'Apprenticeship')),
  signal_weight NUMERIC(5,4) NOT NULL CHECK (signal_weight > 0 AND signal_weight <= 1),
  rationale TEXT,
  PRIMARY KEY (quiz_version_id, dimension_id, pathway_label),
  FOREIGN KEY (quiz_version_id) REFERENCES quiz_version (quiz_version_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (dimension_id) REFERENCES quiz_dimension (dimension_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_quiz_dimension_pathway_signal
  ON quiz_dimension_pathway_signal (quiz_version_id, dimension_id, signal_weight DESC);

CREATE TABLE IF NOT EXISTS quiz_dimension_major_group_signal (
  quiz_version_id TEXT NOT NULL,
  dimension_id TEXT NOT NULL,
  major_group_code TEXT NOT NULL,
  signal_weight NUMERIC(5,4) NOT NULL CHECK (signal_weight > 0 AND signal_weight <= 1),
  rationale TEXT,
  PRIMARY KEY (quiz_version_id, dimension_id, major_group_code),
  FOREIGN KEY (quiz_version_id) REFERENCES quiz_version (quiz_version_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (dimension_id) REFERENCES quiz_dimension (dimension_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_quiz_dimension_major_group_signal
  ON quiz_dimension_major_group_signal (quiz_version_id, dimension_id, signal_weight DESC);

CREATE TABLE IF NOT EXISTS quiz_dimension_title_keyword_signal (
  quiz_version_id TEXT NOT NULL,
  dimension_id TEXT NOT NULL,
  keyword_text TEXT NOT NULL,
  signal_weight NUMERIC(5,4) NOT NULL CHECK (signal_weight > 0 AND signal_weight <= 1),
  rationale TEXT,
  PRIMARY KEY (quiz_version_id, dimension_id, keyword_text),
  FOREIGN KEY (quiz_version_id) REFERENCES quiz_version (quiz_version_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (dimension_id) REFERENCES quiz_dimension (dimension_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_quiz_dimension_title_keyword_signal
  ON quiz_dimension_title_keyword_signal (quiz_version_id, dimension_id, signal_weight DESC);

CREATE TABLE IF NOT EXISTS occupation_dimension_methodology (
  methodology_code TEXT PRIMARY KEY,
  methodology_name TEXT NOT NULL UNIQUE,
  rubric_version TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS occupation_dimension_score (
  quiz_version_id TEXT NOT NULL,
  occupation_code TEXT NOT NULL,
  dimension_id TEXT NOT NULL,
  affinity_score NUMERIC(6,4) NOT NULL CHECK (affinity_score BETWEEN 0 AND 1),
  methodology_code TEXT NOT NULL,
  evidence_summary TEXT,
  confidence_score NUMERIC(4,3) CHECK (
    confidence_score IS NULL OR confidence_score BETWEEN 0 AND 1
  ),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  PRIMARY KEY (quiz_version_id, occupation_code, dimension_id),
  FOREIGN KEY (quiz_version_id) REFERENCES quiz_version (quiz_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (dimension_id) REFERENCES quiz_dimension (dimension_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (methodology_code) REFERENCES occupation_dimension_methodology (methodology_code)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_occupation_dimension_score_lookup
  ON occupation_dimension_score (quiz_version_id, dimension_id, affinity_score DESC);

CREATE INDEX IF NOT EXISTS idx_occupation_dimension_score_occupation
  ON occupation_dimension_score (quiz_version_id, occupation_code);

CREATE TABLE IF NOT EXISTS quiz_session (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_session_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  quiz_version_id TEXT NOT NULL,
  mode_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started'
    CHECK (status IN ('started', 'completed', 'abandoned', 'expired')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  anonymous_subject_key TEXT,
  user_agent_hash CHAR(64),
  consent_analytics BOOLEAN NOT NULL DEFAULT TRUE,
  privacy_notice_version TEXT,
  UNIQUE (session_id, quiz_version_id),
  FOREIGN KEY (quiz_version_id) REFERENCES quiz_version (quiz_version_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (mode_id) REFERENCES quiz_mode (mode_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (completed_at IS NULL OR completed_at >= started_at)
);

CREATE INDEX IF NOT EXISTS idx_quiz_session_started
  ON quiz_session (quiz_version_id, mode_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_session_status
  ON quiz_session (status, started_at DESC);

CREATE TABLE IF NOT EXISTS quiz_response (
  session_id UUID NOT NULL,
  quiz_version_id TEXT NOT NULL,
  question_code TEXT NOT NULL,
  option_code TEXT NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, question_code),
  FOREIGN KEY (session_id, quiz_version_id) REFERENCES quiz_session (session_id, quiz_version_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (quiz_version_id, question_code, option_code)
    REFERENCES quiz_option (quiz_version_id, question_code, option_code)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_quiz_response_answered
  ON quiz_response (session_id, answered_at);

CREATE TABLE IF NOT EXISTS quiz_result_snapshot (
  session_id UUID PRIMARY KEY,
  quiz_version_id TEXT NOT NULL,
  mode_id TEXT NOT NULL,
  scoring_method TEXT NOT NULL,
  top_dimension_id TEXT NOT NULL,
  support_dimension_id TEXT NOT NULL,
  archetype_title TEXT NOT NULL,
  archetype_summary TEXT NOT NULL,
  scoring_parameters_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  result_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (session_id, quiz_version_id) REFERENCES quiz_session (session_id, quiz_version_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (mode_id) REFERENCES quiz_mode (mode_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (top_dimension_id) REFERENCES quiz_dimension (dimension_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (support_dimension_id) REFERENCES quiz_dimension (dimension_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (top_dimension_id <> support_dimension_id)
);

CREATE TABLE IF NOT EXISTS quiz_result_dimension_score (
  session_id UUID NOT NULL,
  dimension_id TEXT NOT NULL,
  raw_score NUMERIC(8,2) NOT NULL CHECK (raw_score >= 0),
  normalized_score NUMERIC(8,6) NOT NULL CHECK (normalized_score BETWEEN 0 AND 1),
  dimension_rank SMALLINT NOT NULL CHECK (dimension_rank BETWEEN 1 AND 6),
  PRIMARY KEY (session_id, dimension_id),
  UNIQUE (session_id, dimension_rank),
  FOREIGN KEY (session_id) REFERENCES quiz_result_snapshot (session_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (dimension_id) REFERENCES quiz_dimension (dimension_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS quiz_result_recommendation (
  session_id UUID NOT NULL,
  recommendation_rank SMALLINT NOT NULL CHECK (recommendation_rank BETWEEN 1 AND 10),
  occupation_code TEXT NOT NULL,
  match_score NUMERIC(10,6) NOT NULL CHECK (match_score >= 0),
  shortage_bonus_applied BOOLEAN NOT NULL DEFAULT FALSE,
  salary_bonus_applied BOOLEAN NOT NULL DEFAULT FALSE,
  match_explanation TEXT,
  PRIMARY KEY (session_id, recommendation_rank),
  UNIQUE (session_id, occupation_code),
  FOREIGN KEY (session_id) REFERENCES quiz_result_snapshot (session_id)
    ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_quiz_result_recommendation_lookup
  ON quiz_result_recommendation (session_id, recommendation_rank);

CREATE OR REPLACE VIEW vw_quiz_active_question_config AS
SELECT
  q.quiz_version_id,
  q.mode_id,
  q.question_code,
  q.prompt_text,
  q.helper_text AS question_helper_text,
  q.display_order AS question_order,
  o.option_code,
  o.option_label,
  o.helper_text AS option_helper_text,
  o.display_order AS option_order
FROM quiz_question q
JOIN quiz_option o
  ON o.quiz_version_id = q.quiz_version_id
 AND o.question_code = q.question_code
JOIN quiz_mode_definition md
  ON md.quiz_version_id = q.quiz_version_id
 AND md.mode_id = q.mode_id
WHERE q.is_active
  AND o.is_active
  AND md.is_active;

CREATE OR REPLACE VIEW vw_quiz_option_weights AS
SELECT
  w.quiz_version_id,
  q.mode_id,
  w.question_code,
  w.option_code,
  w.dimension_id,
  w.weight
FROM quiz_option_dimension_weight w
JOIN quiz_question q
  ON q.quiz_version_id = w.quiz_version_id
 AND q.question_code = w.question_code;

-- Integration note:
-- In the PathwayIQ PostgreSQL pipeline, run postgresql-quiz-to-occupation-load.sql
-- after the core occupation schema and mart views have been built. That script:
-- 1. adds foreign-key wiring into pathwayiq_core.occupation
-- 2. creates quiz-ready occupation profile views
-- 3. derives occupation_dimension_score from the existing frontend career-card mart

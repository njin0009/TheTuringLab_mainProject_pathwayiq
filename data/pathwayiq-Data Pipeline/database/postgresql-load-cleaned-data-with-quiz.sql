\set ON_ERROR_STOP on

-- Build and load the existing PathwayIQ PostgreSQL schemas and mart views.
\ir postgresql-load-cleaned-data.sql

-- Build the quiz schema and seed the question set.
\ir postgresql-quiz-model.sql
\ir postgresql-quiz-seed-v1.sql

-- Derive occupation-to-dimension affinity scores from the existing frontend career-card mart.
\ir postgresql-quiz-to-occupation-load.sql

-- Quick verification summary for the quiz layer.
SELECT 'quiz_versions' AS table_name, COUNT(*) AS row_count FROM quiz_version
UNION ALL
SELECT 'quiz_questions', COUNT(*) FROM quiz_question
UNION ALL
SELECT 'quiz_options', COUNT(*) FROM quiz_option
UNION ALL
SELECT 'quiz_archetypes', COUNT(*) FROM quiz_archetype
UNION ALL
SELECT 'quiz_dimension_signals', COUNT(*) FROM quiz_dimension_title_keyword_signal
UNION ALL
SELECT 'occupation_dimension_score', COUNT(*) FROM occupation_dimension_score
UNION ALL
SELECT 'mart_quiz_occupation_profile', COUNT(*) FROM pathwayiq_mart.vw_quiz_occupation_profile
UNION ALL
SELECT 'mart_quiz_dimension_affinity', COUNT(*) FROM pathwayiq_mart.vw_quiz_occupation_dimension_affinity
ORDER BY table_name;

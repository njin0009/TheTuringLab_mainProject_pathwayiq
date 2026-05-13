\set ON_ERROR_STOP on

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_occupation_dimension_score_occupation_code'
  ) THEN
    ALTER TABLE occupation_dimension_score
      ADD CONSTRAINT fk_occupation_dimension_score_occupation_code
      FOREIGN KEY (occupation_code)
      REFERENCES pathwayiq_core.occupation (occupation_code)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_quiz_result_recommendation_occupation_code'
  ) THEN
    ALTER TABLE quiz_result_recommendation
      ADD CONSTRAINT fk_quiz_result_recommendation_occupation_code
      FOREIGN KEY (occupation_code)
      REFERENCES pathwayiq_core.occupation (occupation_code)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END
$$;

CREATE OR REPLACE VIEW pathwayiq_mart.vw_quiz_occupation_profile AS
SELECT DISTINCT ON (vo.anzsco_code)
  o.occupation_id,
  o.occupation_code AS anzsco_code,
  o.preferred_title AS title,
  LOWER(o.preferred_title) AS normalized_title,
  mg.major_group_code,
  mg.major_group_label,
  vo.industry,
  vo.pathway,
  vo.median_salary,
  vo.shortage_status,
  vo.ai_risk
FROM pathwayiq_mart.vw_frontend_career_cards vo
JOIN pathwayiq_core.occupation o
  ON o.occupation_code = vo.anzsco_code
JOIN pathwayiq_core.major_group mg
  ON mg.major_group_id = o.major_group_id
ORDER BY vo.anzsco_code, vo.median_salary DESC, vo.title;

CREATE OR REPLACE VIEW pathwayiq_mart.vw_quiz_occupation_dimension_affinity AS
WITH active_versions AS (
  SELECT DISTINCT quiz_version_id
  FROM quiz_scoring_parameter
  WHERE scope_key = 'global'
    AND parameter_key = 'occupation_affinity_weight_industry'
),
profile_dimension AS (
  SELECT
    av.quiz_version_id,
    qp.occupation_id,
    qp.anzsco_code AS occupation_code,
    qp.title,
    qp.normalized_title,
    qp.major_group_code,
    qp.major_group_label,
    qp.industry,
    qp.pathway,
    qp.median_salary,
    qp.shortage_status,
    qp.ai_risk,
    qd.dimension_id,
    qd.display_label AS dimension_label
  FROM active_versions av
  CROSS JOIN quiz_dimension qd
  JOIN pathwayiq_mart.vw_quiz_occupation_profile qp
    ON TRUE
  WHERE qd.is_active
),
component_weights AS (
  SELECT
    quiz_version_id,
    MAX(CASE WHEN parameter_key = 'occupation_affinity_weight_industry' THEN numeric_value END) AS industry_weight,
    MAX(CASE WHEN parameter_key = 'occupation_affinity_weight_pathway' THEN numeric_value END) AS pathway_weight,
    MAX(CASE WHEN parameter_key = 'occupation_affinity_weight_major_group' THEN numeric_value END) AS major_group_weight,
    MAX(CASE WHEN parameter_key = 'occupation_affinity_weight_title_keyword' THEN numeric_value END) AS title_keyword_weight
  FROM quiz_scoring_parameter
  WHERE scope_key = 'global'
    AND parameter_key IN (
      'occupation_affinity_weight_industry',
      'occupation_affinity_weight_pathway',
      'occupation_affinity_weight_major_group',
      'occupation_affinity_weight_title_keyword'
    )
  GROUP BY quiz_version_id
),
keyword_cap AS (
  SELECT
    quiz_version_id,
    GREATEST(1, ROUND(numeric_value)::INTEGER) AS keyword_cap
  FROM quiz_scoring_parameter
  WHERE scope_key = 'global'
    AND parameter_key = 'occupation_affinity_keyword_cap'
),
industry_match AS (
  SELECT
    pd.quiz_version_id,
    pd.occupation_code,
    pd.dimension_id,
    COALESCE(MAX(qdis.signal_weight), 0) AS matched_industry_weight
  FROM profile_dimension pd
  LEFT JOIN quiz_dimension_industry_signal qdis
    ON qdis.quiz_version_id = pd.quiz_version_id
   AND qdis.dimension_id = pd.dimension_id
   AND qdis.industry_name = pd.industry
  GROUP BY pd.quiz_version_id, pd.occupation_code, pd.dimension_id
),
industry_max AS (
  SELECT
    quiz_version_id,
    dimension_id,
    MAX(signal_weight) AS max_industry_weight
  FROM quiz_dimension_industry_signal
  GROUP BY quiz_version_id, dimension_id
),
pathway_match AS (
  SELECT
    pd.quiz_version_id,
    pd.occupation_code,
    pd.dimension_id,
    COALESCE(MAX(qdps.signal_weight), 0) AS matched_pathway_weight
  FROM profile_dimension pd
  LEFT JOIN quiz_dimension_pathway_signal qdps
    ON qdps.quiz_version_id = pd.quiz_version_id
   AND qdps.dimension_id = pd.dimension_id
   AND qdps.pathway_label = pd.pathway
  GROUP BY pd.quiz_version_id, pd.occupation_code, pd.dimension_id
),
pathway_max AS (
  SELECT
    quiz_version_id,
    dimension_id,
    MAX(signal_weight) AS max_pathway_weight
  FROM quiz_dimension_pathway_signal
  GROUP BY quiz_version_id, dimension_id
),
major_group_match AS (
  SELECT
    pd.quiz_version_id,
    pd.occupation_code,
    pd.dimension_id,
    COALESCE(MAX(qdmgs.signal_weight), 0) AS matched_major_group_weight
  FROM profile_dimension pd
  LEFT JOIN quiz_dimension_major_group_signal qdmgs
    ON qdmgs.quiz_version_id = pd.quiz_version_id
   AND qdmgs.dimension_id = pd.dimension_id
   AND qdmgs.major_group_code = pd.major_group_code
  GROUP BY pd.quiz_version_id, pd.occupation_code, pd.dimension_id
),
major_group_max AS (
  SELECT
    quiz_version_id,
    dimension_id,
    MAX(signal_weight) AS max_major_group_weight
  FROM quiz_dimension_major_group_signal
  GROUP BY quiz_version_id, dimension_id
),
keyword_ranked AS (
  SELECT
    pd.quiz_version_id,
    pd.occupation_code,
    pd.dimension_id,
    qdtks.keyword_text,
    qdtks.signal_weight,
    ROW_NUMBER() OVER (
      PARTITION BY pd.quiz_version_id, pd.occupation_code, pd.dimension_id
      ORDER BY qdtks.signal_weight DESC, qdtks.keyword_text
    ) AS keyword_rank
  FROM profile_dimension pd
  JOIN quiz_dimension_title_keyword_signal qdtks
    ON qdtks.quiz_version_id = pd.quiz_version_id
   AND qdtks.dimension_id = pd.dimension_id
  WHERE pd.normalized_title LIKE '%' || LOWER(qdtks.keyword_text) || '%'
),
keyword_match AS (
  SELECT
    kr.quiz_version_id,
    kr.occupation_code,
    kr.dimension_id,
    COALESCE(SUM(kr.signal_weight), 0) AS matched_keyword_weight,
    STRING_AGG(kr.keyword_text, ', ' ORDER BY kr.signal_weight DESC, kr.keyword_text) AS matched_keywords
  FROM keyword_ranked kr
  JOIN keyword_cap kc
    ON kc.quiz_version_id = kr.quiz_version_id
  WHERE kr.keyword_rank <= kc.keyword_cap
  GROUP BY kr.quiz_version_id, kr.occupation_code, kr.dimension_id
),
keyword_signal_ranked AS (
  SELECT
    qdtks.quiz_version_id,
    qdtks.dimension_id,
    qdtks.signal_weight,
    qdtks.keyword_text,
    ROW_NUMBER() OVER (
      PARTITION BY qdtks.quiz_version_id, qdtks.dimension_id
      ORDER BY qdtks.signal_weight DESC, qdtks.keyword_text
    ) AS keyword_rank
  FROM quiz_dimension_title_keyword_signal qdtks
),
keyword_max AS (
  SELECT
    ksr.quiz_version_id,
    ksr.dimension_id,
    COALESCE(SUM(ksr.signal_weight), 0) AS max_keyword_weight
  FROM keyword_signal_ranked ksr
  JOIN keyword_cap kc
    ON kc.quiz_version_id = ksr.quiz_version_id
  WHERE ksr.keyword_rank <= kc.keyword_cap
  GROUP BY ksr.quiz_version_id, ksr.dimension_id
)
SELECT
  pd.quiz_version_id,
  pd.occupation_id,
  pd.occupation_code,
  pd.title,
  pd.major_group_code,
  pd.major_group_label,
  pd.industry,
  pd.pathway,
  pd.median_salary,
  pd.shortage_status,
  pd.ai_risk,
  pd.dimension_id,
  pd.dimension_label,
  ROUND(COALESCE(im.matched_industry_weight / NULLIF(ix.max_industry_weight, 0), 0)::NUMERIC, 4) AS industry_component,
  ROUND(COALESCE(pm.matched_pathway_weight / NULLIF(px.max_pathway_weight, 0), 0)::NUMERIC, 4) AS pathway_component,
  ROUND(COALESCE(mm.matched_major_group_weight / NULLIF(mx.max_major_group_weight, 0), 0)::NUMERIC, 4) AS major_group_component,
  ROUND(COALESCE(km.matched_keyword_weight / NULLIF(kx.max_keyword_weight, 0), 0)::NUMERIC, 4) AS keyword_component,
  COALESCE(km.matched_keywords, '') AS matched_keywords,
  CONCAT_WS(
    '; ',
    CASE WHEN COALESCE(im.matched_industry_weight, 0) > 0 THEN 'industry=' || pd.industry END,
    CASE WHEN COALESCE(pm.matched_pathway_weight, 0) > 0 THEN 'pathway=' || pd.pathway END,
    CASE WHEN COALESCE(mm.matched_major_group_weight, 0) > 0 THEN 'major_group=' || pd.major_group_label END,
    CASE WHEN COALESCE(km.matched_keywords, '') <> '' THEN 'keywords=' || km.matched_keywords END
  ) AS evidence_summary,
  ROUND(
    LEAST(
      1.0,
      COALESCE(im.matched_industry_weight / NULLIF(ix.max_industry_weight, 0), 0) * cw.industry_weight
      + COALESCE(pm.matched_pathway_weight / NULLIF(px.max_pathway_weight, 0), 0) * cw.pathway_weight
      + COALESCE(mm.matched_major_group_weight / NULLIF(mx.max_major_group_weight, 0), 0) * cw.major_group_weight
      + COALESCE(km.matched_keyword_weight / NULLIF(kx.max_keyword_weight, 0), 0) * cw.title_keyword_weight
    )::NUMERIC,
    4
  ) AS affinity_score
FROM profile_dimension pd
JOIN component_weights cw
  ON cw.quiz_version_id = pd.quiz_version_id
LEFT JOIN industry_match im
  ON im.quiz_version_id = pd.quiz_version_id
 AND im.occupation_code = pd.occupation_code
 AND im.dimension_id = pd.dimension_id
LEFT JOIN industry_max ix
  ON ix.quiz_version_id = pd.quiz_version_id
 AND ix.dimension_id = pd.dimension_id
LEFT JOIN pathway_match pm
  ON pm.quiz_version_id = pd.quiz_version_id
 AND pm.occupation_code = pd.occupation_code
 AND pm.dimension_id = pd.dimension_id
LEFT JOIN pathway_max px
  ON px.quiz_version_id = pd.quiz_version_id
 AND px.dimension_id = pd.dimension_id
LEFT JOIN major_group_match mm
  ON mm.quiz_version_id = pd.quiz_version_id
 AND mm.occupation_code = pd.occupation_code
 AND mm.dimension_id = pd.dimension_id
LEFT JOIN major_group_max mx
  ON mx.quiz_version_id = pd.quiz_version_id
 AND mx.dimension_id = pd.dimension_id
LEFT JOIN keyword_match km
  ON km.quiz_version_id = pd.quiz_version_id
 AND km.occupation_code = pd.occupation_code
 AND km.dimension_id = pd.dimension_id
LEFT JOIN keyword_max kx
  ON kx.quiz_version_id = pd.quiz_version_id
 AND kx.dimension_id = pd.dimension_id;

DELETE FROM occupation_dimension_score
WHERE methodology_code = 'career_card_signal_rubric_v1';

WITH thresholds AS (
  SELECT
    quiz_version_id,
    numeric_value AS min_affinity_score
  FROM quiz_scoring_parameter
  WHERE scope_key = 'global'
    AND parameter_key = 'occupation_affinity_insert_threshold'
)
INSERT INTO occupation_dimension_score (
  quiz_version_id,
  occupation_code,
  dimension_id,
  affinity_score,
  methodology_code,
  evidence_summary,
  confidence_score,
  reviewed_by,
  reviewed_at,
  notes
)
SELECT
  qa.quiz_version_id,
  qa.occupation_code,
  qa.dimension_id,
  qa.affinity_score,
  'career_card_signal_rubric_v1',
  qa.evidence_summary,
  ROUND(
    LEAST(
      1.0,
      0.55
      + CASE WHEN qa.industry_component > 0 THEN 0.10 ELSE 0 END
      + CASE WHEN qa.pathway_component > 0 THEN 0.08 ELSE 0 END
      + CASE WHEN qa.major_group_component > 0 THEN 0.10 ELSE 0 END
      + CASE WHEN qa.keyword_component > 0 THEN 0.17 ELSE 0 END
    )::NUMERIC,
    3
  ) AS confidence_score,
  CURRENT_USER,
  NOW(),
  'Derived from pathwayiq_mart.vw_frontend_career_cards using explicit quiz style signals across industry, pathway, ANZSCO major group, and title keywords.'
FROM pathwayiq_mart.vw_quiz_occupation_dimension_affinity qa
JOIN thresholds t
  ON t.quiz_version_id = qa.quiz_version_id
WHERE qa.affinity_score >= t.min_affinity_score
ON CONFLICT (quiz_version_id, occupation_code, dimension_id) DO UPDATE
SET affinity_score = EXCLUDED.affinity_score,
    methodology_code = EXCLUDED.methodology_code,
    evidence_summary = EXCLUDED.evidence_summary,
    confidence_score = EXCLUDED.confidence_score,
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    notes = EXCLUDED.notes;

COMMIT;

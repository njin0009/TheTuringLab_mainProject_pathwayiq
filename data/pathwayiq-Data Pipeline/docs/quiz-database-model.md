# PathwayIQ Quiz Database Model

This database model moves the quiz out of the frontend and turns it into a backend-owned assessment system.

## What is included

- `database/postgresql-quiz-model.sql`
  PostgreSQL schema for quiz content, scoring, result snapshots, and privacy-friendly analytics.
- `database/postgresql-quiz-seed-v1.sql`
  Seed data for:
  - the two quiz modes
  - the six quiz dimensions
  - all 18 questions
  - all answer options and weights
  - archetype mappings
  - baseline scoring parameters
- `database/postgresql-quiz-to-occupation-load.sql`
  Wires the quiz model into the existing `pathwayiq_core` and `pathwayiq_mart` occupation schema and derives occupation-to-style affinity scores.
- `database/postgresql-load-cleaned-data-with-quiz.sql`
  Wrapper load script that runs the existing PostgreSQL pipeline, then the quiz schema, then the occupation affinity build.

## Core design decisions

The model is built around these principles:

- One shared six-dimension system for both `quick` and `deep`
- Versioned quiz content so results stay reproducible
- Ordered archetype pairs such as `builder -> guide`
- Occupation matching stored as a many-to-many affinity matrix
- Backend-computed results rather than precomputed answer combinations
- Anonymous quiz sessions rather than named user profiles

## Main tables

- `quiz_version`
  Tracks draft, live, and archived quiz versions.
- `quiz_mode` and `quiz_mode_definition`
  Store the stable mode IDs plus version-specific display copy.
- `quiz_dimension`
  Stores the six canonical dimensions and their result metadata.
- `quiz_question_theme`
  Gives each question a logical category for analytics and admin review.
- `quiz_question`
  Stores the question text and ordering for each mode and version.
- `quiz_option`
  Stores answer options for each question.
- `quiz_option_dimension_weight`
  Stores weighted links from answers to dimensions.
- `quiz_archetype`
  Stores named top-style/support-style pairs.
- `occupation_dimension_score`
  Stores how strongly each occupation aligns to each quiz dimension.
- `quiz_session`, `quiz_response`, `quiz_result_snapshot`
  Store anonymous session analytics and reproducible outputs.

## How the quiz is wired to the existing occupation schema

The occupation fit layer now derives from the existing frontend career-card mart instead of a separate hand-built occupation list.

The integration uses:

- `pathwayiq_mart.vw_frontend_career_cards`
  Existing frontend-ready occupation cards with:
  - `anzsco_code`
  - `title`
  - `industry`
  - `pathway`
  - `median_salary`
  - `shortage_status`
  - `ai_risk`
- `pathwayiq_mart.vw_quiz_occupation_profile`
  New quiz-ready wrapper over the frontend career-card mart plus ANZSCO major-group metadata.
- `pathwayiq_mart.vw_quiz_occupation_dimension_affinity`
  New derived view that calculates dimension affinity per occupation from explicit signal tables.

This means the quiz recommendation layer now reads the same occupation cards the frontend already uses, but scores them through a transparent database method.

## Recommended occupation scoring methodology

The `occupation_dimension_score` table is the most important table in the model. It should not be guessed from frontend keywords alone.

Recommended process:

1. Build a rubric with anchored meanings for each dimension.
   Example:
   - `builder`: practical execution, tools, visible outputs
   - `decoder`: analysis, investigation, system reasoning
   - `creator`: ideation, design, expression
   - `guide`: support, trust, communication
   - `catalyst`: momentum, influence, initiative
   - `strategist`: planning, sequencing, structure
2. Rate each occupation against all six dimensions using ANZSCO descriptors, task summaries, and pathway context.
3. Use at least two raters for each occupation.
4. Normalize final dimension scores into the `0..1` range.
5. Record the methodology in `occupation_dimension_methodology`.
6. Save evidence notes and confidence in `occupation_dimension_score`.

That gives you an auditable, explainable recommendation engine instead of a hidden heuristic.

For the current seeded version, the first-pass affinity is derived from explicit signal tables:

- `quiz_dimension_industry_signal`
- `quiz_dimension_pathway_signal`
- `quiz_dimension_major_group_signal`
- `quiz_dimension_title_keyword_signal`

These signals are based on the approved quiz dimension meanings and the existing frontend style heuristics, but they are now stored transparently in SQL and can be reviewed or tuned.

## Recommended backend flow

### 1. Fetch quiz config

The backend should read:

- `quiz_mode_definition`
- `quiz_question`
- `quiz_option`

The helper view `vw_quiz_active_question_config` already flattens active questions and options for this purpose.

Suggested API:

- `GET /quiz/config?mode=quick`
- `GET /quiz/config?mode=deep`

### 2. Save answers

When a user starts:

1. create a `quiz_session`
2. return `public_session_token`
3. save each submitted answer into `quiz_response`

This allows dropout analysis and later model evaluation without collecting direct personal identifiers.

### 3. Compute results

Recommended scoring logic:

1. sum answer weights from `quiz_option_dimension_weight`
2. produce a raw user dimension vector
3. normalize the vector
4. sort dimensions by:
   - highest normalized score
   - `tie_break_rank`
5. find archetype using `quiz_archetype`
6. rank occupations using cosine similarity against `occupation_dimension_score`
7. apply small, configurable bonuses from `quiz_scoring_parameter`
8. store the final output in `quiz_result_snapshot`

Use cosine similarity so Quick Match and Deep Match remain comparable even though the deep quiz has more questions.

### 4. Build occupation affinity from the existing mart

Run:

- `postgresql-quiz-model.sql`
- `postgresql-quiz-seed-v1.sql`
- `postgresql-quiz-to-occupation-load.sql`

or just run:

- `postgresql-load-cleaned-data-with-quiz.sql`

The affinity build does this:

1. start from `pathwayiq_mart.vw_frontend_career_cards`
2. add ANZSCO major-group metadata
3. compare each occupation against the style signal tables
4. score four evidence components:
   - industry fit
   - pathway fit
   - major-group fit
   - title-keyword fit
5. combine those components into a normalized `affinity_score`
6. write the result into `occupation_dimension_score`

That gives every recommended occupation an explainable evidence trail such as:

- matching industry
- matching pathway
- matching major group
- matching title keywords

## Result ranking pattern

At a high level, result generation should follow this structure:

```sql
WITH response_weights AS (
  SELECT
    r.session_id,
    w.dimension_id,
    SUM(w.weight) AS raw_score
  FROM quiz_response r
  JOIN quiz_option_dimension_weight w
    ON w.quiz_version_id = r.quiz_version_id
   AND w.question_code = r.question_code
   AND w.option_code = r.option_code
  WHERE r.session_id = $1
  GROUP BY r.session_id, w.dimension_id
),
normalized_user_vector AS (
  SELECT
    session_id,
    dimension_id,
    raw_score,
    raw_score / NULLIF(SQRT(SUM(raw_score * raw_score) OVER (PARTITION BY session_id)), 0) AS normalized_score
  FROM response_weights
),
occupation_matches AS (
  SELECT
    ods.occupation_code,
    SUM(nuv.normalized_score * ods.affinity_score) AS cosine_like_score
  FROM normalized_user_vector nuv
  JOIN occupation_dimension_score ods
    ON ods.quiz_version_id = '2026_v1'
   AND ods.dimension_id = nuv.dimension_id
  GROUP BY ods.occupation_code
)
SELECT *
FROM occupation_matches
ORDER BY cosine_like_score DESC
LIMIT 3;
```

In production, add shortage and salary adjustments after the core similarity score, not before it.

## Privacy and analytics posture

For school-age users, treat privacy as a core design requirement.

Recommended defaults:

- no names
- no email
- no raw IP storage
- only opaque session tokens
- optional hashed user-agent for rough device analysis
- short retention for raw answer rows
- longer retention for aggregated reporting only

## Integration note

When you run `postgresql-quiz-to-occupation-load.sql`, it adds foreign-key wiring from the quiz recommendation tables into `pathwayiq_core.occupation`, so the quiz layer is anchored to the canonical occupation records used elsewhere in the pipeline.

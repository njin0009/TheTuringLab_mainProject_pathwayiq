const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  max: 5,
});

const HEADERS = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "no-referrer",
};

function errorResponse(statusCode, message) {
  return {
    statusCode,
    headers: HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

// GET /quiz/config?mode=quick|deep
async function handleConfig(params) {
  const mode = params.mode;

  if (!mode) {
    return errorResponse(400, "mode parameter is required. Must be quick or deep.");
  }

  if (!["quick", "deep"].includes(mode)) {
    return errorResponse(400, "Invalid mode. Must be quick or deep.");
  }

  // Get active quiz version
  const versionResult = await pool.query(
    `SELECT quiz_version_id FROM public.quiz_version
     WHERE status = 'live'
     ORDER BY published_at DESC
     LIMIT 1`
  );

  if (versionResult.rows.length === 0) {
    return errorResponse(503, "No active quiz version found.");
  }

  const quizVersionId = versionResult.rows[0].quiz_version_id;

  // Get mode definition
  const modeResult = await pool.query(
    `SELECT qmd.mode_id, qmd.title, qmd.duration_label,
            qmd.expected_duration_seconds, qmd.expected_question_count,
            qmd.blurb, qmd.helper_text
     FROM public.quiz_mode_definition qmd
     JOIN public.quiz_mode qm ON qm.mode_id = qmd.mode_id
     WHERE qmd.quiz_version_id = $1
       AND LOWER(qm.mode_id::text) = $2
       AND qmd.is_active = true
     LIMIT 1`,
    [quizVersionId, mode]
  );

  if (modeResult.rows.length === 0) {
    return errorResponse(404, `Mode '${mode}' not found for active quiz version.`);
  }

  const modeData = modeResult.rows[0];

  // Get dimensions
  const dimensionsResult = await pool.query(
    `SELECT dimension_id, display_label, tagline, summary,
            illustration_path, explore_interest, fallback_search,
            display_order, tie_break_rank
     FROM public.quiz_dimension
     WHERE is_active = true
     ORDER BY display_order ASC`
  );

  // Get questions and options
  const questionsResult = await pool.query(
    `SELECT q.question_code, q.prompt_text, q.helper_text, q.display_order,
            o.option_code, o.option_label, o.helper_text AS option_helper_text,
            o.display_order AS option_display_order
     FROM public.quiz_question q
     JOIN public.quiz_option o
       ON o.quiz_version_id = q.quiz_version_id
      AND o.question_code = q.question_code
     WHERE q.quiz_version_id = $1
       AND q.mode_id = $2
       AND q.is_active = true
       AND o.is_active = true
     ORDER BY q.display_order ASC, o.display_order ASC`,
    [quizVersionId, modeData.mode_id]
  );

  // Group options under questions
  const questionsMap = {};
  for (const row of questionsResult.rows) {
    if (!questionsMap[row.question_code]) {
      questionsMap[row.question_code] = {
        question_code: row.question_code,
        prompt_text: row.prompt_text,
        helper_text: row.helper_text,
        display_order: row.display_order,
        options: [],
      };
    }
    questionsMap[row.question_code].options.push({
      option_code: row.option_code,
      option_label: row.option_label,
      helper_text: row.option_helper_text,
      display_order: row.option_display_order,
    });
  }

  const questions = Object.values(questionsMap).sort(
    (a, b) => a.display_order - b.display_order
  );

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      quiz_version_id: quizVersionId,
      mode: modeData,
      dimensions: dimensionsResult.rows,
      questions,
    }),
  };
}

// POST /quiz/result
async function handleResult(body) {
  let parsed;
  try {
    parsed = JSON.parse(body || "{}");
  } catch {
    return errorResponse(400, "Invalid JSON body.");
  }

  const { mode, answers, quiz_version_id } = parsed;

  if (!mode || !["quick", "deep"].includes(mode)) {
    return errorResponse(400, "mode is required. Must be quick or deep.");
  }

  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return errorResponse(400, "answers must be a non-empty array.");
  }

  // Validate each answer shape
  for (const ans of answers) {
    if (!ans.question_code || !ans.option_code) {
      return errorResponse(
        400,
        "Each answer must have question_code and option_code."
      );
    }
    if (typeof ans.question_code !== "string" || typeof ans.option_code !== "string") {
      return errorResponse(400, "question_code and option_code must be strings.");
    }
    if (ans.question_code.length > 50 || ans.option_code.length > 50) {
      return errorResponse(400, "question_code and option_code must be under 50 characters.");
    }
    if (/[^a-zA-Z0-9_\-]/.test(ans.question_code) || /[^a-zA-Z0-9_\-]/.test(ans.option_code)) {
      return errorResponse(400, "Invalid characters in question_code or option_code.");
    }
  }

  // Get active quiz version
  let quizVersionId = quiz_version_id;
  if (!quizVersionId) {
    const versionResult = await pool.query(
      `SELECT quiz_version_id FROM public.quiz_version
       WHERE status = 'live'
       ORDER BY published_at DESC
       LIMIT 1`
    );
    if (versionResult.rows.length === 0) {
      return errorResponse(503, "No active quiz version found.");
    }
    quizVersionId = versionResult.rows[0].quiz_version_id;
  }

  // Load weights for submitted answers
  const questionCodes = answers.map((a) => a.question_code);
  const optionCodes = answers.map((a) => a.option_code);

  const weightsResult = await pool.query(
    `SELECT question_code, option_code, dimension_id, weight
     FROM public.vw_quiz_option_weights
     WHERE quiz_version_id = $1
       AND question_code = ANY($2)
       AND option_code = ANY($3)`,
    [quizVersionId, questionCodes, optionCodes]
  );

  // Build a lookup map for weights
  const weightMap = {};
  for (const row of weightsResult.rows) {
    const key = `${row.question_code}|${row.option_code}|${row.dimension_id}`;
    weightMap[key] = parseFloat(row.weight);
  }

  // Sum raw scores by dimension
  const rawScores = {};
  for (const ans of answers) {
    const matchingWeights = weightsResult.rows.filter(
      (w) =>
        w.question_code === ans.question_code &&
        w.option_code === ans.option_code
    );
    for (const w of matchingWeights) {
      rawScores[w.dimension_id] = (rawScores[w.dimension_id] || 0) + parseFloat(w.weight);
    }
  }

  if (Object.keys(rawScores).length === 0) {
    return errorResponse(400, "No valid answers matched quiz questions and options.");
  }

  // Normalize scores
  const total = Object.values(rawScores).reduce((sum, v) => sum + v, 0);
  const normalizedScores = {};
  for (const [dimId, score] of Object.entries(rawScores)) {
    normalizedScores[dimId] = total > 0 ? score / total : 0;
  }

  // Get dimensions for tie-breaking
  const dimensionsResult = await pool.query(
    `SELECT dimension_id, display_label, tagline, summary,
            illustration_path, explore_interest, fallback_search, tie_break_rank
     FROM public.quiz_dimension
     WHERE is_active = true`
  );
  const dimensionMap = {};
  for (const d of dimensionsResult.rows) {
    dimensionMap[d.dimension_id] = d;
  }

  // Pick top and support dimensions
  const sortedDimensions = Object.entries(rawScores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    const tieA = dimensionMap[a[0]]?.tie_break_rank ?? 999;
    const tieB = dimensionMap[b[0]]?.tie_break_rank ?? 999;
    return tieA - tieB;
  });

  const topDimensionId = sortedDimensions[0]?.[0];
  const supportDimensionId = sortedDimensions[1]?.[0];

  // Load archetype
  const archetypeResult = await pool.query(
    `SELECT archetype_title, archetype_summary
     FROM public.quiz_archetype
     WHERE quiz_version_id = $1
       AND primary_dimension_id = $2
       AND support_dimension_id = $3
       AND is_active = true
     LIMIT 1`,
    [quizVersionId, topDimensionId, supportDimensionId]
  );

  const archetype = archetypeResult.rows[0] || {
    archetype_title: dimensionMap[topDimensionId]?.display_label || "Explorer",
    archetype_summary: dimensionMap[topDimensionId]?.tagline || "",
  };

  // Load scoring parameters
  const scoringParamsResult = await pool.query(
    `SELECT parameter_key, numeric_value
     FROM public.quiz_scoring_parameter
     WHERE quiz_version_id = $1`,
    [quizVersionId]
  );

  const scoringParams = {};
  for (const row of scoringParamsResult.rows) {
    scoringParams[row.parameter_key] = parseFloat(row.numeric_value);
  }

  const recommendationLimit = scoringParams["recommendation_limit"] || 5;
  const shortageBonus = scoringParams["shortage_bonus"] || 0.05;
  const salaryBonus = scoringParams["salary_bonus"] || 0.03;

  // Load occupation dimension scores
  const occupationScoresResult = await pool.query(
    `SELECT occupation_code, dimension_id, affinity_score
     FROM public.occupation_dimension_score
     WHERE quiz_version_id = $1`,
    [quizVersionId]
  );

  // Group by occupation
  const occupationMap = {};
  for (const row of occupationScoresResult.rows) {
    if (!occupationMap[row.occupation_code]) {
      occupationMap[row.occupation_code] = {};
    }
    occupationMap[row.occupation_code][row.dimension_id] = parseFloat(row.affinity_score);
  }

  // Compute cosine-style fit score for each occupation
  const occupationScores = [];
  for (const [occCode, dimScores] of Object.entries(occupationMap)) {
    let dotProduct = 0;
    for (const [dimId, affinity] of Object.entries(dimScores)) {
      const userScore = normalizedScores[dimId] || 0;
      dotProduct += userScore * affinity;
    }
    occupationScores.push({ occupation_code: occCode, fit_score: dotProduct });
  }

  // Join with career cards for shortage and salary bonuses
  const occupationCodes = occupationScores.map((o) => o.occupation_code);
  const careerDataResult = await pool.query(
    `SELECT anzsco_code, title, industry, median_salary, pathway, shortage_status, ai_risk
     FROM pathwayiq_mart.vw_frontend_career_cards
     WHERE anzsco_code = ANY($1)`,
    [occupationCodes]
  );

  const careerMap = {};
  for (const row of careerDataResult.rows) {
    careerMap[row.anzsco_code] = row;
  }

  // Apply bonuses and sort
  const scoredCareers = occupationScores
    .map((o) => {
      const career = careerMap[o.occupation_code];
      if (!career) return null;

      let finalScore = o.fit_score;
      let shortageApplied = false;
      let salaryApplied = false;

      if (career.shortage_status === "In Shortage") {
        finalScore += shortageBonus;
        shortageApplied = true;
      }

      const salary = parseInt(career.median_salary) || 0;
      const avgSalary = scoringParams["average_salary_threshold"] || 60000;
      if (salary > avgSalary) {
        finalScore += salaryBonus;
        salaryApplied = true;
      }

      return {
        occupation_code: o.occupation_code,
        fit_score: Math.round(finalScore * 1000) / 1000,
        shortage_bonus_applied: shortageApplied,
        salary_bonus_applied: salaryApplied,
        career,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.fit_score - a.fit_score)
    .slice(0, recommendationLimit);

  // Build dimension score breakdown
  const scoreBreakdown = Object.entries(rawScores).map(([dimId, raw]) => ({
    dimension_id: dimId,
    dimension_label: dimensionMap[dimId]?.display_label || dimId,
    raw_score: Math.round(raw * 100) / 100,
    normalized_score: Math.round((normalizedScores[dimId] || 0) * 1000) / 1000,
  })).sort((a, b) => b.raw_score - a.raw_score);

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({
      quiz_version_id: quizVersionId,
      top_style: {
        dimension_id: topDimensionId,
        ...dimensionMap[topDimensionId],
      },
      support_style: {
        dimension_id: supportDimensionId,
        ...dimensionMap[supportDimensionId],
      },
      archetype,
      score_breakdown: scoreBreakdown,
      recommended_careers: scoredCareers.map((s) => ({
        rank: scoredCareers.indexOf(s) + 1,
        fit_score: s.fit_score,
        shortage_bonus_applied: s.shortage_bonus_applied,
        salary_bonus_applied: s.salary_bonus_applied,
        career: s.career,
      })),
    }),
  };
}

module.exports.handler = async (event) => {
  const method = event.requestContext?.http?.method;
  const path = event.requestContext?.http?.path;

  if (method === "OPTIONS") {
    return { statusCode: 204, headers: HEADERS, body: "" };
  }

  try {
    if (method === "GET" && path === "/quiz/config") {
      return await handleConfig(event.queryStringParameters || {});
    }

    if (method === "POST" && path === "/quiz/result") {
      return await handleResult(event.body);
    }

    return errorResponse(404, "Not found.");
  } catch (error) {
    console.error("Quiz error:", error.message);
    if (error.message && error.message.includes("timeout")) {
      return errorResponse(503, "The database is temporarily unavailable. Please try again later.");
    }
    return errorResponse(500, "An internal server error occurred. Please try again later.");
  }
};
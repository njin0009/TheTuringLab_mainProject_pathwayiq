const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

if (!process.env.ALLOWED_ORIGIN) {
  throw new Error("ALLOWED_ORIGIN environment variable is not set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  max: 5,
});

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "no-referrer",
};

function validateInput(value, maxLength = 100) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return { error: true };
  if (trimmed.length > maxLength) return { error: true };
  if (/[^a-zA-Z0-9\s\-]/.test(trimmed)) {
    return { error: true };
  }
  return trimmed;
}

function errorResponse(statusCode, message) {
  return {
    statusCode,
    headers: HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

module.exports.handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers: HEADERS, body: "" };
  }

  try {
    const params = event.queryStringParameters || {};

    const allowedParams = ["q", "pathway", "shortage_status", , "ai_risk"];
    const unexpected = Object.keys(params).filter(
      (p) => !allowedParams.includes(p)
    );
    if (unexpected.length > 0) {
      return errorResponse(400, `Unexpected parameters: ${unexpected.join(", ")}`);
    }

    const qRaw = params.q;
    if (qRaw !== undefined && qRaw.trim().length === 0) {
      return errorResponse(400, "Search query cannot be empty.");
    }
    const qResult = validateInput(qRaw, 100);
    if (qResult && qResult.error) {
      return errorResponse(400, "Invalid characters in search query.");
    }
    const q = qResult;

    const pathwayResult = validateInput(params.pathway, 50);
    if (pathwayResult && pathwayResult.error) {
      return errorResponse(400, "Invalid characters in pathway parameter.");
    }
    const pathway = pathwayResult;

    const shortageResult = validateInput(params.shortage_status, 50);
    if (shortageResult && shortageResult.error) {
      return errorResponse(400, "Invalid characters in shortage_status parameter.");
    }
    const shortage_status = shortageResult;

    const allowedPathways = ["University", "TAFE", "Apprenticeship"];
    if (pathway && !allowedPathways.includes(pathway)) {
      return errorResponse(
        400,
        "Invalid pathway value. Must be University, TAFE, or Apprenticeship."
      );
    }

    const allowedShortageStatuses = ["In Shortage", "Not in Shortage"];
    if (shortage_status && !allowedShortageStatuses.includes(shortage_status)) {
      return errorResponse(
        400,
        "Invalid shortage_status value. Must be 'In Shortage' or 'Not in Shortage'."
      );
    }

    const aiRiskResult = validateInput(params.ai_risk, 10);
    if (aiRiskResult && aiRiskResult.error) {
      return errorResponse(400, "Invalid characters in ai_risk parameter.");
    }
    const ai_risk = aiRiskResult;

    const allowedAiRisks = ["Low", "Medium", "High"];
    if (ai_risk && !allowedAiRisks.includes(ai_risk)) {
      return errorResponse(
      400,
      "Invalid ai_risk value. Must be Low, Medium, or High."
    );
  }

    let query = `
      SELECT anzsco_code, title, industry, median_salary, pathway, shortage_status, ai_risk
      FROM pathwayiq_mart.vw_frontend_career_cards
      WHERE 1=1
    `;
    const values = [];

    if (q) {
      values.push(`%${q.toLowerCase()}%`);
      query += ` AND (LOWER(title) LIKE $${values.length} OR LOWER(industry) LIKE $${values.length})`;
    }

    if (pathway) {
      values.push(pathway);
      query += ` AND pathway = $${values.length}`;
    }

    if (shortage_status) {
      values.push(shortage_status);
      query += ` AND shortage_status = $${values.length}`;
    }

    if (ai_risk) {
      values.push(ai_risk);
      query += ` AND ai_risk = $${values.length}`;
    }

    query += " ORDER BY title ASC LIMIT 100";

    const result = await pool.query(query, values);

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify(result.rows),
    };
  } catch (error) {
    console.error("Lambda error:", error.message);
    if (error.message && error.message.includes("timeout")) {
      return errorResponse(
        503,
        "The database is temporarily unavailable. Please try again later."
      );
    }
    return errorResponse(
      500,
      "An internal server error occurred. Please try again later."
    );
  }
};
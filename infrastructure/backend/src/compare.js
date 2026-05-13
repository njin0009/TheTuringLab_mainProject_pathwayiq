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

function validateInput(value, maxLength = 100) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return { error: true };
  if (trimmed.length > maxLength) return { error: true };
  if (/[^a-zA-Z0-9\s\-]/.test(trimmed)) return { error: true };
  return trimmed;
}

async function findCareer(name) {
  // Try exact match first
  const exactResult = await pool.query(
    `SELECT anzsco_code, title, industry, median_salary, pathway, shortage_status, ai_risk
     FROM pathwayiq_mart.vw_frontend_career_cards
     WHERE LOWER(title) = $1
     LIMIT 1`,
    [name.toLowerCase()]
  );

  if (exactResult.rows.length > 0) {
    return exactResult.rows[0];
  }

  // Fall back to partial match
  const partialResult = await pool.query(
    `SELECT anzsco_code, title, industry, median_salary, pathway, shortage_status, ai_risk
     FROM pathwayiq_mart.vw_frontend_career_cards
     WHERE LOWER(title) LIKE $1
     ORDER BY title ASC
     LIMIT 1`,
    [`%${name.toLowerCase()}%`]
  );

  if (partialResult.rows.length > 0) {
    return partialResult.rows[0];
  }

  return null;
}

module.exports.handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return { statusCode: 204, headers: HEADERS, body: "" };
  }

  try {
    const params = event.queryStringParameters || {};

    const allowedParams = ["a", "b"];
    const unexpected = Object.keys(params).filter(
      (p) => !allowedParams.includes(p)
    );
    if (unexpected.length > 0) {
      return errorResponse(400, `Unexpected parameters: ${unexpected.join(", ")}`);
    }

    if (!params.a || !params.b) {
      return errorResponse(400, "Both parameters a and b are required.");
    }

    const aResult = validateInput(params.a, 100);
    if (!aResult || aResult.error) {
      return errorResponse(400, "Invalid characters in parameter a.");
    }

    const bResult = validateInput(params.b, 100);
    if (!bResult || bResult.error) {
      return errorResponse(400, "Invalid characters in parameter b.");
    }

    const [careerA, careerB] = await Promise.all([
      findCareer(aResult),
      findCareer(bResult),
    ]);

    if (!careerA && !careerB) {
      return errorResponse(404, "Neither career could be found.");
    }

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        career_a: careerA || null,
        career_b: careerB || null,
      }),
    };
  } catch (error) {
    console.error("Compare error:", error.message);
    if (error.message && error.message.includes("timeout")) {
      return errorResponse(503, "The database is temporarily unavailable. Please try again later.");
    }
    return errorResponse(500, "An internal server error occurred. Please try again later.");
  }
};
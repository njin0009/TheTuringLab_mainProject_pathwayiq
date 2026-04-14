const fs = require("fs");
const path = require("path");

function validateInput(value, maxLength = 100) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > maxLength) return null;
  const sanitised = trimmed.replace(/[^a-zA-Z0-9\s\-]/g, "");
  if (sanitised.length === 0) return null;
  return sanitised;
}

module.exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};

    const q = validateInput(params.q, 100);
    const pathway = validateInput(params.pathway, 50);
    const ai_risk = validateInput(params.ai_risk, 20);

    // Validate pathway
    const allowedPathways = ["University", "TAFE", "Apprenticeship"];
    if (pathway && !allowedPathways.includes(pathway)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Invalid pathway value. Must be University, TAFE, or Apprenticeship." }),
      };
    }

    // Validate ai_risk
    const allowedRisks = ["Low", "Medium", "High"];
    if (ai_risk && !allowedRisks.includes(ai_risk)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Invalid ai_risk value. Must be Low, Medium, or High." }),
      };
    }

    // Load data
    const filePath = path.join(process.cwd(), "data/careers.json");

    if (!fs.existsSync(filePath)) {
      console.error("careers.json not found at:", filePath);
      return {
        statusCode: 503,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Career data is temporarily unavailable. Please try again later." }),
      };
    }

    const raw = fs.readFileSync(filePath, "utf-8");
    let careers;

    try {
      careers = JSON.parse(raw);
    } catch (parseError) {
      console.error("Failed to parse careers.json:", parseError);
      return {
        statusCode: 503,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Career data is temporarily unavailable. Please try again later." }),
      };
    }

    // Apply filters
    if (q) {
      const query = q.toLowerCase();
      careers = careers.filter((c) =>
        c.title.toLowerCase().includes(query) ||
        c.industry.toLowerCase().includes(query)
      );
    }

    if (pathway) {
      careers = careers.filter((c) => c.pathway === pathway);
    }

    if (ai_risk) {
      careers = careers.filter((c) => c.ai_risk === ai_risk);
    }

    // Return empty array with 200 if no results found
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(careers),
    };

  } catch (error) {
    console.error("Unhandled Lambda error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "An internal server error occurred. Please try again later." }),
    };
  }
};
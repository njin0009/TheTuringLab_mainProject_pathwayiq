const fs = require("fs");
const path = require("path");

module.exports.handler = async (event) => {
  const { q, pathway, ai_risk } = event.queryStringParameters || {};

  const filePath = path.join(process.cwd(), "data/careers.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  let careers = JSON.parse(raw);

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

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(careers),
  };
};
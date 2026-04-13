# API Reference

Base URL: `https://{api-gateway-id}.execute-api.ap-southeast-2.amazonaws.com/prod`  
Local dev: `http://localhost:3000` (via `serverless offline`)

All responses: `Content-Type: application/json`

---

## POST /quiz

Submit quiz answers and receive ranked career matches.

**Request body:**
```json
{
  "q1": "analytical",
  "q2": "office",
  "q3": "technology",
  "q4": "building"
}
```

**Response:**
```json
{
  "matches": [
    {
      "id": "software-engineer",
      "title": "Software Engineer",
      "match_score": 87,
      "match_reasons": ["Analytical", "Technical"],
      "salary": { "entry": 85000, "mid": 115000, "senior": 150000 },
      "ai_risk": 0.18,
      "shortage": true,
      "labels": ["↑ In demand", "Low AI risk"]
    }
  ]
}
```

---

## GET /careers

Search and filter career cards.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `q` | string | Keyword search on title + industry |
| `industry` | string | Filter by industry name |
| `pathway` | string | `University` \| `TAFE` \| `Apprenticeship` |
| `aiRisk` | string | `Low` \| `Medium` \| `High` |

**Response:**
```json
{
  "results": [ ...career objects... ],
  "total": 12
}
```

---

## GET /careers/{id}

Single career detail with all fields.

---

## GET /report/{careerId}

Full career report payload for PDF generation or display.

**Response:**
```json
{
  "career": { ...full career object... },
  "pathways": [ ...pathway comparison... ],
  "generatedAt": "2026-04-12T00:00:00.000Z",
  "dataSources": ["JSA 2025 OSL", "DESE GOS 2023", "NCVER 2024", "OECD Automation Risk"]
}
```

---

## GET /compare?a={id}&b={id}

Side-by-side career comparison.

**Response:**
```json
{
  "a": { ...career A with labels and ai_risk_level... },
  "b": { ...career B with labels and ai_risk_level... }
}
```

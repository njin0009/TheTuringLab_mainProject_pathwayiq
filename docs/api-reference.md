# API Reference

Base URL: `https://{api-gateway-id}.execute-api.ap-southeast-2.amazonaws.com/prod`  
Local dev: `http://localhost:3000` (via `serverless offline`)

All responses: `Content-Type: application/json`

---

## GET /quiz/config

Fetch the active database-backed quiz definition for one mode.

**Query params:**

| Param | Type | Description |
|---|---|---|
| `mode` | string | Required. `quick` or `deep` |
| `quizVersionId` | string | Optional explicit quiz version override |

**Response:**
```json
{
  "quizVersionId": "2026_v1",
  "mode": {
    "id": "quick",
    "title": "Quick Match",
    "durationLabel": "6 questions · about 1 minute",
    "expectedDurationSeconds": 60,
    "expectedQuestionCount": 6,
    "blurb": "A fast vibe check for the kinds of jobs and pathways that might feel right first.",
    "helperText": "Best when you want a quick starting point before diving into career cards."
  },
  "dimensions": [
    {
      "id": "builder",
      "label": "Maker",
      "tagline": "You like making useful things happen in the real world.",
      "summary": "Maker answers usually point toward practical, hands-on work where progress is visible and tools, systems, or physical spaces matter.",
      "illustrationPath": "/quiz-styles/maker.svg",
      "exploreInterest": "Hands-on Trades",
      "fallbackSearch": "electrician",
      "workLike": ["hands-on progress", "field-based work", "real-world problem solving"]
    }
  ],
  "questions": [
    {
      "id": "quick-1",
      "prompt": "Your class gets dropped into a last-minute showcase project. What role do you grab first?",
      "helperText": "Choose the one you would naturally jump into before anyone starts assigning jobs.",
      "order": 1,
      "options": [
        {
          "id": "a",
          "label": "Get the setup sorted and build something that actually works",
          "helperText": "Hands-on, practical, gets moving fast",
          "order": 1
        }
      ]
    }
  ]
}
```

---

## POST /quiz/result

Submit quiz answers and receive a scored quiz result with database-backed career recommendations.

**Request body:**
```json
{
  "mode": "quick",
  "quizVersionId": "2026_v1",
  "answers": {
    "quick-1": "a",
    "quick-2": "d",
    "quick-3": "a",
    "quick-4": "a",
    "quick-5": "d",
    "quick-6": "a"
  },
  "consentAnalytics": true
}
```

**Response:**
```json
{
  "quizVersionId": "2026_v1",
  "mode": "quick",
  "totalQuestions": 6,
  "topStyle": {
    "id": "builder",
    "label": "Maker",
    "tagline": "You like making useful things happen in the real world.",
    "summary": "Maker answers usually point toward practical, hands-on work where progress is visible and tools, systems, or physical spaces matter.",
    "illustrationPath": "/quiz-styles/maker.svg",
    "exploreInterest": "Hands-on Trades",
    "fallbackSearch": "electrician",
    "workLike": ["hands-on progress", "field-based work", "real-world problem solving"]
  },
  "supportStyle": {
    "id": "guide",
    "label": "Guide",
    "tagline": "You care about helping people move through real challenges well.",
    "summary": "Guide answers point toward people-centred work where support, communication, and trust are central to doing the job well.",
    "illustrationPath": "/quiz-styles/guide.svg",
    "exploreInterest": "Healthcare",
    "fallbackSearch": "nurse",
    "workLike": ["helping people", "clear communication", "steady support"]
  },
  "archetypeTitle": "Community Responder",
  "archetypeSummary": "Practical work that helps people feel safer or more supported",
  "scoreBreakdown": [
    {
      "dimensionId": "builder",
      "label": "Maker",
      "rawScore": 17,
      "normalizedScore": 0.707107,
      "rank": 1
    }
  ],
  "recommendedCareers": [
    {
      "id": "software-engineer",
      "anzsco": "341111",
      "title": "Electrician (General)",
      "industry": "Engineering",
      "salary": { "entry": 85000, "mid": 115000, "senior": 150000 },
      "demand": { "vic": "High", "national": "High" },
      "shortage": true,
      "aiRisk": 0.18,
      "atarTypical": null,
      "pathways": [],
      "fitLabel": "Maker + Guide fit",
      "matchScore": 0.872314,
      "matchExplanation": "Strong Builder + Guide alignment based on the current quiz dimension model.",
      "visualStyleId": "builder"
    }
  ],
  "exploreInterest": "Hands-on Trades",
  "exploreSearch": "electrician",
  "sessionToken": "c3b1f62c-33a3-4dbd-9aa1-9a9d23390e15"
}
```

`POST /quiz` remains available as a legacy alias for `POST /quiz/result`.

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

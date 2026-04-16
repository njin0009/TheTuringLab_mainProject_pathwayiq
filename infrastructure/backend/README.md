# PathwayIQ Backend

AWS Lambda backend for the PathwayIQ career exploration platform.

## API Endpoint

GET https://ml4dqmpnn9.execute-api.ap-southeast-2.amazonaws.com/careers

## Query Parameters

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| q         | string | No       | Keyword search against career title and industry. Max 100 characters. |
| pathway   | string | No       | Filter by pathway type. Must be: University, TAFE, or Apprenticeship. |
| ai_risk   | string | No       | Filter by AI displacement risk. Must be: Low, Medium, or High. |

## Example Requests

Get all careers:
GET /careers

Search by keyword:
GET /careers?q=nurse

Filter by pathway:
GET /careers?pathway=TAFE

Filter by AI risk:
GET /careers?ai_risk=Low

Combine filters:
GET /careers?pathway=University&ai_risk=Medium

## Response Format

```json
[
  {
    "title": "Registered Nurse",
    "industry": "Healthcare",
    "salary_min": 75000,
    "salary_max": 110000,
    "pathway": "University",
    "shortage_status": "In Shortage",
    "ai_risk": "Low"
  }
]
```

## Error Responses

| Status | Description |
|--------|-------------|
| 400    | Invalid parameter value |
| 500    | Internal server error |
| 503    | Career data temporarily unavailable |

## Tech Stack

- AWS Lambda (Node.js 20.x)
- AWS API Gateway (HTTP API)
- Serverless Framework
- Region: ap-southeast-2 (Sydney)

## Deployment

```bash
npm install
npx serverless deploy
```
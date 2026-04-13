import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getCareers } from '../services/data-client'
import { buildLabels, getAIRiskLevel } from '../services/labeller'

// ── GET /compare?a={id}&b={id} ──
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const idA = event.queryStringParameters?.a ?? ''
    const idB = event.queryStringParameters?.b ?? ''
    if (!idA || !idB) return { statusCode: 400, body: JSON.stringify({ error: 'Provide ?a= and ?b= career IDs' }) }

    const careers = await getCareers()
    const a = careers.find(c => c.id === idA)
    const b = careers.find(c => c.id === idB)
    if (!a || !b) return { statusCode: 404, body: JSON.stringify({ error: 'One or both careers not found' }) }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        a: { ...a, labels: buildLabels(a), ai_risk_level: getAIRiskLevel(a.ai_risk) },
        b: { ...b, labels: buildLabels(b), ai_risk_level: getAIRiskLevel(b.ai_risk) },
      }),
    }
  } catch (err) {
    console.error('compare handler error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}

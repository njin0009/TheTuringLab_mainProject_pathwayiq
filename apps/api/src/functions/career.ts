import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getCareers } from '../services/data-client'
import { buildLabels } from '../services/labeller'

// ── GET /careers/:id ──
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const id = event.pathParameters?.id ?? ''
    const careers = await getCareers()
    const career  = careers.find(c => c.id === id)
    if (!career) return { statusCode: 404, body: JSON.stringify({ error: 'Career not found' }) }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...career, labels: buildLabels(career) }),
    }
  } catch (err) {
    console.error('career handler error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}

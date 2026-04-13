import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getCareers, getEducationPathways } from '../services/data-client'
import { buildLabels } from '../services/labeller'

// ── GET /report/:careerId ──
export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const careerId = event.pathParameters?.careerId ?? ''
    const [careers, pathways] = await Promise.all([getCareers(), getEducationPathways()])
    const career = careers.find(c => c.id === careerId)
    if (!career) return { statusCode: 404, body: JSON.stringify({ error: 'Career not found' }) }

    const report = {
      career:   { ...career, labels: buildLabels(career) },
      pathways: pathways[career.anzsco] ?? career.pathways,
      // PDF generation via @react-pdf/renderer added in Iteration 2
      generatedAt: new Date().toISOString(),
      dataSources: ['JSA 2025 OSL', 'DESE GOS 2023', 'NCVER 2024', 'OECD Automation Risk'],
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    }
  } catch (err) {
    console.error('report handler error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}

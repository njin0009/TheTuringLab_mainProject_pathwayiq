import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getCareers } from '../services/data-client'
import { buildLabels } from '../services/labeller'

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const q        = (event.queryStringParameters?.q ?? '').toLowerCase()
    const industry = event.queryStringParameters?.industry ?? ''
    const pathway  = event.queryStringParameters?.pathway  ?? ''
    const aiRisk   = event.queryStringParameters?.aiRisk   ?? ''

    let careers = await getCareers()

    if (q)        careers = careers.filter(c => c.title.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q))
    if (industry) careers = careers.filter(c => c.industry === industry)
    if (pathway)  careers = careers.filter(c => c.pathways.some(p => p.type === pathway))
    if (aiRisk)   careers = careers.filter(c => {
      const score = c.ai_risk
      if (aiRisk === 'Low')    return score < 0.35
      if (aiRisk === 'Medium') return score >= 0.35 && score < 0.65
      if (aiRisk === 'High')   return score >= 0.65
      return true
    })

    const results = careers.slice(0, 20).map(c => ({ ...c, labels: buildLabels(c) }))

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results, total: results.length }),
    }
  } catch (err) {
    console.error('search handler error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}

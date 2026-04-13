import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { matchCareers } from '../services/matcher'
import type { QuizResponse } from '../types/career'

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const quiz = JSON.parse(event.body ?? '{}') as QuizResponse
    const matches = await matchCareers(quiz)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matches }),
    }
  } catch (err) {
    console.error('quiz handler error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}

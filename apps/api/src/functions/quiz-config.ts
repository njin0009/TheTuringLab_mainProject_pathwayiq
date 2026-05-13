import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { getQuizConfig, isQuizHttpError } from '../services/quiz-service'
import type { QuizModeId } from '../types/quiz'

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const mode = (event.queryStringParameters?.mode ?? '').toLowerCase() as QuizModeId
    const quizVersionId = event.queryStringParameters?.quizVersionId

    if (mode !== 'quick' && mode !== 'deep') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Query parameter "mode" must be "quick" or "deep".' }),
      }
    }

    const config = await getQuizConfig(mode, quizVersionId)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }
  } catch (err) {
    if (isQuizHttpError(err)) {
      return {
        statusCode: err.statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message, details: err.details }),
      }
    }

    console.error('quiz config handler error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}

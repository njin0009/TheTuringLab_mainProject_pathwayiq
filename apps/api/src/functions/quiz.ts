import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { createQuizResult, isQuizHttpError } from '../services/quiz-service'
import type { QuizModeId, QuizResultRequest } from '../types/quiz'

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    let quizRequest: QuizResultRequest

    try {
      quizRequest = JSON.parse(event.body ?? '{}') as QuizResultRequest
    } catch {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body must be valid JSON.' }),
      }
    }

    const mode = String(quizRequest.mode ?? '').toLowerCase() as QuizModeId

    if (mode !== 'quick' && mode !== 'deep') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body field "mode" must be "quick" or "deep".' }),
      }
    }

    quizRequest.mode = mode
    const result = await createQuizResult(quizRequest)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    }
  } catch (err) {
    if (isQuizHttpError(err)) {
      return {
        statusCode: err.statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message, details: err.details }),
      }
    }

    console.error('quiz handler error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}

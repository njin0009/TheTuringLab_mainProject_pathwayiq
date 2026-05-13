import type { CareerMatch, QuizResponse } from '../types/career'

export async function aiMatcher(_quiz: QuizResponse): Promise<CareerMatch[]> {
  throw new Error('AI matching not yet implemented — set FEATURE_AI_MATCHING=false')
}

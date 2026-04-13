import type { QuizResponse, CareerMatch } from '../types/career'
import { getCareers, getAIRiskScores } from './data-client'

// Interest tag map — quiz answers → interest tags
const ANSWER_TAGS: Record<string, string[]> = {
  // Q1 — work style
  'hands-on':    ['Practical', 'Technical'],
  'analytical':  ['Analytical', 'Problem-solving'],
  'creative':    ['Creative', 'Design'],
  'social':      ['Social', 'Communication'],
  // Q2 — environment
  'outdoors':    ['Physical', 'Environmental'],
  'office':      ['Organisational', 'Analytical'],
  'remote':      ['Technical', 'Independent'],
  'mixed':       ['Flexible', 'Communication'],
  // Q3 — subject
  'science':     ['Scientific', 'Analytical'],
  'technology':  ['Technical', 'Problem-solving'],
  'arts':        ['Creative', 'Communication'],
  'business':    ['Entrepreneurial', 'Organisational'],
  'health':      ['Social', 'Scientific'],
  'trades':      ['Practical', 'Technical'],
  // Q4 — motivation
  'helping':     ['Social', 'Empathy'],
  'building':    ['Technical', 'Creative'],
  'leading':     ['Leadership', 'Organisational'],
  'discovering': ['Analytical', 'Scientific'],
}

function extractTags(quiz: QuizResponse): string[] {
  const tags = new Set<string>()
  for (const answer of Object.values(quiz)) {
    const matched = ANSWER_TAGS[answer] ?? []
    matched.forEach(t => tags.add(t))
  }
  return [...tags]
}

function scoreCareer(careerTags: string[], interestTags: string[], shortage: boolean): number {
  const matches = careerTags.filter(t => interestTags.includes(t)).length
  const base    = Math.round((matches / Math.max(careerTags.length, 1)) * 80)
  const bonus   = shortage ? 10 : 0
  return Math.min(base + bonus, 100)
}

export async function matchCareers(quiz: QuizResponse): Promise<CareerMatch[]> {
  // Feature flag: swap in AI matcher in Iteration 3
  if (process.env.FEATURE_AI_MATCHING === 'true') {
    const { aiMatcher } = await import('../ai-service/quiz-enhancer')
    return aiMatcher(quiz)
  }

  const [careers, aiRisk] = await Promise.all([getCareers(), getAIRiskScores()])
  const interestTags = extractTags(quiz)

  return careers
    .map(c => ({
      ...c,
      ai_risk:      aiRisk[c.anzsco] ?? c.ai_risk,
      match_score:  scoreCareer(c.interests, interestTags, c.shortage),
      match_reasons: c.interests.filter(t => interestTags.includes(t)),
    }))
    .filter(c => c.match_score > 0)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 5)
}

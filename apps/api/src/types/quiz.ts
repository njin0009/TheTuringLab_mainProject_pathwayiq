import type { Career, Pathway } from './career'

export type QuizModeId = 'quick' | 'deep'

export interface QuizModeConfig {
  id: QuizModeId
  title: string
  durationLabel: string
  expectedDurationSeconds: number
  expectedQuestionCount: number
  blurb: string
  helperText: string
}

export interface QuizDimensionConfig {
  id: string
  label: string
  tagline: string
  summary: string
  illustrationPath: string
  exploreInterest: string | null
  fallbackSearch: string | null
  workLike: string[]
}

export interface QuizOptionConfig {
  id: string
  label: string
  helperText: string | null
  order: number
}

export interface QuizQuestionConfig {
  id: string
  prompt: string
  helperText: string | null
  order: number
  options: QuizOptionConfig[]
}

export interface QuizConfigResponse {
  quizVersionId: string
  mode: QuizModeConfig
  dimensions: QuizDimensionConfig[]
  questions: QuizQuestionConfig[]
}

export interface QuizResultRequest {
  mode: QuizModeId
  answers: Record<string, string>
  quizVersionId?: string
  consentAnalytics?: boolean
}

export interface QuizScoreBreakdownItem {
  dimensionId: string
  label: string
  rawScore: number
  normalizedScore: number
  rank: number
}

export interface QuizRecommendedCareer {
  rank: number
  id: string
  anzsco: string
  title: string
  industry: string
  salary: Career['salary']
  demand: Career['demand']
  shortage: boolean
  aiRisk: number
  atarTypical: number | null
  pathways: Pathway[]
  fitLabel: string
  matchScore: number
  matchExplanation: string
  visualStyleId: string
}

export interface QuizResultResponse {
  quizVersionId: string
  mode: QuizModeId
  totalQuestions: number
  topStyle: QuizDimensionConfig
  supportStyle: QuizDimensionConfig
  archetypeTitle: string
  archetypeSummary: string
  scoreBreakdown: QuizScoreBreakdownItem[]
  recommendedCareers: QuizRecommendedCareer[]
  exploreInterest: string | null
  exploreSearch: string | null
  sessionToken?: string
}

import type { PoolClient, QueryResultRow } from 'pg'
import { getCareers } from './data-client'
import { getPostgresPool, queryRows } from './azure-postgres-client'
import type {
  QuizConfigResponse,
  QuizDimensionConfig,
  QuizModeConfig,
  QuizModeId,
  QuizQuestionConfig,
  QuizRecommendedCareer,
  QuizResultRequest,
  QuizResultResponse,
  QuizScoreBreakdownItem,
} from '../types/quiz'

class QuizHttpError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'QuizHttpError'
  }
}

interface QuizVersionRow extends QueryResultRow {
  quiz_version_id: string
}

interface QuizModeRow extends QueryResultRow {
  mode_id: string
  title: string
  duration_label: string
  expected_duration_seconds: number | string
  expected_question_count: number | string
  blurb: string
  helper_text: string
}

interface QuizDimensionRow extends QueryResultRow {
  dimension_id: string
  display_label: string
  tagline: string
  summary: string
  illustration_path: string
  explore_interest: string | null
  fallback_search: string | null
  display_order: number | string
  tie_break_rank: number | string
  work_like: string[] | null
}

interface QuizQuestionRow extends QueryResultRow {
  question_code: string
  prompt_text: string
  question_helper_text: string | null
  question_order: number | string
  option_code: string
  option_label: string
  option_helper_text: string | null
  option_order: number | string
}

interface QuizWeightRow extends QueryResultRow {
  question_code: string
  option_code: string
  dimension_id: string
  weight: number | string
}

interface QuizScoringParameterRow extends QueryResultRow {
  scope_key: string
  parameter_key: string
  numeric_value: number | string
}

interface QuizArchetypeRow extends QueryResultRow {
  archetype_title: string
  archetype_summary: string
}

interface OccupationDimensionRow extends QueryResultRow {
  occupation_code: string
  dimension_id: string
  affinity_score: number | string
  evidence_summary: string | null
}

interface QuizSessionRow extends QueryResultRow {
  session_id: string
  public_session_token: string
}

interface QuizContext {
  quizVersionId: string
  mode: QuizModeConfig
  dimensions: QuizDimensionConfig[]
  questions: QuizQuestionConfig[]
  tieBreakRanks: Record<string, number>
}

interface RecommendationCandidate {
  occupationCode: string
  matchScore: number
  shortageBonusApplied: boolean
  salaryBonusApplied: boolean
  matchExplanation: string
}

export function isQuizHttpError(error: unknown): error is QuizHttpError {
  return error instanceof QuizHttpError
}

export async function getQuizConfig(modeId: QuizModeId, quizVersionId?: string): Promise<QuizConfigResponse> {
  const context = await loadQuizContext(modeId, quizVersionId)

  return {
    quizVersionId: context.quizVersionId,
    mode: context.mode,
    dimensions: context.dimensions,
    questions: context.questions,
  }
}

export async function createQuizResult(request: QuizResultRequest): Promise<QuizResultResponse> {
  const context = await loadQuizContext(request.mode, request.quizVersionId)
  const answers = validateAnswers(context.questions, request.answers)
  const scoringParams = await loadScoringParameters(context.quizVersionId, context.mode.id)
  const weights = await loadModeWeights(context.quizVersionId, context.mode.id)

  const rawScoreByDimension = initializeDimensionScoreMap(context.dimensions)

  for (const question of context.questions) {
    const selectedOption = answers[question.id]
    const optionWeights = weights.get(buildWeightKey(question.id, selectedOption)) ?? []

    if (optionWeights.length === 0) {
      throw new QuizHttpError(
        'Quiz answer weights are not configured for one or more responses.',
        500,
        { questionCode: question.id, optionCode: selectedOption }
      )
    }

    for (const weight of optionWeights) {
      rawScoreByDimension[weight.dimensionId] += weight.weight
    }
  }

  const vectorNormFloor = getNumericParameter(scoringParams, 'result_vector_norm_floor', 0.0001)
  const vectorNorm = Math.max(
    Math.sqrt(Object.values(rawScoreByDimension).reduce((sum, value) => sum + value * value, 0)),
    vectorNormFloor
  )

  const normalizedScoreByDimension = Object.fromEntries(
    Object.entries(rawScoreByDimension).map(([dimensionId, rawScore]) => [dimensionId, rawScore / vectorNorm])
  )

  const rankedDimensions = [...context.dimensions].sort((left, right) => {
    const scoreDifference = rawScoreByDimension[right.id] - rawScoreByDimension[left.id]
    if (scoreDifference !== 0) return scoreDifference
    return context.tieBreakRanks[left.id] - context.tieBreakRanks[right.id]
  })

  const [topStyle, supportStyle] = rankedDimensions

  if (!topStyle || !supportStyle) {
    throw new QuizHttpError('Quiz dimensions are not configured correctly.', 500)
  }

  const scoreBreakdown: QuizScoreBreakdownItem[] = rankedDimensions.map((dimension, index) => ({
    dimensionId: dimension.id,
    label: dimension.label,
    rawScore: round(rawScoreByDimension[dimension.id], 2),
    normalizedScore: round(normalizedScoreByDimension[dimension.id], 6),
    rank: index + 1,
  }))

  const archetype = await loadArchetype(context.quizVersionId, topStyle.id, supportStyle.id, topStyle.label, supportStyle.label)
  const recommendedCareers = await rankRecommendedCareers(
    context.quizVersionId,
    topStyle,
    supportStyle,
    normalizedScoreByDimension,
    scoringParams
  )

  const result: QuizResultResponse = {
    quizVersionId: context.quizVersionId,
    mode: context.mode.id,
    totalQuestions: context.questions.length,
    topStyle,
    supportStyle,
    archetypeTitle: archetype.title,
    archetypeSummary: archetype.summary,
    scoreBreakdown,
    recommendedCareers,
    exploreInterest: topStyle.exploreInterest,
    exploreSearch: topStyle.fallbackSearch,
  }

  const sessionToken = await persistQuizResult({
    quizVersionId: context.quizVersionId,
    modeId: context.mode.id,
    answers,
    scoreBreakdown,
    archetypeTitle: result.archetypeTitle,
    archetypeSummary: result.archetypeSummary,
    topStyleId: topStyle.id,
    supportStyleId: supportStyle.id,
    recommendedCareers,
    scoringParametersSnapshot: scoringParams,
    resultPayload: result,
    consentAnalytics: request.consentAnalytics ?? true,
  })

  if (sessionToken) {
    result.sessionToken = sessionToken
  }

  return result
}

async function loadQuizContext(modeId: QuizModeId, requestedVersionId?: string): Promise<QuizContext> {
  const quizVersionId = await resolveQuizVersionId(requestedVersionId)

  const [modeRow, dimensions, questionRows] = await Promise.all([
    loadModeDefinition(quizVersionId, modeId),
    loadDimensions(),
    loadQuestionRows(quizVersionId, modeId),
  ])

  if (!modeRow) {
    throw new QuizHttpError(`Quiz mode "${modeId}" is not available for version "${quizVersionId}".`, 404)
  }

  if (questionRows.length === 0) {
    throw new QuizHttpError(`No active quiz questions were found for mode "${modeId}".`, 500)
  }

  const questions = buildQuestionConfig(questionRows)
  const expectedQuestionCount = toNumber(modeRow.expected_question_count)

  if (questions.length !== expectedQuestionCount) {
    throw new QuizHttpError(
      'Quiz configuration is inconsistent with the expected question count.',
      500,
      {
        modeId,
        expectedQuestionCount,
        actualQuestionCount: questions.length,
      }
    )
  }

  return {
    quizVersionId,
    mode: {
      id: modeId,
      title: modeRow.title,
      durationLabel: modeRow.duration_label,
      expectedDurationSeconds: toNumber(modeRow.expected_duration_seconds),
      expectedQuestionCount,
      blurb: modeRow.blurb,
      helperText: modeRow.helper_text,
    },
    dimensions: dimensions.map(mapDimensionRow),
    questions,
    tieBreakRanks: Object.fromEntries(
      dimensions.map(dimension => [dimension.dimension_id, toNumber(dimension.tie_break_rank)])
    ),
  }
}

async function resolveQuizVersionId(requestedVersionId?: string): Promise<string> {
  if (requestedVersionId) {
    const versionRows = await queryRows<QuizVersionRow>(
      `SELECT quiz_version_id FROM quiz_version WHERE quiz_version_id = $1 LIMIT 1`,
      [requestedVersionId]
    )

    if (versionRows.length === 0) {
      throw new QuizHttpError(`Quiz version "${requestedVersionId}" was not found.`, 404)
    }

    return versionRows[0].quiz_version_id
  }

  const versionRows = await queryRows<QuizVersionRow>(
    `
      SELECT quiz_version_id
      FROM quiz_version
      ORDER BY
        CASE status
          WHEN 'live' THEN 0
          WHEN 'draft' THEN 1
          ELSE 2
        END,
        COALESCE(published_at, created_at) DESC,
        quiz_version_id DESC
      LIMIT 1
    `
  )

  if (versionRows.length === 0) {
    throw new QuizHttpError('No quiz version is configured in the database.', 500)
  }

  return versionRows[0].quiz_version_id
}

async function loadModeDefinition(quizVersionId: string, modeId: QuizModeId): Promise<QuizModeRow | null> {
  const rows = await queryRows<QuizModeRow>(
    `
      SELECT
        mode_id,
        title,
        duration_label,
        expected_duration_seconds,
        expected_question_count,
        blurb,
        helper_text
      FROM quiz_mode_definition
      WHERE quiz_version_id = $1
        AND mode_id = $2
        AND is_active = TRUE
      LIMIT 1
    `,
    [quizVersionId, modeId]
  )

  return rows[0] ?? null
}

async function loadDimensions(): Promise<QuizDimensionRow[]> {
  return queryRows<QuizDimensionRow>(
    `
      SELECT
        d.dimension_id,
        d.display_label,
        d.tagline,
        d.summary,
        d.illustration_path,
        d.explore_interest,
        d.fallback_search,
        d.display_order,
        d.tie_break_rank,
        COALESCE(
          ARRAY_AGG(wl.work_like_text ORDER BY wl.display_order)
            FILTER (WHERE wl.work_like_text IS NOT NULL),
          '{}'::TEXT[]
        ) AS work_like
      FROM quiz_dimension d
      LEFT JOIN quiz_dimension_work_like wl
        ON wl.dimension_id = d.dimension_id
      WHERE d.is_active = TRUE
      GROUP BY
        d.dimension_id,
        d.display_label,
        d.tagline,
        d.summary,
        d.illustration_path,
        d.explore_interest,
        d.fallback_search,
        d.display_order,
        d.tie_break_rank
      ORDER BY d.display_order
    `
  )
}

async function loadQuestionRows(quizVersionId: string, modeId: QuizModeId): Promise<QuizQuestionRow[]> {
  return queryRows<QuizQuestionRow>(
    `
      SELECT
        question_code,
        prompt_text,
        question_helper_text,
        question_order,
        option_code,
        option_label,
        option_helper_text,
        option_order
      FROM vw_quiz_active_question_config
      WHERE quiz_version_id = $1
        AND mode_id = $2
      ORDER BY question_order, option_order
    `,
    [quizVersionId, modeId]
  )
}

function buildQuestionConfig(rows: QuizQuestionRow[]): QuizQuestionConfig[] {
  const questions = new Map<string, QuizQuestionConfig>()

  for (const row of rows) {
    const questionId = row.question_code

    if (!questions.has(questionId)) {
      questions.set(questionId, {
        id: questionId,
        prompt: row.prompt_text,
        helperText: row.question_helper_text,
        order: toNumber(row.question_order),
        options: [],
      })
    }

    questions.get(questionId)?.options.push({
      id: row.option_code,
      label: row.option_label,
      helperText: row.option_helper_text,
      order: toNumber(row.option_order),
    })
  }

  return [...questions.values()].sort((left, right) => left.order - right.order)
}

function validateAnswers(questions: QuizQuestionConfig[], answers: Record<string, string> | undefined): Record<string, string> {
  if (!answers || typeof answers !== 'object') {
    throw new QuizHttpError('Quiz answers are required.', 400)
  }

  const expectedQuestionIds = new Set(questions.map(question => question.id))
  const missingQuestions = questions
    .filter(question => !answers[question.id])
    .map(question => question.id)
  const unexpectedQuestions = Object.keys(answers).filter(questionId => !expectedQuestionIds.has(questionId))
  const invalidOptions: Array<{ questionCode: string; optionCode: string }> = []

  for (const question of questions) {
    const selectedOption = answers[question.id]
    if (!selectedOption) continue

    if (!question.options.some(option => option.id === selectedOption)) {
      invalidOptions.push({ questionCode: question.id, optionCode: selectedOption })
    }
  }

  if (missingQuestions.length > 0 || unexpectedQuestions.length > 0 || invalidOptions.length > 0) {
    throw new QuizHttpError('Quiz answers are incomplete or invalid.', 400, {
      missingQuestions,
      unexpectedQuestions,
      invalidOptions,
    })
  }

  return Object.fromEntries(
    Object.entries(answers).map(([questionCode, optionCode]) => [questionCode, String(optionCode)])
  )
}

async function loadModeWeights(quizVersionId: string, modeId: QuizModeId) {
  const rows = await queryRows<QuizWeightRow>(
    `
      SELECT question_code, option_code, dimension_id, weight
      FROM vw_quiz_option_weights
      WHERE quiz_version_id = $1
        AND mode_id = $2
    `,
    [quizVersionId, modeId]
  )

  const weights = new Map<string, Array<{ dimensionId: string; weight: number }>>()

  for (const row of rows) {
    const key = buildWeightKey(row.question_code, row.option_code)
    const existing = weights.get(key) ?? []
    existing.push({
      dimensionId: row.dimension_id,
      weight: toNumber(row.weight),
    })
    weights.set(key, existing)
  }

  return weights
}

async function loadScoringParameters(quizVersionId: string, modeId: QuizModeId): Promise<Record<string, number>> {
  const rows = await queryRows<QuizScoringParameterRow>(
    `
      SELECT scope_key, parameter_key, numeric_value
      FROM quiz_scoring_parameter
      WHERE quiz_version_id = $1
        AND scope_key IN ('global', $2)
    `,
    [quizVersionId, modeId]
  )

  const parameters: Record<string, number> = {}

  for (const row of rows.filter(parameter => parameter.scope_key === 'global')) {
    parameters[row.parameter_key] = toNumber(row.numeric_value)
  }

  for (const row of rows.filter(parameter => parameter.scope_key === modeId)) {
    parameters[row.parameter_key] = toNumber(row.numeric_value)
  }

  return parameters
}

function getNumericParameter(parameters: Record<string, number>, key: string, fallback: number): number {
  return Number.isFinite(parameters[key]) ? parameters[key] : fallback
}

async function loadArchetype(
  quizVersionId: string,
  primaryDimensionId: string,
  supportDimensionId: string,
  primaryLabel: string,
  supportLabel: string
): Promise<{ title: string; summary: string }> {
  const rows = await queryRows<QuizArchetypeRow>(
    `
      SELECT archetype_title, archetype_summary
      FROM quiz_archetype
      WHERE quiz_version_id = $1
        AND primary_dimension_id = $2
        AND support_dimension_id = $3
        AND is_active = TRUE
      LIMIT 1
    `,
    [quizVersionId, primaryDimensionId, supportDimensionId]
  )

  if (rows[0]) {
    return {
      title: rows[0].archetype_title,
      summary: rows[0].archetype_summary,
    }
  }

  return {
    title: `${primaryLabel} + ${supportLabel}`,
    summary: `Your answers suggest a mix of ${primaryLabel} energy and ${supportLabel} support.`,
  }
}

async function rankRecommendedCareers(
  quizVersionId: string,
  topStyle: QuizDimensionConfig,
  supportStyle: QuizDimensionConfig,
  normalizedScoreByDimension: Record<string, number>,
  scoringParams: Record<string, number>
): Promise<QuizRecommendedCareer[]> {
  const [occupationRows, careers] = await Promise.all([
    queryRows<OccupationDimensionRow>(
      `
        SELECT occupation_code, dimension_id, affinity_score, evidence_summary
        FROM occupation_dimension_score
        WHERE quiz_version_id = $1
      `,
      [quizVersionId]
    ),
    getCareers(),
  ])

  const careerByCode = new Map(careers.map(career => [career.anzsco, career]))
  const maxSalaryMid = Math.max(...careers.map(career => career.salary.mid), 1)
  const perOccupation = new Map<
    string,
    {
      affinityByDimension: Record<string, number>
      evidenceByDimension: Record<string, string>
    }
  >()

  for (const row of occupationRows) {
    if (!careerByCode.has(row.occupation_code)) continue

    const existing = perOccupation.get(row.occupation_code) ?? {
      affinityByDimension: {},
      evidenceByDimension: {},
    }

    existing.affinityByDimension[row.dimension_id] = toNumber(row.affinity_score)

    if (row.evidence_summary) {
      existing.evidenceByDimension[row.dimension_id] = row.evidence_summary
    }

    perOccupation.set(row.occupation_code, existing)
  }

  const shortageBonusWeight = getNumericParameter(scoringParams, 'shortage_bonus_weight', 0.15)
  const salaryBonusWeight = getNumericParameter(scoringParams, 'salary_bonus_weight', 0.05)
  const recommendationLimit = Math.max(1, Math.floor(getNumericParameter(scoringParams, 'recommendation_limit', 3)))

  const ranked: RecommendationCandidate[] = []

  for (const [occupationCode, occupationData] of perOccupation.entries()) {
    const career = careerByCode.get(occupationCode)
    if (!career) continue

    let dotProduct = 0
    let occupationNorm = 0

    for (const [dimensionId, affinityScore] of Object.entries(occupationData.affinityByDimension)) {
      dotProduct += (normalizedScoreByDimension[dimensionId] ?? 0) * affinityScore
      occupationNorm += affinityScore * affinityScore
    }

    if (occupationNorm <= 0) continue

    const cosineScore = dotProduct / Math.sqrt(occupationNorm)
    const shortageBonusApplied = career.shortage
    const salaryBonusApplied = career.salary.mid > 0
    const shortageBonus = shortageBonusApplied ? shortageBonusWeight : 0
    const salaryBonus = salaryBonusApplied ? (career.salary.mid / maxSalaryMid) * salaryBonusWeight : 0
    const matchScore = cosineScore + shortageBonus + salaryBonus
    const topEvidence = occupationData.evidenceByDimension[topStyle.id]
    const supportEvidence = occupationData.evidenceByDimension[supportStyle.id]
    const evidenceParts = [topEvidence, supportEvidence].filter(Boolean)

    ranked.push({
      occupationCode,
      matchScore,
      shortageBonusApplied,
      salaryBonusApplied,
      matchExplanation:
        evidenceParts.length > 0
          ? evidenceParts.join(' | ')
          : `Strong ${topStyle.label} + ${supportStyle.label} alignment based on the current quiz dimension model.`,
    })
  }

  return ranked
    .sort((left, right) => right.matchScore - left.matchScore)
    .slice(0, recommendationLimit)
    .map((candidate, index) => {
      const career = careerByCode.get(candidate.occupationCode)

      if (!career) {
        throw new QuizHttpError(
          `Recommended career "${candidate.occupationCode}" could not be found in the frontend data source.`,
          500
        )
      }

      return {
        rank: index + 1,
        id: career.id,
        anzsco: career.anzsco,
        title: career.title,
        industry: career.industry,
        salary: career.salary,
        demand: career.demand,
        shortage: career.shortage,
        aiRisk: career.ai_risk,
        atarTypical: career.atar_typical,
        pathways: career.pathways,
        fitLabel: `${topStyle.label} + ${supportStyle.label} fit`,
        matchScore: round(candidate.matchScore, 6),
        matchExplanation: candidate.matchExplanation,
        visualStyleId: topStyle.id,
      } satisfies QuizRecommendedCareer
    })
}

async function persistQuizResult(input: {
  quizVersionId: string
  modeId: QuizModeId
  answers: Record<string, string>
  scoreBreakdown: QuizScoreBreakdownItem[]
  archetypeTitle: string
  archetypeSummary: string
  topStyleId: string
  supportStyleId: string
  recommendedCareers: QuizRecommendedCareer[]
  scoringParametersSnapshot: Record<string, number>
  resultPayload: QuizResultResponse
  consentAnalytics: boolean
}): Promise<string | undefined> {
  const pool = getPostgresPool()
  let client: PoolClient | undefined

  try {
    client = await pool.connect()
    await client.query('BEGIN')

    const sessionRows = await client.query<QuizSessionRow>(
      `
        INSERT INTO quiz_session (
          quiz_version_id,
          mode_id,
          status,
          completed_at,
          consent_analytics,
          privacy_notice_version
        )
        VALUES ($1, $2, 'completed', NOW(), $3, 'v1')
        RETURNING session_id, public_session_token
      `,
      [input.quizVersionId, input.modeId, input.consentAnalytics]
    )

    const session = sessionRows.rows[0]

    if (!session) {
      throw new Error('Failed to create quiz session.')
    }

    for (const [questionCode, optionCode] of Object.entries(input.answers)) {
      await client.query(
        `
          INSERT INTO quiz_response (
            session_id,
            quiz_version_id,
            question_code,
            option_code
          )
          VALUES ($1, $2, $3, $4)
        `,
        [session.session_id, input.quizVersionId, questionCode, optionCode]
      )
    }

    await client.query(
      `
        INSERT INTO quiz_result_snapshot (
          session_id,
          quiz_version_id,
          mode_id,
          scoring_method,
          top_dimension_id,
          support_dimension_id,
          archetype_title,
          archetype_summary,
          scoring_parameters_snapshot,
          result_payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        session.session_id,
        input.quizVersionId,
        input.modeId,
        'cosine_affinity_plus_operational_bonuses_v1',
        input.topStyleId,
        input.supportStyleId,
        input.archetypeTitle,
        input.archetypeSummary,
        input.scoringParametersSnapshot,
        input.resultPayload,
      ]
    )

    for (const item of input.scoreBreakdown) {
      await client.query(
        `
          INSERT INTO quiz_result_dimension_score (
            session_id,
            dimension_id,
            raw_score,
            normalized_score,
            dimension_rank
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [session.session_id, item.dimensionId, item.rawScore, item.normalizedScore, item.rank]
      )
    }

    for (const recommendation of input.recommendedCareers) {
      await client.query(
        `
          INSERT INTO quiz_result_recommendation (
            session_id,
            recommendation_rank,
            occupation_code,
            match_score,
            shortage_bonus_applied,
            salary_bonus_applied,
            match_explanation
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          session.session_id,
          recommendation.rank,
          recommendation.anzsco,
          recommendation.matchScore,
          recommendation.shortage,
          recommendation.salary.mid > 0,
          recommendation.matchExplanation,
        ]
      )
    }

    await client.query('COMMIT')
    return session.public_session_token
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK')
    }

    console.warn('Quiz result persistence failed; returning result without session token.', error)
    return undefined
  } finally {
    client?.release()
  }
}

function initializeDimensionScoreMap(dimensions: QuizDimensionConfig[]): Record<string, number> {
  return Object.fromEntries(dimensions.map(dimension => [dimension.id, 0]))
}

function mapDimensionRow(row: QuizDimensionRow): QuizDimensionConfig {
  return {
    id: row.dimension_id,
    label: row.display_label,
    tagline: row.tagline,
    summary: row.summary,
    illustrationPath: row.illustration_path,
    exploreInterest: row.explore_interest,
    fallbackSearch: row.fallback_search,
    workLike: row.work_like ?? [],
  }
}

function buildWeightKey(questionCode: string, optionCode: string): string {
  return `${questionCode}::${optionCode}`
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value)
}

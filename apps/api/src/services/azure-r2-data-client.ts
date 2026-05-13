import type { S3Client } from '@aws-sdk/client-s3'
import type { Career, Pathway } from '../types/career'
import { getDataBackend, hasAzureDatabaseConfig, queryRows } from './azure-postgres-client'

interface AzureOccupationRow {
  anzsco_code: string
  occupation_title: string
  major_group_label: string | null
  skill_level: string | null
  median_salary: number | string | null
  national_shortage_rating: string | null
  victoria_shortage_rating: string | null
  shortage_status: string | null
  ai_risk: string | null
}

interface AzureCareerCardRow {
  anzsco_code: string
  title: string
  industry: string | null
  median_salary: number | string | null
  pathway: string | null
  shortage_status: string | null
}

interface AzureProgramRow {
  program_code: string
  program_name: string
  aqf_level_name: string | null
  pathway: string | null
  field_of_education_name: string | null
  industry_name: string | null
  median_salary: number | string | null
  pct_employed_post: number | string | null
  pct_employed_or_study: number | string | null
  pct_satisfied: number | string | null
  pct_apprentice_trainees: number | string | null
  is_apprenticeship: boolean | null
}

interface AzurePathwayRow {
  program_code: string
  program_name: string
  anzsco_code: string
  occupation_title: string
  pathway_rank_no: number | string | null
  occupation_share_pct: number | string | null
  match_status: string | null
  aqf_level_name: string | null
  pathway: string | null
  median_salary: number | string | null
  shortage_status: string | null
}

interface R2Enrichment {
  careersByAnzsco: Map<string, Career>
  aiRisk: Record<string, number>
  pathways: Record<string, Pathway[]>
}

const DEFAULT_AI_RISK = 0.5
const DEFAULT_PATHWAY_TEXT = 'Not specified'

let r2Client: S3Client | null = null
let s3ModulePromise: Promise<typeof import('@aws-sdk/client-s3')> | null = null
let cachedCareers: Career[] | null = null
let cachedAIRisk: Record<string, number> | null = null
let cachedPathways: Record<string, Pathway[]> | null = null

export async function getCareers(): Promise<Career[]> {
  if (!cachedCareers) cachedCareers = await loadCareers()
  return cachedCareers
}

export async function getAIRiskScores(): Promise<Record<string, number>> {
  if (cachedAIRisk) return cachedAIRisk

  const enrichment = await loadOptionalR2Enrichment()
  if (Object.keys(enrichment.aiRisk).length > 0) {
    cachedAIRisk = enrichment.aiRisk
    return cachedAIRisk
  }

  const careers = await getCareers()
  cachedAIRisk = Object.fromEntries(careers.map(career => [career.anzsco, career.ai_risk]))
  return cachedAIRisk
}

export async function getEducationPathways(): Promise<Record<string, Pathway[]>> {
  if (cachedPathways) return cachedPathways

  const careers = await getCareers()
  const derived = Object.fromEntries(careers.map(career => [career.anzsco, career.pathways]))
  const enrichment = await loadOptionalR2Enrichment()

  for (const [anzsco, pathways] of Object.entries(enrichment.pathways)) {
    if (!derived[anzsco] || derived[anzsco].length === 0) {
      derived[anzsco] = pathways
    }
  }

  cachedPathways = derived
  return cachedPathways
}

async function loadCareers(): Promise<Career[]> {
  const backend = getDataBackend()
  const hasAzure = hasAzureDatabaseConfig()

  if (backend === 'r2') {
    return loadCareersFromR2()
  }

  if (backend === 'azure' || (backend === 'auto' && hasAzure)) {
    try {
      const [azureCareers, enrichment] = await Promise.all([
        loadCareersFromAzure(),
        loadOptionalR2Enrichment(),
      ])
      return mergeAzureWithEnrichment(azureCareers, enrichment)
    } catch (error) {
      if (backend === 'azure') throw error
      console.warn('Azure mart load failed, falling back to R2 JSON data.', error)
    }
  }

  return loadCareersFromR2()
}

async function loadCareersFromAzure(): Promise<Career[]> {
  const [occupations, cards, pathways, programs] = await Promise.all([
    queryRows<AzureOccupationRow>(`
      SELECT
        anzsco_code,
        occupation_title,
        major_group_label,
        skill_level,
        median_salary,
        national_shortage_rating,
        victoria_shortage_rating,
        shortage_status,
        ai_risk
      FROM pathwayiq_mart.vw_frontend_occupations
    `),
    queryRows<AzureCareerCardRow>(`
      SELECT
        anzsco_code,
        title,
        industry,
        median_salary,
        pathway,
        shortage_status
      FROM pathwayiq_mart.vw_frontend_career_cards
    `),
    queryRows<AzurePathwayRow>(`
      SELECT
        program_code,
        program_name,
        anzsco_code,
        occupation_title,
        pathway_rank_no,
        occupation_share_pct,
        match_status,
        aqf_level_name,
        pathway,
        median_salary,
        shortage_status
      FROM pathwayiq_mart.vw_frontend_pathways
      ORDER BY anzsco_code, pathway_rank_no NULLS LAST, program_name
    `),
    queryRows<AzureProgramRow>(`
      SELECT
        program_code,
        program_name,
        aqf_level_name,
        pathway,
        field_of_education_name,
        industry_name,
        median_salary,
        pct_employed_post,
        pct_employed_or_study,
        pct_satisfied,
        pct_apprentice_trainees,
        is_apprenticeship
      FROM pathwayiq_mart.vw_frontend_programs
    `),
  ])

  const occupationsByCode = new Map(occupations.map(row => [row.anzsco_code, row]))
  const cardsByCode = new Map(cards.map(row => [row.anzsco_code, row]))
  const programsByCode = new Map(programs.map(row => [row.program_code, row]))
  const pathwaysByCode = buildAzurePathwayMap(pathways, programsByCode)

  const allCodes = new Set<string>([
    ...occupationsByCode.keys(),
    ...cardsByCode.keys(),
    ...pathwaysByCode.keys(),
  ])

  return [...allCodes]
    .map(anzsco => {
      const occupation = occupationsByCode.get(anzsco)
      const card = cardsByCode.get(anzsco)
      const azurePathways = pathwaysByCode.get(anzsco) ?? []
      const title = card?.title ?? occupation?.occupation_title ?? anzsco
      const medianSalary = toNumber(card?.median_salary) ?? toNumber(occupation?.median_salary) ?? 0
      const demand = {
        vic: mapDemand(occupation?.victoria_shortage_rating ?? card?.shortage_status),
        national: mapDemand(occupation?.national_shortage_rating),
      }
      const aiRisk = mapAzureAIRiskLabel(occupation?.ai_risk)

      return {
        id: slugifyTitle(title),
        title,
        anzsco,
        industry: card?.industry ?? occupation?.major_group_label ?? 'Unknown',
        salary: deriveSalaryBands(medianSalary),
        demand,
        growth_10yr: 0,
        ai_risk: aiRisk,
        shortage: isShortageSignal(occupation?.victoria_shortage_rating ?? card?.shortage_status, demand.vic),
        disappearing: false,
        labels: [],
        pathways: azurePathways,
        atar_typical: null,
        interests: [],
      } satisfies Career
    })
    .sort((a, b) => a.title.localeCompare(b.title))
}

function buildAzurePathwayMap(
  rows: AzurePathwayRow[],
  programsByCode: Map<string, AzureProgramRow>
): Map<string, Pathway[]> {
  const grouped = new Map<string, Pathway[]>()

  for (const row of rows) {
    const program = programsByCode.get(row.program_code)
    const pathway = buildAzurePathway(row, program)
    const existing = grouped.get(row.anzsco_code) ?? []

    if (!existing.some(item => item.name === pathway.name && item.type === pathway.type)) {
      existing.push(pathway)
    }

    grouped.set(row.anzsco_code, existing)
  }

  return grouped
}

function buildAzurePathway(row: AzurePathwayRow, program?: AzureProgramRow): Pathway {
  const pathwayType = normalizePathwayType(row.pathway ?? program?.pathway)
  const employmentRate = toNumber(program?.pct_employed_or_study) ?? toNumber(program?.pct_employed_post) ?? 0
  const medianSalary = toNumber(row.median_salary) ?? toNumber(program?.median_salary) ?? 0
  const institution = program?.aqf_level_name ?? row.aqf_level_name ?? DEFAULT_PATHWAY_TEXT

  return {
    type: pathwayType,
    name: row.program_name,
    institution,
    duration: program?.is_apprenticeship ? 'Varies by employer' : DEFAULT_PATHWAY_TEXT,
    cost: pathwayType === 'Apprenticeship'
      ? 'Usually paid employment'
      : pathwayType === 'University'
        ? 'Check provider fees / HECS'
        : DEFAULT_PATHWAY_TEXT,
    atar_required: pathwayType === 'University' ? 'Check provider requirements' : 'Not typically required',
    employment_rate: employmentRate,
    entry_salary: deriveEntrySalary(medianSalary),
  }
}

function mapAzureAIRiskLabel(value: string | null | undefined): number {
  if (value === 'Low') return 0.2
  if (value === 'Medium') return 0.5
  if (value === 'High') return 0.8
  return DEFAULT_AI_RISK
}

function mergeAzureWithEnrichment(azureCareers: Career[], enrichment: R2Enrichment): Career[] {
  const mergedByAnzsco = new Map<string, Career>()

  for (const career of azureCareers) {
    const enrichedCareer = enrichment.careersByAnzsco.get(career.anzsco)
    const aiRisk = enrichment.aiRisk[career.anzsco] ?? enrichedCareer?.ai_risk ?? career.ai_risk
    const fallbackPathways = enrichment.pathways[career.anzsco] ?? enrichedCareer?.pathways ?? []
    const pathways = career.pathways.length > 0 ? career.pathways : fallbackPathways

    mergedByAnzsco.set(career.anzsco, {
      ...career,
      id: enrichedCareer?.id ?? career.id,
      industry: enrichedCareer?.industry || career.industry,
      salary: enrichedCareer?.salary ?? career.salary,
      demand: enrichedCareer?.demand ?? career.demand,
      growth_10yr: enrichedCareer?.growth_10yr ?? career.growth_10yr,
      ai_risk: aiRisk,
      shortage: enrichedCareer?.shortage ?? career.shortage,
      disappearing: enrichedCareer?.disappearing ?? career.disappearing,
      pathways,
      atar_typical: enrichedCareer?.atar_typical ?? career.atar_typical,
      interests: enrichedCareer?.interests ?? career.interests,
    })
  }

  for (const enrichedCareer of enrichment.careersByAnzsco.values()) {
    if (!mergedByAnzsco.has(enrichedCareer.anzsco)) {
      mergedByAnzsco.set(enrichedCareer.anzsco, enrichedCareer)
    }
  }

  return [...mergedByAnzsco.values()].sort((a, b) => a.title.localeCompare(b.title))
}

async function loadCareersFromR2(): Promise<Career[]> {
  if (!hasR2Config()) {
    throw new Error('No data source configured. Provide Azure PostgreSQL settings or R2 credentials.')
  }

  return readJSON<Career[]>('careers.json')
}

async function loadOptionalR2Enrichment(): Promise<R2Enrichment> {
  if (!hasR2Config()) {
    return emptyEnrichment()
  }

  const [careersResult, aiRiskResult, pathwaysResult] = await Promise.allSettled([
    readJSON<Career[]>('careers.json'),
    readJSON<Record<string, number>>('ai_risk_scores.json'),
    readJSON<Record<string, Pathway[]>>('education_pathways.json'),
  ])

  const careers = careersResult.status === 'fulfilled' ? careersResult.value : []
  const aiRisk = aiRiskResult.status === 'fulfilled' ? aiRiskResult.value : {}
  const pathways = pathwaysResult.status === 'fulfilled' ? pathwaysResult.value : {}

  if (careersResult.status === 'rejected') {
    console.warn('R2 careers.json enrichment unavailable.', careersResult.reason)
  }
  if (aiRiskResult.status === 'rejected') {
    console.warn('R2 ai_risk_scores.json enrichment unavailable.', aiRiskResult.reason)
  }
  if (pathwaysResult.status === 'rejected') {
    console.warn('R2 education_pathways.json enrichment unavailable.', pathwaysResult.reason)
  }

  return {
    careersByAnzsco: new Map(careers.map(career => [career.anzsco, career])),
    aiRisk,
    pathways,
  }
}

function emptyEnrichment(): R2Enrichment {
  return {
    careersByAnzsco: new Map<string, Career>(),
    aiRisk: {},
    pathways: {},
  }
}

async function readJSON<T>(key: string): Promise<T> {
  const bucket = process.env.R2_BUCKET_NAME!
  const client = await getR2Client()
  const { GetObjectCommand } = await getS3Module()
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  const response = await client.send(command)
  const body = await response.Body?.transformToString()

  if (!body) {
    throw new Error(`R2 object ${key} was empty.`)
  }

  return JSON.parse(body) as T
}

async function getR2Client(): Promise<S3Client> {
  if (!hasR2Config()) {
    throw new Error('R2 is not configured.')
  }

  if (!r2Client) {
    const { S3Client } = await getS3Module()
    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY!,
        secretAccessKey: process.env.R2_SECRET_KEY!,
      },
    })
  }

  return r2Client
}

async function getS3Module(): Promise<typeof import('@aws-sdk/client-s3')> {
  if (!s3ModulePromise) {
    s3ModulePromise = import('@aws-sdk/client-s3')
  }

  return s3ModulePromise
}

function hasR2Config(): boolean {
  return Boolean(
    process.env.R2_BUCKET_NAME &&
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY &&
    process.env.R2_SECRET_KEY
  )
}

function mapDemand(value?: string | null): Career['demand']['vic'] {
  const normalized = (value ?? '').toLowerCase().trim()

  if (!normalized || normalized === 'unknown') return 'Medium'
  if (normalized.includes('no shortage') || normalized.includes('low')) return 'Low'
  if (normalized.includes('balanced') || normalized.includes('moderate') || normalized.includes('medium')) return 'Medium'
  if (normalized.includes('strong') || normalized.includes('shortage') || normalized.includes('high') || normalized.includes('in demand')) {
    return 'High'
  }

  return 'Medium'
}

function isShortageSignal(value: string | null | undefined, demand: Career['demand']['vic']): boolean {
  const normalized = (value ?? '').toLowerCase()
  if (normalized.includes('no shortage')) return false
  if (normalized.includes('shortage') || normalized.includes('in demand')) return true
  return demand === 'High'
}

function deriveSalaryBands(medianSalary: number): Career['salary'] {
  if (!medianSalary || medianSalary <= 0) {
    return { entry: 0, mid: 0, senior: 0 }
  }

  return {
    entry: deriveEntrySalary(medianSalary),
    mid: roundCurrency(medianSalary),
    senior: roundCurrency(medianSalary * 1.25),
  }
}

function deriveEntrySalary(medianSalary: number): number {
  return medianSalary > 0 ? roundCurrency(medianSalary * 0.75) : 0
}

function roundCurrency(value: number): number {
  return Math.round(value / 100) * 100
}

function normalizePathwayType(value?: string | null): Pathway['type'] {
  const normalized = (value ?? '').toLowerCase()
  if (normalized.includes('apprent')) return 'Apprenticeship'
  if (normalized.includes('tafe')) return 'TAFE'
  if (normalized.includes('online')) return 'Online'
  return 'University'
}

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function slugifyTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\/\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

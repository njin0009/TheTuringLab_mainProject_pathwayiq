import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import type { Career } from '../types/career'

// R2 uses S3-compatible API — only the endpoint URL differs from S3
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY!,
    secretAccessKey: process.env.R2_SECRET_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!

async function readJSON<T>(key: string): Promise<T> {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  const res  = await r2.send(cmd)
  const body = await res.Body!.transformToString()
  return JSON.parse(body) as T
}

// Cached per Lambda warm instance
let _careers:  Career[] | null = null
let _aiRisk:   Record<string, number> | null = null
let _pathways: Record<string, unknown> | null = null

export async function getCareers(): Promise<Career[]> {
  if (!_careers) _careers = await readJSON<Career[]>('careers.json')
  return _careers
}

export async function getAIRiskScores(): Promise<Record<string, number>> {
  if (!_aiRisk) _aiRisk = await readJSON<Record<string, number>>('ai_risk_scores.json')
  return _aiRisk
}

export async function getEducationPathways(): Promise<Record<string, unknown>> {
  if (!_pathways) _pathways = await readJSON<Record<string, unknown>>('education_pathways.json')
  return _pathways
}

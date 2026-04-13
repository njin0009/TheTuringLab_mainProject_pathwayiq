import type { Career, AIRiskLevel } from '../types/career'

export function getAIRiskLevel(score: number): AIRiskLevel {
  if (score < 0.35) return 'Low'
  if (score < 0.65) return 'Medium'
  return 'High'
}

export function buildLabels(career: Career): string[] {
  const labels: string[] = []
  if (career.shortage)     labels.push('↑ In demand')
  if (career.disappearing) labels.push('↓ Declining')
  const risk = getAIRiskLevel(career.ai_risk)
  if (risk === 'Low')    labels.push('Low AI risk')
  if (risk === 'Medium') labels.push('Medium AI risk')
  if (risk === 'High')   labels.push('High AI risk')
  return labels
}

/**
 * ai-service/ — reserved for Iteration 3
 *
 * Drop-in replacement for matcher.ts rule-based scoring.
 * Enabled via FEATURE_AI_MATCHING=true environment variable.
 * All API Gateway routes and Lambda function signatures stay identical.
 *
 * Planned files:
 *   bedrock-client.ts  — AWS Bedrock API wrapper
 *   quiz-enhancer.ts   — AI-powered quiz → career matching
 *   embeddings.ts      — Career similarity via Titan Embeddings
 *   report-narrator.ts — Personalised PDF narrative generation
 */

export async function aiMatcher(_quiz: unknown): Promise<never[]> {
  throw new Error('AI matching not yet implemented — set FEATURE_AI_MATCHING=false')
}

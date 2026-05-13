import { Pool, type PoolConfig, type QueryResultRow } from 'pg'

export type DataBackend = 'auto' | 'azure' | 'r2'

let pool: Pool | null = null

export function getDataBackend(): DataBackend {
  const raw = (process.env.DATA_BACKEND ?? 'auto').toLowerCase()
  if (raw === 'azure' || raw === 'r2') return raw
  return 'auto'
}

export function hasAzureDatabaseConfig(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.AZURE_POSTGRES_CONNECTION_STRING)
}

export function getPostgresPool(): Pool {
  if (!hasAzureDatabaseConfig()) {
    throw new Error('Azure PostgreSQL is not configured. Set DATABASE_URL or AZURE_POSTGRES_CONNECTION_STRING.')
  }

  if (!pool) {
    pool = new Pool(buildPoolConfig())
  }

  return pool
}

export async function queryRows<T extends QueryResultRow>(text: string, values?: unknown[]): Promise<T[]> {
  const result = await getPostgresPool().query<T>(text, values)
  return result.rows
}

function buildPoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL?.trim() || process.env.AZURE_POSTGRES_CONNECTION_STRING?.trim()

  if (!connectionString) {
    throw new Error('Missing Azure PostgreSQL connection settings.')
  }

  if (connectionString.includes('://')) {
    return {
      connectionString,
      ssl: shouldEnableSsl(connectionString) ? { rejectUnauthorized: shouldRejectUnauthorized() } : undefined,
      max: getPoolMax(),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: getConnectionTimeoutMillis(),
      allowExitOnIdle: true,
    }
  }

  const params = parseAdoNetConnectionString(connectionString)
  const host = getParam(params, ['server', 'host'])
  const user = getParam(params, ['user id', 'uid', 'user', 'username'])
  const password = getParam(params, ['password', 'pwd'])
  const database = getParam(params, ['database', 'initial catalog']) ?? 'postgres'
  const port = Number(getParam(params, ['port']) ?? '5432')
  const sslMode = (getParam(params, ['ssl mode', 'sslmode']) ?? '').toLowerCase()

  if (!host || !user || !password) {
    throw new Error('Azure PostgreSQL connection string is missing server, user, or password fields.')
  }

  return {
    host,
    user,
    password,
    database,
    port: Number.isFinite(port) ? port : 5432,
    ssl: sslMode === 'require' || shouldEnableSsl(host)
      ? { rejectUnauthorized: shouldRejectUnauthorized() }
      : undefined,
    max: getPoolMax(),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: getConnectionTimeoutMillis(),
    allowExitOnIdle: true,
  }
}

function parseAdoNetConnectionString(value: string): Map<string, string> {
  const result = new Map<string, string>()

  for (const segment of value.split(';')) {
    const trimmed = segment.trim()
    if (!trimmed) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = trimmed.slice(0, separatorIndex).trim().toLowerCase()
    const segmentValue = trimmed.slice(separatorIndex + 1).trim()
    result.set(key, segmentValue)
  }

  return result
}

function getParam(params: Map<string, string>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = params.get(key)
    if (value) return value
  }

  return undefined
}

function shouldEnableSsl(value: string): boolean {
  const normalized = value.toLowerCase()

  if (normalized.includes('sslmode=disable')) return false
  if (normalized.includes('sslmode=require')) return true
  return normalized.includes('.postgres.database.azure.com')
}

function shouldRejectUnauthorized(): boolean {
  return process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
}

function getPoolMax(): number {
  const parsed = Number(process.env.DB_POOL_MAX ?? '4')
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4
}

function getConnectionTimeoutMillis(): number {
  const explicitMs = Number(process.env.DB_CONNECT_TIMEOUT_MS ?? '')
  if (Number.isFinite(explicitMs) && explicitMs > 0) return explicitMs

  const seconds = Number(process.env.DB_CONNECT_TIMEOUT ?? '')
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000

  return 10000
}

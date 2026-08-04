import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173').trim()

function resolveDbHost(): string {
  const host = process.env.DB_HOST
    || process.env.MYSQL_HOST
    || process.env.RAILWAY_MYSQL_HOST
    || 'localhost'

  if (host === 'localhost') {
    return '127.0.0.1'
  }
  return host
}

function getDbPort(): number {
  const p = process.env.DB_PORT
    || process.env.MYSQL_PORT
    || process.env.RAILWAY_MYSQL_PORT
    || '3306'
  return parseInt(p, 10)
}

function getDbUser(): string {
  return process.env.DB_USER
    || process.env.MYSQL_USER
    || process.env.RAILWAY_MYSQL_USER
    || 'root'
}

function getDbPassword(): string {
  return process.env.DB_PASSWORD
    || process.env.MYSQL_PASSWORD
    || process.env.RAILWAY_MYSQL_PASSWORD
    || ''
}

function getDbName(): string {
  return process.env.DB_NAME
    || process.env.MYSQL_DATABASE
    || process.env.RAILWAY_MYSQL_DATABASE
    || 'reaction_rush'
}

const dbConfig = {
  host: resolveDbHost(),
  port: getDbPort(),
  user: getDbUser(),
  password: getDbPassword(),
  database: getDbName()
}

console.log('[Config] DB target:', `${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`)
console.log('[Config] CORS origins:', corsOrigins)

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigins,
  db: dbConfig
}
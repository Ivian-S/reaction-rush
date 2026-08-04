import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env') })

const rawCors = process.env.CORS_ORIGINS || 'http://localhost:5173'

let corsOrigins: string | string[]
if (rawCors === '*') {
  corsOrigins = '*'
} else {
  corsOrigins = rawCors
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  corsOrigins,
  db: {
    host: process.env.DB_HOST || process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306', 10),
    user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'reaction_rush'
  }
}
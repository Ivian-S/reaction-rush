import mysql from 'mysql2/promise'
import { config } from '../config/env.js'

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
})

export async function testConnection(): Promise<boolean> {
  try {
    await pool.getConnection()
    return true
  } catch {
    return false
  }
}

type QueryResultRow = Record<string, unknown>

type SqlValue = string | number | boolean | null | Date | Buffer

export async function query<T = QueryResultRow>(sql: string, params?: SqlValue[]): Promise<T[]> {
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(sql, params)
  return rows as unknown as T[]
}

export async function queryOne<T = QueryResultRow>(sql: string, params?: SqlValue[]): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows.length > 0 ? rows[0] : null
}

export async function execute(sql: string, params?: SqlValue[]): Promise<{ affectedRows: number; insertId: number }> {
  const [result] = await pool.execute<mysql.ResultSetHeader>(sql, params)
  return { affectedRows: result.affectedRows, insertId: result.insertId }
}

export async function withTransaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}
import mysql from 'mysql2/promise'
import { pool } from '../db/pool.js'
import type { LeaderboardEntry } from '../types/index.js'

export async function getAverageLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const sql = `
    SELECT
      p.nickname,
      s.avg_reaction_ms AS averageMs,
      s.fastest_reaction_ms AS fastestMs,
      s.valid_count AS validRounds,
      s.completed_at AS achievedAt
    FROM players p
    JOIN test_sessions s ON s.id = p.best_avg_session_id
    WHERE p.best_avg_session_id IS NOT NULL
      AND s.valid_count >= 3
    ORDER BY
      s.avg_reaction_ms ASC,
      s.fastest_reaction_ms ASC,
      s.completed_at ASC
    LIMIT ${Math.min(limit, 50)}
  `

  const [rows] = await pool.query<mysql.RowDataPacket[]>(sql)
  return rows.map((row, i) => ({
    rank: i + 1,
    nickname: row.nickname as string,
    averageMs: row.averageMs as number,
    fastestMs: row.fastestMs as number,
    validRounds: row.validRounds as number,
    achievedAt: formatDate(row.achievedAt as Date)
  }))
}

export async function getFastestLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const sql = `
    SELECT
      p.nickname,
      s.avg_reaction_ms AS averageMs,
      s.fastest_reaction_ms AS fastestMs,
      s.valid_count AS validRounds,
      s.completed_at AS achievedAt
    FROM players p
    JOIN test_sessions s ON s.id = p.fastest_session_id
    WHERE p.fastest_session_id IS NOT NULL
      AND s.valid_count >= 3
    ORDER BY
      s.fastest_reaction_ms ASC,
      s.avg_reaction_ms ASC,
      s.completed_at ASC
    LIMIT ${Math.min(limit, 50)}
  `

  const [rows] = await pool.query<mysql.RowDataPacket[]>(sql)
  return rows.map((row, i) => ({
    rank: i + 1,
    nickname: row.nickname as string,
    averageMs: row.averageMs as number,
    fastestMs: row.fastestMs as number,
    validRounds: row.validRounds as number,
    achievedAt: formatDate(row.achievedAt as Date)
  }))
}

function formatDate(d: Date): string {
  if (!d) return ''
  return d.toISOString()
}
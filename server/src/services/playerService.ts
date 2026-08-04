import { query, queryOne, execute } from '../db/pool.js'
import type { PlayerRecord } from '../types/index.js'

export async function findPlayerByNicknameKey(key: string): Promise<PlayerRecord | null> {
  return queryOne<PlayerRecord>(
    'SELECT * FROM players WHERE nickname_key = ? LIMIT 1',
    [key]
  )
}

export async function createPlayer(nickname: string, nicknameKey: string): Promise<number> {
  const result = await execute(
    'INSERT INTO players (nickname, nickname_key) VALUES (?, ?)',
    [nickname, nicknameKey]
  )
  return result.insertId
}

export async function getPlayerById(id: number): Promise<PlayerRecord | null> {
  return queryOne<PlayerRecord>('SELECT * FROM players WHERE id = ? LIMIT 1', [id])
}

export async function updatePlayerBestAvg(playerId: number, sessionId: number): Promise<void> {
  await execute(
    'UPDATE players SET best_avg_session_id = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
    [sessionId, playerId]
  )
}

export async function updatePlayerFastest(playerId: number, sessionId: number): Promise<void> {
  await execute(
    'UPDATE players SET fastest_session_id = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
    [sessionId, playerId]
  )
}

export async function updatePlayerBoth(playerId: number, avgSessionId: number, fastestSessionId: number): Promise<void> {
  await execute(
    'UPDATE players SET best_avg_session_id = ?, fastest_session_id = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
    [avgSessionId, fastestSessionId, playerId]
  )
}

export async function getPlayerBestAvg(playerId: number): Promise<{ avg: number | null } | null> {
  return queryOne(
    `SELECT s.avg_reaction_ms AS avg
     FROM players p
     JOIN test_sessions s ON s.id = p.best_avg_session_id
     WHERE p.id = ?`,
    [playerId]
  )
}

export async function getPlayerFastest(playerId: number): Promise<{ fastest: number | null } | null> {
  return queryOne(
    `SELECT s.fastest_reaction_ms AS fastest
     FROM players p
     JOIN test_sessions s ON s.id = p.fastest_session_id
     WHERE p.id = ?`,
    [playerId]
  )
}

export async function setSessionBestFlags(sessionId: number, isBestAvg: boolean, isFastest: boolean): Promise<void> {
  await execute(
    'UPDATE test_sessions SET is_best_avg = ?, is_fastest = ? WHERE id = ?',
    [isBestAvg ? 1 : 0, isFastest ? 1 : 0, sessionId]
  )
}
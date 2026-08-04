import mysql from 'mysql2/promise'
import { query, queryOne, execute, withTransaction } from '../db/pool.js'
import type { RoundInput, RoundRecord, SessionRecord, SubmitResult, SessionInput } from '../types/index.js'
import { findPlayerByNicknameKey, getPlayerBestAvg, getPlayerFastest } from './playerService.js'

export interface ComputedResults {
  avgReactionMs: number | null
  fastestReactionMs: number | null
  slowestReactionMs: number | null
  validCount: number
  earlyCount: number
  timeoutCount: number
  abnormalCount: number
  success: boolean
  reason?: string
}

export function computeResults(rounds: RoundInput[]): ComputedResults {
  if (rounds.length !== 5) {
    return {
      avgReactionMs: null,
      fastestReactionMs: null,
      slowestReactionMs: null,
      validCount: 0,
      earlyCount: 0,
      timeoutCount: 0,
      abnormalCount: 0,
      success: false,
      reason: '必须恰好 5 轮'
    }
  }

  const seen = new Set<number>()
  for (const r of rounds) {
    if (r.roundNumber < 1 || r.roundNumber > 5) {
      return {
        avgReactionMs: null, fastestReactionMs: null, slowestReactionMs: null,
        validCount: 0, earlyCount: 0, timeoutCount: 0, abnormalCount: 0,
        success: false, reason: '轮次必须为 1-5'
      }
    }
    if (seen.has(r.roundNumber)) {
      return {
        avgReactionMs: null, fastestReactionMs: null, slowestReactionMs: null,
        validCount: 0, earlyCount: 0, timeoutCount: 0, abnormalCount: 0,
        success: false, reason: '轮次不能重复'
      }
    }
    seen.add(r.roundNumber)
  }

  let validCount = 0
  let earlyCount = 0
  let timeoutCount = 0
  let abnormalCount = 0
  const validReactions: number[] = []

  for (const r of rounds) {
    switch (r.resultType) {
      case 'success':
        if (r.reactionMs >= 50 && r.reactionMs <= 3000) {
          validCount++
          validReactions.push(r.reactionMs)
        } else if (r.reactionMs < 50) {
          abnormalCount++
        } else {
          earlyCount++
        }
        break
      case 'early':
        earlyCount++
        break
      case 'timeout':
        timeoutCount++
        break
      case 'abnormal':
        abnormalCount++
        break
    }
  }

  const avg = validReactions.length > 0
    ? Math.round(validReactions.reduce((a, b) => a + b, 0) / validReactions.length)
    : null
  const fastest = validReactions.length > 0 ? Math.min(...validReactions) : null
  const slowest = validReactions.length > 0 ? Math.max(...validReactions) : null

  return {
    avgReactionMs: avg,
    fastestReactionMs: fastest,
    slowestReactionMs: slowest,
    validCount,
    earlyCount,
    timeoutCount,
    abnormalCount,
    success: true
  }
}

export async function checkSessionExists(clientSessionId: string): Promise<boolean> {
  const row = await queryOne<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM test_sessions WHERE client_session_id = ?',
    [clientSessionId]
  )
  return (row?.cnt ?? 0) > 0
}

export async function getSessionById(clientSessionId: string): Promise<SessionRecord | null> {
  return queryOne<SessionRecord>(
    'SELECT * FROM test_sessions WHERE client_session_id = ?',
    [clientSessionId]
  )
}

export async function submitSession(input: SessionInput): Promise<SubmitResult> {
  const { sessionId, nickname, confirmedExistingNickname, rounds } = input

  if (!sessionId || sessionId.trim().length === 0) {
    return { saved: false, code: 'BAD_REQUEST', message: 'sessionId 不能为空' }
  }

  const existing = await checkSessionExists(sessionId)
  if (existing) {
    const saved = await getSessionById(sessionId)
    if (saved) {
      return {
        saved: true,
        code: 'DUPLICATE_SESSION',
        message: '该 sessionId 已提交，返回已有结果',
        data: {
          sessionId,
          isBestAvg: saved.isBestAvg,
          isFastest: saved.isFastest,
          averageMs: saved.avgReactionMs ?? 0,
          fastestMs: saved.fastestReactionMs ?? 0
        }
      }
    }
    return { saved: false, code: 'DUPLICATE_SESSION', message: '重复 sessionId' }
  }

  const computed = computeResults(rounds)
  if (!computed.success) {
    return { saved: false, code: 'BAD_REQUEST', message: computed.reason ?? '成绩数据无效' }
  }

  if (computed.validCount < 3) {
    return { saved: false, code: 'NOT_QUALIFIED', message: '有效成绩不足 3 轮，不保存' }
  }

  const player = await findPlayerByNicknameKey(nickname.toLowerCase())

  if (!player) {
    return saveNewPlayerAndSession(sessionId, nickname, computed, rounds)
  }

  if (!confirmedExistingNickname) {
    const existingSession = await getSessionById(sessionId)
    if (!existingSession) {
      return {
        saved: false,
        code: 'NICKNAME_CONFIRM_REQUIRED',
        message: '该昵称已存在，是否继续使用并挑战原纪录？'
      }
    }
  }

  const bestAvg = await getPlayerBestAvg(player.id)
  const fastest = await getPlayerFastest(player.id)

  const hasNoBest = !bestAvg?.avg
  const hasNoFastest = !fastest?.fastest

  const avgImproved = hasNoBest || (computed.avgReactionMs! < bestAvg!.avg!)
  const fastestImproved = hasNoFastest || (computed.fastestReactionMs! < fastest!.fastest!)

  if (!avgImproved && !fastestImproved) {
    return {
      saved: false,
      code: 'NO_PERSONAL_BEST',
      message: '未刷新个人纪录，成绩仅在本地显示'
    }
  }

  return saveWithExistingPlayer(sessionId, player.id, computed, rounds, avgImproved, fastestImproved)
}

async function saveNewPlayerAndSession(
  sessionId: string,
  nickname: string,
  computed: ComputedResults,
  rounds: RoundInput[]
): Promise<SubmitResult> {
  return withTransaction(async (conn) => {
    const [playerResult] = await conn.execute(
      'INSERT INTO players (nickname, nickname_key) VALUES (?, ?)',
      [nickname, nickname.toLowerCase()]
    )
    const playerId = (playerResult as mysql.ResultSetHeader).insertId

    const [sessionResult] = await conn.execute(
      `INSERT INTO test_sessions
        (client_session_id, player_id, avg_reaction_ms, fastest_reaction_ms, slowest_reaction_ms,
         valid_count, early_count, timeout_count, abnormal_count, completed_at, is_best_avg, is_fastest)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), 1, 1)`,
      [
        sessionId, playerId,
        computed.avgReactionMs, computed.fastestReactionMs, computed.slowestReactionMs,
        computed.validCount, computed.earlyCount, computed.timeoutCount, computed.abnormalCount
      ]
    )
    const sessionDbId = (sessionResult as mysql.ResultSetHeader).insertId

    await saveRounds(conn, sessionDbId, rounds)

    await conn.execute(
      'UPDATE players SET best_avg_session_id = ?, fastest_session_id = ? WHERE id = ?',
      [sessionDbId, sessionDbId, playerId]
    )

    return {
      saved: true,
      code: 'SAVED',
      message: '新玩家，成绩已保存',
      data: {
        sessionId,
        isBestAvg: true,
        isFastest: true,
        averageMs: computed.avgReactionMs!,
        fastestMs: computed.fastestReactionMs!
      }
    }
  })
}

async function saveWithExistingPlayer(
  sessionId: string,
  playerId: number,
  computed: ComputedResults,
  rounds: RoundInput[],
  avgImproved: boolean,
  fastestImproved: boolean
): Promise<SubmitResult> {
  return withTransaction(async (conn) => {
    const [sessionResult] = await conn.execute(
      `INSERT INTO test_sessions
        (client_session_id, player_id, avg_reaction_ms, fastest_reaction_ms, slowest_reaction_ms,
         valid_count, early_count, timeout_count, abnormal_count, completed_at, is_best_avg, is_fastest)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3), ?, ?)`,
      [
        sessionId, playerId,
        computed.avgReactionMs, computed.fastestReactionMs, computed.slowestReactionMs,
        computed.validCount, computed.earlyCount, computed.timeoutCount, computed.abnormalCount,
        avgImproved ? 1 : 0, fastestImproved ? 1 : 0
      ]
    )
    const sessionDbId = (sessionResult as mysql.ResultSetHeader).insertId

    await saveRounds(conn, sessionDbId, rounds)

    if (avgImproved && fastestImproved) {
      await conn.execute(
        'UPDATE players SET best_avg_session_id = ?, fastest_session_id = ? WHERE id = ?',
        [sessionDbId, sessionDbId, playerId]
      )
    } else if (avgImproved) {
      await conn.execute(
        'UPDATE players SET best_avg_session_id = ? WHERE id = ?',
        [sessionDbId, playerId]
      )
    } else if (fastestImproved) {
      await conn.execute(
        'UPDATE players SET fastest_session_id = ? WHERE id = ?',
        [sessionDbId, playerId]
      )
    }

    return {
      saved: true,
      code: 'SAVED',
      message: avgImproved && fastestImproved
        ? '成绩已保存，刷新了平均和最快纪录'
        : avgImproved
          ? '成绩已保存，刷新了平均纪录'
          : '成绩已保存，刷新了最快纪录',
      data: {
        sessionId,
        isBestAvg: avgImproved,
        isFastest: fastestImproved,
        averageMs: computed.avgReactionMs!,
        fastestMs: computed.fastestReactionMs!
      }
    }
  })
}

function toMySQLDateTime(isoString: string): string {
  const d = new Date(isoString)
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${isoString}`)
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const sec = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${y}-${m}-${day} ${h}:${min}:${sec}.${ms}`
}

async function saveRounds(conn: mysql.PoolConnection, sessionDbId: number, rounds: RoundInput[]): Promise<void> {
  for (const r of rounds) {
    await conn.execute(
      `INSERT INTO test_rounds (session_id, round_number, result, reaction_ms, wait_duration_ms, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        sessionDbId,
        r.roundNumber,
        r.resultType,
        r.resultType === 'success' ? r.reactionMs : null,
        r.waitDurationMs,
        toMySQLDateTime(r.occurredAt)
      ]
    )
  }
}
import { Router } from 'express'
import { ok, fail, ErrorCode } from '../types/index.js'
import { getAverageLeaderboard, getFastestLeaderboard } from '../services/leaderboardService.js'
import { pool } from '../db/pool.js'

const router = Router()

const CLEAR_PASSWORD = process.env.CLEAR_PASSWORD || '951947'

router.get('/average', async (_req, res) => {
  try {
    const entries = await getAverageLeaderboard(10)
    return res.json(ok(entries))
  } catch {
    return res.json(fail(ErrorCode.DATABASE_UNAVAILABLE, '排行榜暂时不可用'))
  }
})

router.get('/fastest', async (_req, res) => {
  try {
    const entries = await getFastestLeaderboard(10)
    return res.json(ok(entries))
  } catch {
    return res.json(fail(ErrorCode.DATABASE_UNAVAILABLE, '排行榜暂时不可用'))
  }
})

router.delete('/clear', async (req, res) => {
  try {
    const { password } = req.body as { password?: string }

    if (!password || password !== CLEAR_PASSWORD) {
      return res.json(fail(ErrorCode.UNAUTHORIZED, '密码错误，无法清空数据'))
    }

    await pool.query('SET FOREIGN_KEY_CHECKS = 0')
    await pool.query('TRUNCATE TABLE test_rounds')
    await pool.query('TRUNCATE TABLE test_sessions')
    await pool.query('TRUNCATE TABLE players')
    await pool.query('SET FOREIGN_KEY_CHECKS = 1')
    return res.json(ok({ cleared: true }, '排行榜数据已清空'))
  } catch {
    return res.json(fail(ErrorCode.DATABASE_UNAVAILABLE, '清空失败，请稍后重试'))
  }
})

export default router
import { Router } from 'express'
import { ok, fail, ErrorCode } from '../types/index.js'
import { submitSession, computeResults } from '../services/sessionService.js'
import { validateNickname } from '../utils/nickname.js'
import type { RoundInput } from '../types/index.js'

const router = Router()

router.post('/', async (req, res) => {
  try {
    const { sessionId, nickname, confirmedExistingNickname, rounds } = req.body

    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return res.json(fail(ErrorCode.BAD_REQUEST, 'sessionId 不能为空'))
    }

    if (!nickname || typeof nickname !== 'string') {
      return res.json(fail(ErrorCode.BAD_REQUEST, '昵称不能为空'))
    }

    const validation = validateNickname(nickname)
    if (!validation.valid) {
      return res.json(fail(ErrorCode.INVALID_NICKNAME, validation.error!))
    }

    if (!Array.isArray(rounds)) {
      return res.json(fail(ErrorCode.BAD_REQUEST, 'rounds 必须是数组'))
    }

    const typedRounds: RoundInput[] = rounds.map((r: Record<string, unknown>) => {
      const rawType = r.resultType as string
      const resultType: RoundInput['resultType'] =
        rawType === 'success' || rawType === 'early' || rawType === 'timeout' || rawType === 'abnormal'
          ? rawType
          : 'success'
      return {
        roundNumber: Number(r.roundNumber),
        resultType,
        reactionMs: Number((r.reactionMs as number) ?? 0),
        waitDurationMs: Number((r.waitDurationMs as number) ?? 0),
        occurredAt: (r.occurredAt as string) ?? new Date().toISOString()
      }
    })

    const computed = computeResults(typedRounds)
    if (!computed.success) {
      return res.json(fail(ErrorCode.BAD_REQUEST, computed.reason ?? '成绩数据无效'))
    }

    const result = await submitSession({
      sessionId: sessionId.trim(),
      nickname: validation.nickname,
      confirmedExistingNickname: !!confirmedExistingNickname,
      rounds: typedRounds
    })

    if (result.saved) {
      if (result.code === 'DUPLICATE_SESSION') {
        return res.json({
          success: true,
          code: result.code,
          message: result.message,
          data: result.data
        })
      }
      return res.json(ok(result.data ?? {}, result.message))
    }

    return res.json(fail(result.code, result.message))
  } catch (error: unknown) {
    console.error('[Sessions] Error:', error)
    const err = error as { message?: string; code?: string }
    const msg = err?.message ?? ''
    const code = err?.code ?? ''
    if (msg.includes('Duplicate entry') || code === 'ER_DUP_ENTRY') {
      return res.json(fail(ErrorCode.DUPLICATE_SESSION, '重复 sessionId，数据已存在'))
    }
    if (msg.includes('ER_TRUNCATED_WRONG_VALUE') || msg.includes('Incorrect datetime')) {
      return res.json(fail(ErrorCode.BAD_REQUEST, '日期格式无效'))
    }
    if (msg.includes('ER_NO_REFERENCED_ROW') || msg.includes('foreign key')) {
      return res.json(fail(ErrorCode.DATABASE_UNAVAILABLE, '数据一致性错误'))
    }
    return res.json(fail(ErrorCode.INTERNAL_ERROR, msg || '服务器内部错误'))
  }
})

export default router
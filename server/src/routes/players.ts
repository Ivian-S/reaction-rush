import { Router } from 'express'
import { ok, fail, ErrorCode } from '../types/index.js'
import { findPlayerByNicknameKey } from '../services/playerService.js'
import { validateNickname } from '../utils/nickname.js'

const router = Router()

router.get('/exists', async (req, res) => {
  try {
    const raw = req.query.nickname as string
    if (!raw || raw.trim().length === 0) {
      return res.json(fail(ErrorCode.BAD_REQUEST, '昵称参数不能为空'))
    }

    const validation = validateNickname(raw)
    if (!validation.valid) {
      return res.json(fail(ErrorCode.INVALID_NICKNAME, validation.error!))
    }

    const player = await findPlayerByNicknameKey(validation.key)
    return res.json(ok({
      exists: !!player,
      nickname: validation.nickname
    }))
  } catch {
    return res.json(fail(ErrorCode.DATABASE_UNAVAILABLE, '数据库不可用'))
  }
})

export default router
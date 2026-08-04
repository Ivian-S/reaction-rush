export interface ApiResponse<T = unknown> {
  success: boolean
  code: string
  message: string
  data?: T
}

export function ok<T>(data: T, message = 'OK'): ApiResponse<T> {
  return { success: true, code: 'OK', message, data }
}

export function fail(code: string, message: string): ApiResponse<null> {
  return { success: false, code, message }
}

export const ErrorCode = {
  BAD_REQUEST: 'BAD_REQUEST',
  INVALID_NICKNAME: 'INVALID_NICKNAME',
  NICKNAME_CONFIRM_REQUIRED: 'NICKNAME_CONFIRM_REQUIRED',
  DUPLICATE_SESSION: 'DUPLICATE_SESSION',
  NOT_QUALIFIED: 'NOT_QUALIFIED',
  NO_PERSONAL_BEST: 'NO_PERSONAL_BEST',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED'
} as const

export type RoundResult = 'success' | 'early' | 'timeout' | 'abnormal'

export interface RoundInput {
  roundNumber: number
  resultType: RoundResult
  reactionMs: number
  waitDurationMs: number
  occurredAt: string
}

export interface SessionInput {
  sessionId: string
  nickname: string
  confirmedExistingNickname?: boolean
  rounds: RoundInput[]
}

export interface RoundRecord {
  id: number
  sessionId: number
  roundNumber: number
  result: RoundResult
  reactionMs: number | null
  waitDurationMs: number
  occurredAt: Date
}

export interface SessionRecord {
  id: number
  clientSessionId: string
  playerId: number
  avgReactionMs: number | null
  fastestReactionMs: number | null
  slowestReactionMs: number | null
  validCount: number
  earlyCount: number
  timeoutCount: number
  abnormalCount: number
  completedAt: Date
  isBestAvg: boolean
  isFastest: boolean
}

export interface PlayerRecord {
  id: number
  nickname: string
  nicknameKey: string
  bestAvgSessionId: number | null
  fastestSessionId: number | null
  createdAt: Date
  updatedAt: Date
}

export interface LeaderboardEntry {
  rank: number
  nickname: string
  averageMs: number
  fastestMs: number
  validRounds: number
  achievedAt: string
}

export interface SubmitResult {
  saved: boolean
  code: string
  message: string
  data?: {
    sessionId: string
    isBestAvg: boolean
    isFastest: boolean
    averageMs: number
    fastestMs: number
  }
}
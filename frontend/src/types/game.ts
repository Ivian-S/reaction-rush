export type GameState =
  | 'ready'
  | 'waiting'
  | 'target'
  | 'success'
  | 'early'
  | 'timeout'
  | 'abnormal'
  | 'completed'

export interface RoundData {
  roundNumber: number
  resultType: 'success' | 'early' | 'timeout' | 'abnormal'
  reactionMs: number | null
  waitMs: number
  occurredAt: string
}

export interface GameSessionData {
  sessionId: string
  nickname: string
  confirmedExistingNickname: boolean
  rounds: RoundData[]
  currentRound: number
  isActive: boolean
  isComplete: boolean
}

export interface SessionSubmitData {
  sessionId: string
  nickname: string
  confirmedExistingNickname: boolean
  rounds: {
    roundNumber: number
    resultType: 'success' | 'early' | 'timeout' | 'abnormal'
    reactionMs: number
    waitDurationMs: number
    occurredAt: string
  }[]
}

export interface ApiResponse<T = unknown> {
  success: boolean
  code: string
  message: string
  data?: T
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
  success: boolean
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
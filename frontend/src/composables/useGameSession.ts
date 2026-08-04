import { ref, reactive } from 'vue'
import type { RoundData, GameSessionData } from '@/types/game'

const session = reactive<GameSessionData>({
  sessionId: '',
  nickname: '',
  confirmedExistingNickname: false,
  rounds: [],
  currentRound: 0,
  isActive: false,
  isComplete: false
})

const results = ref<RoundData[]>([])

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 's-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8)
}

function startGame(nickname: string, confirmedExisting = false) {
  session.sessionId = createSessionId()
  session.nickname = nickname
  session.confirmedExistingNickname = confirmedExisting
  session.rounds = []
  session.currentRound = 0
  session.isActive = true
  session.isComplete = false
  results.value = []
}

function finishRound(round: RoundData) {
  session.rounds.push(round)
  session.currentRound = session.rounds.length
}

function completeGame() {
  session.isActive = false
  session.isComplete = true
  results.value = [...session.rounds]
}

function resetSession() {
  session.sessionId = ''
  session.nickname = ''
  session.confirmedExistingNickname = false
  session.rounds = []
  session.currentRound = 0
  session.isActive = false
  session.isComplete = false
  results.value = []
}

function resetWithNickname() {
  const nickname = session.nickname
  const confirmed = session.confirmedExistingNickname
  session.sessionId = createSessionId()
  session.nickname = nickname
  session.confirmedExistingNickname = confirmed
  session.rounds = []
  session.currentRound = 0
  session.isActive = true
  session.isComplete = false
  results.value = []
}

function hasValidState(): boolean {
  return session.isActive || session.isComplete
}

export function useGameSession() {
  return {
    session,
    results,
    startGame,
    finishRound,
    completeGame,
    resetSession,
    resetWithNickname,
    hasValidState
  }
}
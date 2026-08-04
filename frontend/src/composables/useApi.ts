import { ref, computed } from 'vue'
import type { ApiResponse, LeaderboardEntry, SubmitResult } from '@/types/game'

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '/api'
export const API_BASE_URL = rawBaseUrl.replace(/\/$/, '')

export function createApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

const serverStatus = ref<'checking' | 'online' | 'offline'>('checking')
const leaderboardAvg = ref<LeaderboardEntry[]>([])
const leaderboardFastest = ref<LeaderboardEntry[]>([])
const leaderboardLoading = ref(false)
const leaderboardError = ref<string | null>(null)

const hasLeaderboardData = computed(() =>
  leaderboardAvg.value.length > 0 || leaderboardFastest.value.length > 0
)

const isLeaderboardEmpty = computed(() =>
  !leaderboardLoading.value &&
  !leaderboardError.value &&
  leaderboardAvg.value.length === 0 &&
  leaderboardFastest.value.length === 0
)

const historyFastest = computed<LeaderboardEntry | null>(() => {
  if (leaderboardFastest.value.length === 0) return null
  return leaderboardFastest.value[0]
})

async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await fetch(createApiUrl('/health'))
    serverStatus.value = res.ok ? 'online' : 'offline'
    return res.ok
  } catch {
    serverStatus.value = 'offline'
    return false
  }
}

async function checkNickname(nickname: string): Promise<{ exists: boolean; nickname: string } | null> {
  try {
    const res = await fetch(createApiUrl(`/players/exists?nickname=${encodeURIComponent(nickname)}`))
    const data: ApiResponse = await res.json()
    if (data.success && data.data) {
      return data.data as { exists: boolean; nickname: string }
    }
    return null
  } catch {
    return null
  }
}

async function submitSession(payload: unknown): Promise<SubmitResult | null> {
  try {
    const res = await fetch(createApiUrl('/sessions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data: ApiResponse = await res.json()
    return {
      success: data.success,
      code: data.code,
      message: data.message,
      data: data.data as SubmitResult['data']
    }
  } catch {
    return null
  }
}

async function fetchLeaderboard(
  type: 'average' | 'fastest',
  limit = 10
): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(createApiUrl(`/leaderboard/${type}?limit=${limit}`))
    const data: ApiResponse = await res.json()
    if (data.success && data.data) {
      return data.data as LeaderboardEntry[]
    }
    return []
  } catch {
    return []
  }
}

async function loadLeaderboards(): Promise<void> {
  if (serverStatus.value === 'offline') {
    leaderboardError.value = '服务器离线'
    return
  }

  leaderboardLoading.value = true
  leaderboardError.value = null

  try {
    const [avg, fastest] = await Promise.all([
      fetchLeaderboard('average'),
      fetchLeaderboard('fastest')
    ])

    leaderboardAvg.value = avg
    leaderboardFastest.value = fastest
  } catch {
    leaderboardError.value = '排行榜加载失败'
  } finally {
    leaderboardLoading.value = false
  }
}

async function clearAllData(): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(createApiUrl('/leaderboard/clear'), {
      method: 'DELETE'
    })
    const data: ApiResponse = await res.json()
    if (data.success) {
      leaderboardAvg.value = []
      leaderboardFastest.value = []
      return { success: true, message: data.message }
    }
    return { success: false, message: data.message }
  } catch {
    return { success: false, message: '网络错误，清空失败' }
  }
}

export function useApi() {
  return {
    serverStatus,
    leaderboardAvg,
    leaderboardFastest,
    leaderboardLoading,
    leaderboardError,
    hasLeaderboardData,
    isLeaderboardEmpty,
    historyFastest,
    checkServerHealth,
    checkNickname,
    submitSession,
    loadLeaderboards,
    clearAllData
  }
}
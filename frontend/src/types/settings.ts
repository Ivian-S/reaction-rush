export interface ThemeColors {
  primary: string
  initial: string
  waiting: string
  clickable: string
  early: string
  timeout: string
  complete: string
}

export interface Theme {
  id: string
  name: string
  colors: ThemeColors
  isCustom: boolean
}

export interface AppSettings {
  activeThemeId: string
  customColors: ThemeColors
  soundEnabled: boolean
  vibrationEnabled: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  activeThemeId: 'dark-neon',
  customColors: {
    primary: '#00d4ff',
    initial: '#ff3333',
    waiting: '#ff4444',
    clickable: '#00ff88',
    early: '#ff6644',
    timeout: '#ff8800',
    complete: '#00d4ff'
  },
  soundEnabled: true,
  vibrationEnabled: true
}

export const PRESET_THEMES: Theme[] = [
  {
    id: 'dark-neon',
    name: '深色霓虹电竞',
    isCustom: false,
    colors: {
      primary: '#00d4ff',
      initial: '#ff3333',
      waiting: '#ff4444',
      clickable: '#00ff88',
      early: '#ff6644',
      timeout: '#ff8800',
      complete: '#00d4ff'
    }
  },
  {
    id: 'light-minimal',
    name: '浅色简约现代',
    isCustom: false,
    colors: {
      primary: '#2563eb',
      initial: '#ef4444',
      waiting: '#dc2626',
      clickable: '#22c55e',
      early: '#f97316',
      timeout: '#f59e0b',
      complete: '#2563eb'
    }
  },
  {
    id: 'deep-tech',
    name: '深蓝紫科技',
    isCustom: false,
    colors: {
      primary: '#8b5cf6',
      initial: '#f43f5e',
      waiting: '#e11d48',
      clickable: '#10b981',
      early: '#fb923c',
      timeout: '#f59e0b',
      complete: '#8b5cf6'
    }
  },
  {
    id: 'bright-game',
    name: '明亮活泼游戏',
    isCustom: false,
    colors: {
      primary: '#ec4899',
      initial: '#ef4444',
      waiting: '#f87171',
      clickable: '#34d399',
      early: '#fb923c',
      timeout: '#fbbf24',
      complete: '#ec4899'
    }
  }
]

export const THEME_STORAGE_KEY = 'reaction-rush-settings'
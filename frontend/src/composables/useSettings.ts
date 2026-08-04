import { ref, reactive, watch } from 'vue'
import type { AppSettings, Theme, ThemeColors } from '@/types/settings'
import { DEFAULT_SETTINGS, PRESET_THEMES, THEME_STORAGE_KEY } from '@/types/settings'

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch {}
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings))
}

function applyThemeToCSS(theme: ThemeColors) {
  const root = document.documentElement
  root.style.setProperty('--color-primary', theme.primary)
  root.style.setProperty('--color-initial', theme.initial)
  root.style.setProperty('--color-waiting', theme.waiting)
  root.style.setProperty('--color-clickable', theme.clickable)
  root.style.setProperty('--color-early', theme.early)
  root.style.setProperty('--color-timeout', theme.timeout)
  root.style.setProperty('--color-complete', theme.complete)

  const bg = theme.initial
  const luminance = getLuminance(bg)
  root.style.setProperty('--color-bg', luminance > 0.5 ? '#f8fafc' : '#0a0e1a')
  root.style.setProperty('--color-surface', luminance > 0.5 ? '#ffffff' : '#131828')
  root.style.setProperty('--color-text', luminance > 0.5 ? '#1e293b' : '#ffffff')
  root.style.setProperty('--color-text-secondary', luminance > 0.5 ? '#64748b' : 'rgba(255,255,255,0.65)')
  root.style.setProperty('--color-success', theme.clickable)
  root.style.setProperty('--color-warning', theme.timeout)
  root.style.setProperty('--color-danger', theme.early)
}

function getLuminance(hex: string): number {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function getContrastColor(hex: string): string {
  return getLuminance(hex) > 0.5 ? '#000000' : '#ffffff'
}

const settings = reactive<AppSettings>(loadSettings())
const activeThemeId = ref(settings.activeThemeId)
const isThemeLoaded = ref(false)

function getActiveTheme(): Theme {
  if (activeThemeId.value === 'custom') {
    return {
      id: 'custom',
      name: '自定义主题',
      isCustom: true,
      colors: settings.customColors
    }
  }
  return PRESET_THEMES.find(t => t.id === activeThemeId.value) || PRESET_THEMES[0]
}

function setTheme(themeId: string) {
  activeThemeId.value = themeId
  settings.activeThemeId = themeId
  const theme = getActiveTheme()
  applyThemeToCSS(theme.colors)
  saveSettings(settings)
}

function setCustomColor(key: keyof ThemeColors, value: string) {
  settings.customColors[key] = value
  if (activeThemeId.value === 'custom') {
    applyThemeToCSS(settings.customColors)
  }
  saveSettings(settings)
}

function toggleSound() {
  settings.soundEnabled = !settings.soundEnabled
  saveSettings(settings)
}

function toggleVibration() {
  settings.vibrationEnabled = !settings.vibrationEnabled
  saveSettings(settings)
}

function resetToDefaults() {
  Object.assign(settings, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)))
  activeThemeId.value = settings.activeThemeId
  applyThemeToCSS(settings.customColors)
  saveSettings(settings)
}

watch(settings, () => {
  saveSettings(settings)
}, { deep: true })

export function useSettings() {
  if (!isThemeLoaded.value) {
    const theme = getActiveTheme()
    applyThemeToCSS(theme.colors)
    isThemeLoaded.value = true
  }

  return {
    settings,
    activeThemeId,
    isThemeLoaded,
    presetThemes: PRESET_THEMES,
    activeTheme: getActiveTheme(),
    getActiveTheme,
    setTheme,
    setCustomColor,
    toggleSound,
    toggleVibration,
    resetToDefaults,
    getContrastColor
  }
}
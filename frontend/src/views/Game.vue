<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameSession } from '@/composables/useGameSession'
import { useSettings } from '@/composables/useSettings'
import type { GameState, RoundData } from '@/types/game'

const router = useRouter()
const gameSession = useGameSession()
const { settings } = useSettings()

const MAX_ROUNDS = 5
const TARGET_TIMEOUT = 3000
const FEEDBACK_DURATION = 1000

const gameState = ref<GameState>('ready')
const roundIndex = ref(0)
const displayReaction = ref<number | null>(null)
const displayResultType = ref<'success' | 'early' | 'timeout' | 'abnormal' | ''>('')
const audioReady = ref(false)

let waitTimer: ReturnType<typeof setTimeout> | null = null
let timeoutTimer: ReturnType<typeof setTimeout> | null = null
let nextRoundTimer: ReturnType<typeof setTimeout> | null = null
let rafId: number | null = null
let rafStartTime: number = 0
let audioCtx: AudioContext | null = null
let currentWaitMs: number = 0
let isInputLocked: boolean = false
let activeOsc: OscillatorNode | null = null

const currentRoundDisplay = computed(() => roundIndex.value + 1)
const progressPercent = computed(() => (roundIndex.value / MAX_ROUNDS) * 100)

onMounted(() => {
  enterReady()
  window.addEventListener('keydown', handleKeyDown)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('modal-opening', handleModalChange)
})

onUnmounted(() => {
  cleanupAll()
  window.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  document.removeEventListener('modal-opening', handleModalChange)
})

function handleModalChange(e: Event) {
  isInputLocked = (e as CustomEvent).detail === true
}

function handleVisibilityChange() {
  if (document.hidden) {
    clearTimers()
    if (gameState.value === 'waiting' || gameState.value === 'target') {
      enterReady()
    }
  }
}

function cleanupAll() {
  if (waitTimer !== null) { clearTimeout(waitTimer); waitTimer = null }
  if (timeoutTimer !== null) { clearTimeout(timeoutTimer); timeoutTimer = null }
  if (nextRoundTimer !== null) { clearTimeout(nextRoundTimer); nextRoundTimer = null }
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
  stopActiveSound()
  if (audioCtx !== null) { audioCtx.close().catch(() => {}); audioCtx = null }
  audioReady.value = false
  isInputLocked = false
}

function clearTimers() {
  if (waitTimer !== null) { clearTimeout(waitTimer); waitTimer = null }
  if (timeoutTimer !== null) { clearTimeout(timeoutTimer); timeoutTimer = null }
  if (nextRoundTimer !== null) { clearTimeout(nextRoundTimer); nextRoundTimer = null }
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
}

function enterReady() {
  clearTimers()
  isInputLocked = false
  gameState.value = 'ready'
  displayReaction.value = null
  displayResultType.value = ''
}

function startWaiting() {
  clearTimers()
  gameState.value = 'waiting'
  isInputLocked = false
  currentWaitMs = 2000 + Math.random() * 3000

  waitTimer = setTimeout(() => {
    enterTarget()
  }, currentWaitMs)
}

function enterTarget() {
  clearTimers()
  gameState.value = 'target'

  if (settings.soundEnabled) {
    playTargetSound()
  }
  if (settings.vibrationEnabled) {
    try { navigator.vibrate(20) } catch {}
  }

  rafStartTime = 0
  rafId = requestAnimationFrame(() => {
    rafStartTime = performance.now()
  })

  timeoutTimer = setTimeout(() => {
    handleTimeout()
  }, TARGET_TIMEOUT)
}

function handleInput() {
  if (isInputLocked) return

  switch (gameState.value) {
    case 'ready':
      startWaiting()
      break
    case 'waiting':
      handleEarly()
      break
    case 'target':
      handleSuccess()
      break
    default:
      break
  }
}

function handleSuccess() {
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }

  if (rafStartTime === 0) {
    handleEarly()
    return
  }

  const reaction = Math.max(0, Math.round(performance.now() - rafStartTime))

  if (reaction < 50) {
    handleAbnormal(reaction)
    return
  }

  clearTimers()
  isInputLocked = true
  gameState.value = 'success'
  displayReaction.value = reaction
  displayResultType.value = 'success'

  if (settings.vibrationEnabled) {
    try { navigator.vibrate(30) } catch {}
  }

  recordRound('success', reaction)
}

function handleEarly() {
  clearTimers()
  isInputLocked = true
  gameState.value = 'early'
  displayReaction.value = 0
  displayResultType.value = 'early'

  if (settings.vibrationEnabled) {
    try { navigator.vibrate([20, 40, 20]) } catch {}
  }

  recordRound('early', null)
}

function handleTimeout() {
  clearTimers()
  isInputLocked = true
  gameState.value = 'timeout'
  displayReaction.value = null
  displayResultType.value = 'timeout'

  if (settings.vibrationEnabled) {
    try { navigator.vibrate([100, 50, 100]) } catch {}
  }

  recordRound('timeout', null)
}

function handleAbnormal(reaction: number) {
  clearTimers()
  isInputLocked = true
  gameState.value = 'abnormal'
  displayReaction.value = reaction
  displayResultType.value = 'abnormal'

  if (settings.vibrationEnabled) {
    try { navigator.vibrate(50) } catch {}
  }

  recordRound('abnormal', reaction)
}

function recordRound(resultType: RoundData['resultType'], reactionMs: number | null) {
  const round: RoundData = {
    roundNumber: roundIndex.value + 1,
    resultType,
    reactionMs,
    waitMs: currentWaitMs,
    occurredAt: new Date().toISOString()
  }

  gameSession.finishRound(round)
  roundIndex.value++

  nextRoundTimer = setTimeout(() => {
    if (roundIndex.value >= MAX_ROUNDS) {
      completeGame()
    } else {
      startWaiting()
    }
  }, FEEDBACK_DURATION)
}

function completeGame() {
  clearTimers()
  stopActiveSound()
  gameState.value = 'completed'
  gameSession.completeGame()
  router.push('/result')
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.code !== 'Space') return
  if (e.repeat) return
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('[contenteditable]')) return
  if (isModalOpen()) return
  e.preventDefault()
  handleInput()
}

function isModalOpen(): boolean {
  const overlays = document.querySelectorAll('.modal-overlay')
  for (const overlay of overlays) {
    const style = window.getComputedStyle(overlay)
    if (style.display !== 'none' && style.visibility !== 'hidden') {
      return true
    }
  }
  return false
}

function handlePointerDown(e: PointerEvent) {
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('[contenteditable]')) return
  if (isModalOpen()) return
  handleInput()
}

function ensureAudioContext() {
  if (audioCtx) return audioCtx
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new AC()
    audioReady.value = true
  } catch {
    audioCtx = null
  }
  return audioCtx
}

function stopActiveSound() {
  if (activeOsc) {
    try { activeOsc.stop() } catch {}
    activeOsc.disconnect()
    activeOsc = null
  }
}

function playTargetSound() {
  const ctx = ensureAudioContext()
  if (!ctx) return

  stopActiveSound()

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.setValueAtTime(880, ctx.currentTime)
  gain.gain.setValueAtTime(0.25, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.12)
  activeOsc = osc
}

function getStateClass() {
  return `state-${gameState.value}`
}

function getRoundDotClass(index: number): string {
  const round = gameSession.session.rounds[index]
  if (!round) return ''
  return round.resultType
}

function getStateText(state: GameState) {
  switch (state) {
    case 'ready':
      return { icon: '🎯', label: '点击开始', hint: `点击屏幕或按空格键开始第 ${roundIndex.value + 1} 轮` }
    case 'waiting':
      return { icon: '⏳', label: '等待变绿', hint: '看到绿色立即点击，过早会判为失误' }
    case 'target':
      return { icon: '⚡', label: '点击！', hint: '越快越好，点击！' }
    case 'success':
      return { icon: '✨', label: `${displayReaction.value ?? 0} ms`, hint: '有效成绩' }
    case 'early':
      return { icon: '❌', label: '过早反应', hint: '这轮不计入有效成绩' }
    case 'timeout':
      return { icon: '⏰', label: '超时', hint: '3 秒内未点击' }
    case 'abnormal':
      return { icon: '⚠️', label: `${displayReaction.value ?? 0} ms`, hint: '异常成绩（<50ms）' }
    case 'completed':
      return { icon: '🎉', label: '完成', hint: '正在跳转...' }
    default:
      return { icon: '?', label: '?', hint: '' }
  }
}

const currentStateDisplay = computed(() => getStateText(gameState.value))

watch(() => settings.soundEnabled, (enabled) => {
  if (!enabled) {
    stopActiveSound()
  }
})
</script>

<template>
  <div class="game-page" role="application" aria-label="反应力测试游戏">
    <header class="game-header">
      <div class="player-info">
        <span class="player-label">玩家</span>
        <span class="player-name">{{ gameSession.session.nickname }}</span>
      </div>
      <div class="round-info">
        <span class="round-label">轮次</span>
        <span class="round-value">{{ currentRoundDisplay }} / {{ MAX_ROUNDS }}</span>
      </div>
    </header>

    <div class="progress-bar" role="progressbar" :aria-valuenow="roundIndex" aria-valuemin="0" :aria-valuemax="MAX_ROUNDS">
      <div class="progress-fill" :style="{ width: progressPercent + '%' }" />
    </div>

    <main class="game-main">
      <div
        class="game-area"
        :class="getStateClass()"
        @pointerdown="handlePointerDown"
        role="button"
        :aria-label="currentStateDisplay.label + '，' + currentStateDisplay.hint"
        :aria-live="'polite'"
        tabindex="0"
      >
        <div class="game-display">
          <div class="state-content">
            <div class="state-icon" aria-hidden="true">{{ currentStateDisplay.icon }}</div>
            <div
              class="state-label"
              :class="{ 'reaction-good': displayResultType === 'success' }"
            >{{ currentStateDisplay.label }}</div>
            <div class="state-hint">{{ currentStateDisplay.hint }}</div>
          </div>
        </div>
      </div>
    </main>

    <footer class="game-footer">
      <div class="rounds-preview" role="list" aria-label="轮次进度">
        <div
          v-for="i in MAX_ROUNDS"
          :key="i"
          class="round-dot"
          :class="getRoundDotClass(i - 1)"
          :aria-label="`第${i}轮 ${getRoundDotClass(i - 1) || '待完成'}`"
          role="listitem"
        />
      </div>
      <p class="game-hint">点击屏幕或按空格键 · 屏幕变绿立即点击</p>
    </footer>
  </div>
</template>

<style scoped>
.game-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  gap: 0.75rem;
}

.player-info,
.round-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--color-surface);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  transition: background var(--transition-fast);
}

.player-label,
.round-label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.player-name {
  font-weight: 600;
  color: var(--color-text);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.round-value {
  font-weight: 700;
  color: var(--color-primary);
}

.progress-bar {
  height: 4px;
  background: var(--color-surface);
  margin: 0 1.5rem;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
  box-shadow: 0 0 8px var(--color-primary);
}

.game-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.game-area {
  width: 100%;
  max-width: min(500px, 90vw);
  height: clamp(280px, 60vh, 450px);
  border-radius: var(--border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0ms;
  position: relative;
  overflow: hidden;
  touch-action: manipulation;
  -webkit-user-select: none;
  user-select: none;
}

.game-area:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}

.game-area.state-ready {
  background: var(--color-surface);
}

.game-area.state-waiting {
  background: var(--color-waiting);
}

.game-area.state-target {
  background: var(--color-clickable);
  animation: targetFlash 0.12s ease-out;
}

.game-area.state-success {
  background: var(--color-clickable);
}

.game-area.state-early {
  background: var(--color-early);
}

.game-area.state-timeout {
  background: var(--color-timeout);
}

.game-area.state-abnormal {
  background: var(--color-surface);
  border: 2px solid var(--color-danger);
}

.game-area.state-completed {
  background: var(--color-complete);
}

@keyframes targetFlash {
  0% { transform: scale(0.995); }
  100% { transform: scale(1); }
}

.game-area.state-target .state-label,
.game-area.state-target .state-hint,
.game-area.state-success .state-label,
.game-area.state-success .state-hint {
  color: #000;
}

.game-area.state-target .state-icon,
.game-area.state-success .state-icon {
  filter: brightness(0.3);
}

.game-display {
  text-align: center;
  z-index: 1;
  width: 100%;
  padding: 1rem;
}

.state-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  animation: fadeIn 0.12s ease-out;
}

.game-area.state-success .state-label {
  animation: countUp 0.3s ease-out;
}

.state-icon {
  font-size: clamp(2.5rem, 8vw, 4rem);
  line-height: 1;
}

.state-label {
  font-size: clamp(1.5rem, 6vw, 2.5rem);
  font-weight: 900;
  letter-spacing: -0.02em;
}

.state-label.reaction-good {
  font-family: var(--font-mono);
  font-size: clamp(2rem, 7vw, 3rem);
}

.state-hint {
  font-size: clamp(0.75rem, 2.5vw, 0.95rem);
  opacity: 0.8;
}

.game-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem 2rem;
}

.rounds-preview {
  display: flex;
  gap: 0.5rem;
}

.round-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-surface);
  transition: all var(--transition-fast);
}

.round-dot.success {
  background: var(--color-clickable);
  box-shadow: 0 0 6px var(--color-clickable);
}

.round-dot.early {
  background: var(--color-early);
}

.round-dot.timeout {
  background: var(--color-timeout);
}

.round-dot.abnormal {
  background: var(--color-danger);
}

.game-hint {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

@media (max-width: 480px) {
  .game-header {
    padding: 0.75rem 1rem;
  }

  .player-info,
  .round-info {
    padding: 0.375rem 0.75rem;
    font-size: 0.8rem;
  }

  .player-name {
    max-width: 70px;
  }

  .game-footer {
    padding: 0.75rem 1rem 1.5rem;
  }

  .rounds-preview {
    gap: 0.375rem;
  }
}

@media (max-width: 360px) {
  .game-header {
    padding: 0.5rem 0.75rem;
  }

  .player-info,
  .round-info {
    padding: 0.25rem 0.5rem;
    gap: 0.375rem;
  }

  .player-label,
  .round-label {
    font-size: 0.7rem;
  }

  .player-name,
  .round-value {
    font-size: 0.85rem;
  }

  .game-area {
    height: clamp(240px, 55vh, 380px);
  }
}

@media (min-width: 1366px) {
  .game-area {
    max-width: 600px;
    height: 420px;
  }
}
</style>

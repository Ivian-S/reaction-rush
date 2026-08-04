<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useGameSession } from '@/composables/useGameSession'
import { useApi } from '@/composables/useApi'
import { getRatingByAverage } from '@/types/rating'
import { ElMessage } from 'element-plus'
import type { RoundData } from '@/types/game'

const router = useRouter()
const gameSession = useGameSession()
const api = useApi()

const displayAverage = ref(0)
const isSaving = ref(false)
const saveStatus = ref<'idle' | 'saving' | 'saved' | 'not-qualified' | 'no-personal-best' | 'nickname-confirm' | 'failed' | 'network-error'>('idle')
const saveMessage = ref('')
const isNewRecord = ref(false)

let averageRafId: number | null = null

const rounds = computed(() => gameSession.session.rounds)

const successfulRounds = computed(() =>
  rounds.value.filter(r => r.resultType === 'success')
)

const averageReaction = computed<number | null>(() => {
  const valid = successfulRounds.value.map(r => r.reactionMs).filter((v): v is number => v !== null)
  if (valid.length === 0) return null
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
})

const bestReaction = computed<number | null>(() => {
  const valid = successfulRounds.value.map(r => r.reactionMs).filter((v): v is number => v !== null)
  if (valid.length === 0) return null
  return Math.min(...valid)
})

const earlyCount = computed(() => rounds.value.filter(r => r.resultType === 'early').length)
const timeoutCount = computed(() => rounds.value.filter(r => r.resultType === 'timeout').length)
const abnormalCount = computed(() => rounds.value.filter(r => r.resultType === 'abnormal').length)
const validCount = computed(() => successfulRounds.value.length)

const rating = computed(() => getRatingByAverage(averageReaction.value, validCount.value))

const noValidRounds = computed(() => validCount.value === 0)

const chartMaxMs = computed(() => {
  const values = successfulRounds.value.map(r => r.reactionMs).filter((v): v is number => v !== null)
  if (values.length === 0) return 1000
  const max = Math.max(...values)
  return Math.max(500, Math.ceil(max / 100) * 100 + 100)
})

function getSaveStatusText(): string {
  switch (saveStatus.value) {
    case 'saving': return '正在保存成绩...'
    case 'saved': return saveMessage.value || '成绩已保存'
    case 'not-qualified': return '有效轮次不足 3 轮，未进入排行榜'
    case 'no-personal-best': return saveMessage.value || '成绩有效，但未刷新个人纪录'
    case 'nickname-confirm': return '昵称确认失效，请返回首页重新输入'
    case 'failed': return saveMessage.value || '保存失败'
    case 'network-error': return '成绩未保存（网络或数据库不可用）'
    default: return ''
  }
}

function canRetrySave(): boolean {
  return saveStatus.value === 'failed' || saveStatus.value === 'network-error'
}

function canShare(): boolean {
  return !noValidRounds.value
}

onMounted(async () => {
  animateAverage()
  await saveAndReload()
})

onBeforeUnmount(() => {
  if (averageRafId !== null) {
    cancelAnimationFrame(averageRafId)
    averageRafId = null
  }
})

async function saveAndReload() {
  if (gameSession.session.rounds.length === 0) return

  const submitData = {
    sessionId: gameSession.session.sessionId,
    nickname: gameSession.session.nickname,
    confirmedExistingNickname: gameSession.session.confirmedExistingNickname,
    rounds: gameSession.session.rounds.map(r => ({
      roundNumber: r.roundNumber,
      resultType: r.resultType,
      reactionMs: r.reactionMs ?? 0,
      waitDurationMs: r.waitMs,
      occurredAt: r.occurredAt
    }))
  }

  isSaving.value = true
  saveStatus.value = 'saving'
  saveMessage.value = ''

  try {
    const result = await api.submitSession(submitData)
    if (result && result.success) {
      if (result.code === 'DUPLICATE_SESSION') {
        saveStatus.value = 'saved'
        saveMessage.value = '成绩已保存（重复提交，返回已有结果）'
        isNewRecord.value = result.data?.isFastest ?? false
        return
      }
      saveStatus.value = 'saved'
      saveMessage.value = result.message || '成绩已保存'
      isNewRecord.value = result.data?.isFastest ?? false
    } else if (result && !result.success) {
      handleFailureByCode(result.code, result.message || '保存失败')
    } else {
      saveStatus.value = 'failed'
      saveMessage.value = '保存失败'
    }
  } catch {
    saveStatus.value = 'network-error'
    saveMessage.value = '网络错误，无法保存成绩'
  } finally {
    isSaving.value = false
  }
}

function handleFailureByCode(code: string, message: string) {
  switch (code) {
    case 'NOT_QUALIFIED':
      saveStatus.value = 'not-qualified'
      saveMessage.value = message
      break
    case 'NO_PERSONAL_BEST':
      saveStatus.value = 'no-personal-best'
      saveMessage.value = message
      break
    case 'NICKNAME_CONFIRM_REQUIRED':
      saveStatus.value = 'nickname-confirm'
      saveMessage.value = message
      break
    case 'DUPLICATE_SESSION':
      saveStatus.value = 'saved'
      saveMessage.value = '成绩已保存（重复提交，返回已有结果）'
      break
    case 'DATABASE_UNAVAILABLE':
      saveStatus.value = 'network-error'
      saveMessage.value = message
      break
    default:
      saveStatus.value = 'failed'
      saveMessage.value = message
  }
}

function animateAverage() {
  const target = averageReaction.value ?? 0
  const duration = 800
  const startTime = performance.now()

  function step(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    displayAverage.value = Math.round(eased * target)

    if (progress < 1) {
      averageRafId = requestAnimationFrame(step)
    } else {
      displayAverage.value = target
      averageRafId = null
    }
  }

  averageRafId = requestAnimationFrame(step)
}

function getRoundLabel(round: RoundData) {
  switch (round.resultType) {
    case 'success': return '有效'
    case 'early': return '过早'
    case 'timeout': return '超时'
    case 'abnormal': return '异常'
    default: return round.resultType
  }
}

function getRoundClass(round: RoundData) {
  return round.resultType
}

function goHome() {
  router.push('/')
}

function playAgain() {
  gameSession.resetWithNickname()
  router.push('/game')
}

function getBarColor(type: string) {
  switch (type) {
    case 'success': return 'var(--color-clickable)'
    case 'early': return 'var(--color-early)'
    case 'timeout': return 'var(--color-timeout)'
    case 'abnormal': return 'var(--color-danger)'
    default: return 'var(--color-text-secondary)'
  }
}

function getShareText(): string {
  if (noValidRounds.value) {
    return `我在 Reaction Rush 完成了 5 轮测试，但没有有效成绩，来挑战我吧！`
  }
  const nickname = gameSession.session.nickname
  const avg = averageReaction.value!
  const best = bestReaction.value!
  return `我在 Reaction Rush 的成绩：平均 ${avg}ms，最快 ${best}ms（玩家：${nickname}），来挑战我吧！`
}

async function copyScore() {
  const text = getShareText()
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      ElMessage.success('成绩已复制到剪贴板')
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      ElMessage.success('成绩已复制到剪贴板')
    }
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

/* SVG chart helpers */
const CHART_WIDTH = 500
const CHART_HEIGHT = 200
const CHART_PADDING = { top: 20, right: 20, bottom: 30, left: 40 }

const chartInnerWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right
const chartInnerHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom

function chartX(roundIndex: number): number {
  const slots = Math.max(5, rounds.value.length)
  return CHART_PADDING.left + (chartInnerWidth * roundIndex) / (slots - 1)
}

function chartY(reactionMs: number): number {
  const max = chartMaxMs.value
  return CHART_PADDING.top + chartInnerHeight - (chartInnerHeight * reactionMs) / max
}

const chartPoints = computed(() => {
  const pts: { x: number; y: number; ms: number; round: number }[] = []
  successfulRounds.value.forEach(r => {
    if (r.reactionMs !== null) {
      pts.push({
        x: chartX(r.roundNumber - 1),
        y: chartY(r.reactionMs),
        ms: r.reactionMs,
        round: r.roundNumber
      })
    }
  })
  return pts
})

const chartPath = computed(() => {
  if (chartPoints.value.length === 0) return ''
  return chartPoints.value.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
})

const yAxisTicks = computed(() => {
  const max = chartMaxMs.value
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  return ticks.map(t => {
    const ms = Math.round(max * (1 - t))
    return {
      y: CHART_PADDING.top + chartInnerHeight * t,
      ms
    }
  })
})

const xAxisTicks = computed(() => {
  return rounds.value.map((_, i) => ({
    x: chartX(i),
    round: i + 1
  }))
})

const bottomMarkers = computed(() => {
  const markers: { x: number; type: string; round: number }[] = []
  rounds.value.forEach(r => {
    if (r.resultType !== 'success') {
      markers.push({
        x: chartX(r.roundNumber - 1),
        type: r.resultType,
        round: r.roundNumber
      })
    }
  })
  return markers
})

function getBottomMarkerColor(type: string): string {
  switch (type) {
    case 'early': return 'var(--color-early)'
    case 'timeout': return 'var(--color-timeout)'
    case 'abnormal': return 'var(--color-danger)'
    default: return 'var(--color-text-secondary)'
  }
}
</script>

<template>
  <div class="result-page" role="application" aria-label="测试结果">
    <header class="result-header">
      <button class="back-btn" @click="goHome" aria-label="返回首页">← 返回</button>
      <h1 class="page-title">测试结果</h1>
      <div class="spacer" />
    </header>

    <div class="result-content">
      <section class="hero-card" :class="{ 'new-record': isNewRecord }" aria-label="主要成绩">
        <div v-if="isNewRecord" class="record-badge" aria-label="新纪录">🏆 新纪录！</div>
        <div v-if="rating" class="rating-badge" :style="{ borderColor: 'var(--color-primary)' }">
          <span class="rating-icon">{{ rating.icon }}</span>
          <span class="rating-name">{{ rating.name }}</span>
        </div>
        <div class="average-label">平均反应时间</div>
        <div class="average-value">
          <span class="number" aria-live="polite">{{ noValidRounds ? '--' : displayAverage }}</span>
          <span class="unit">ms</span>
        </div>
        <div class="average-sublabel" v-if="!noValidRounds">有效轮次：{{ validCount }} / 5</div>
        <div class="average-sublabel" v-else>暂无有效成绩</div>

        <div class="save-status" :class="saveStatus">
          <template v-if="saveStatus === 'saving'">
            <div class="status-spinner" />
            <span>{{ getSaveStatusText() }}</span>
          </template>
          <template v-else-if="saveStatus === 'saved'">
            <span class="status-icon">✓</span>
            <span>{{ getSaveStatusText() }}</span>
          </template>
          <template v-else>
            <span class="status-icon" aria-hidden="true">
              {{ saveStatus === 'idle' ? '' : saveStatus === 'failed' || saveStatus === 'network-error' ? '✕' : '!' }}
            </span>
            <span>{{ getSaveStatusText() }}</span>
          </template>
        </div>
      </section>

      <section class="stats-row" aria-label="详细统计">
        <div class="stat-card best">
          <div class="stat-label">最快单轮</div>
          <div class="stat-value">{{ bestReaction ?? '--' }} <span class="stat-unit">ms</span></div>
        </div>
        <div class="stat-card errors">
          <div class="stat-label">失误统计</div>
          <div class="stat-value">
            <span v-if="earlyCount" class="error-chip early">{{ earlyCount }} 过早</span>
            <span v-if="timeoutCount" class="error-chip timeout">{{ timeoutCount }} 超时</span>
            <span v-if="abnormalCount" class="error-chip abnormal">{{ abnormalCount }} 异常</span>
            <span v-if="!earlyCount && !timeoutCount && !abnormalCount" class="error-chip none">无失误</span>
          </div>
        </div>
      </section>

      <section v-if="chartPoints.length > 0 || bottomMarkers.length > 0" class="chart-section" aria-label="成绩图表">
        <h2 class="section-title">成绩曲线</h2>
        <div class="chart-wrapper">
          <svg :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`" class="chart-svg" role="img" aria-label="成绩曲线图">
            <g>
              <line
                :x1="CHART_PADDING.left"
                :y1="CHART_PADDING.top"
                :x2="CHART_PADDING.left"
                :y2="CHART_HEIGHT - CHART_PADDING.bottom"
                stroke="var(--color-text-secondary)"
                stroke-opacity="0.4"
                stroke-width="1"
              />
              <line
                :x1="CHART_PADDING.left"
                :y1="CHART_HEIGHT - CHART_PADDING.bottom"
                :x2="CHART_WIDTH - CHART_PADDING.right"
                :y2="CHART_HEIGHT - CHART_PADDING.bottom"
                stroke="var(--color-text-secondary)"
                stroke-opacity="0.4"
                stroke-width="1"
              />
              <g v-for="(tick, idx) in yAxisTicks" :key="'y-' + idx">
                <line
                  :x1="CHART_PADDING.left"
                  :y1="tick.y"
                  :x2="CHART_WIDTH - CHART_PADDING.right"
                  :y2="tick.y"
                  stroke="var(--color-text-secondary)"
                  stroke-opacity="0.15"
                  stroke-width="1"
                />
                <text
                  :x="CHART_PADDING.left - 6"
                  :y="tick.y + 4"
                  text-anchor="end"
                  font-size="10"
                  fill="var(--color-text-secondary)"
                >{{ tick.ms }}</text>
              </g>
              <g v-for="(tick, idx) in xAxisTicks" :key="'x-' + idx">
                <text
                  :x="tick.x"
                  :y="CHART_HEIGHT - CHART_PADDING.bottom + 16"
                  text-anchor="middle"
                  font-size="10"
                  fill="var(--color-text-secondary)"
                >第{{ tick.round }}轮</text>
              </g>
              <path
                v-if="chartPath"
                :d="chartPath"
                fill="none"
                stroke="var(--color-primary)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <g v-for="p in chartPoints" :key="'pt-' + p.round">
                <circle
                  :cx="p.x"
                  :cy="p.y"
                  r="4"
                  fill="var(--color-primary)"
                  stroke="var(--color-bg)"
                  stroke-width="2"
                />
                <title>{{ `第${p.round}轮: ${p.ms}ms` }}</title>
              </g>
              <g v-for="m in bottomMarkers" :key="'bm-' + m.round">
                <rect
                  :x="m.x - 4"
                  :y="CHART_HEIGHT - CHART_PADDING.bottom"
                  width="8"
                  height="6"
                  :fill="getBottomMarkerColor(m.type)"
                />
              </g>
            </g>
          </svg>
        </div>
        <div class="chart-legend" v-if="bottomMarkers.length > 0">
          <span class="legend-item"><span class="legend-dot early" /> 过早</span>
          <span class="legend-item"><span class="legend-dot timeout" /> 超时</span>
          <span class="legend-item"><span class="legend-dot abnormal" /> 异常</span>
        </div>
      </section>

      <section class="rounds-detail" aria-label="各轮详情">
        <h2 class="section-title">各轮详情</h2>
        <div class="rounds-list" role="list">
          <div
            v-for="round in rounds"
            :key="round.roundNumber"
            class="round-item"
            :class="getRoundClass(round)"
            role="listitem"
          >
            <div class="round-index">第 {{ round.roundNumber }} 轮</div>
            <div class="round-bar-container" aria-hidden="true">
              <div
                v-if="round.reactionMs"
                class="round-bar"
                :style="{
                  width: `${Math.min(round.reactionMs, 1500) / 15}%`,
                  background: getBarColor(round.resultType)
                }"
              />
              <div v-else class="round-bar placeholder" />
            </div>
            <div class="round-info">
              <span class="round-time" v-if="round.reactionMs">{{ round.reactionMs }} ms</span>
              <span class="round-time" v-else>--</span>
              <span class="round-type" :class="getRoundClass(round)">{{ getRoundLabel(round) }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="actions-row">
        <button
          v-if="canRetrySave()"
          class="btn btn-secondary btn-retry"
          @click="saveAndReload"
          :disabled="isSaving"
        >{{ isSaving ? '保存中...' : '重试保存' }}</button>
        <button class="btn btn-secondary" @click="copyScore" :disabled="!canShare()">复制成绩</button>
        <button class="btn btn-secondary" @click="goHome">返回首页</button>
        <button class="btn btn-primary" @click="playAgain">再测一次</button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.result-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  animation: fadeIn 0.3s ease-out;
}

.result-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 1rem 1.5rem;
}

.back-btn {
  color: var(--color-text-secondary);
  font-size: 0.95rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  background: var(--color-surface);
  transition: all var(--transition-fast);
  justify-self: start;
  min-height: 36px;
}

.back-btn:hover {
  color: var(--color-text);
  opacity: 0.85;
}

.page-title {
  font-size: 1.2rem;
  font-weight: 600;
}

.spacer {
  width: 60px;
}

.result-content {
  flex: 1;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hero-card {
  background: linear-gradient(135deg, var(--color-surface), rgba(0, 212, 255, 0.08));
  border-radius: var(--border-radius);
  padding: 2rem 1.5rem;
  text-align: center;
  position: relative;
  overflow: hidden;
  animation: scaleIn 0.4s ease-out;
  box-shadow: var(--shadow-card);
}

.hero-card.new-record {
  animation: scaleIn 0.4s ease-out, glow 2s ease-in-out infinite;
}

.record-badge {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: linear-gradient(135deg, #ffd700, #ff8c00);
  color: #000;
  font-weight: 700;
  font-size: 0.85rem;
  padding: 0.375rem 0.75rem;
  border-radius: 12px;
  animation: pulse 1.5s ease-in-out infinite;
}

.rating-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.875rem;
  border-radius: 20px;
  border: 1px solid var(--color-primary);
  background: rgba(255, 255, 255, 0.04);
  margin-bottom: 0.75rem;
  animation: fadeInUp 0.4s ease-out;
}

.rating-icon {
  font-size: 1rem;
}

.rating-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-primary);
}

.average-label {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.5rem;
}

.average-value {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 0.25rem;
}

.average-value .number {
  font-size: clamp(3rem, 10vw, 5rem);
  font-weight: 900;
  font-family: var(--font-mono);
  color: var(--color-primary);
  letter-spacing: -0.03em;
  line-height: 1;
}

.average-value .unit {
  font-size: 1.2rem;
  color: var(--color-text-secondary);
}

.average-sublabel {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.save-status {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-size: 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
  max-width: 100%;
  word-break: break-all;
}

.save-status.saving,
.save-status.idle {
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-secondary);
}

.save-status.saved {
  background: rgba(0, 255, 136, 0.15);
  color: var(--color-clickable);
}

.save-status.not-qualified {
  background: rgba(255, 170, 0, 0.15);
  color: var(--color-warning);
}

.save-status.no-personal-best {
  background: rgba(100, 150, 255, 0.12);
  color: #6aa8ff;
}

.save-status.nickname-confirm {
  background: rgba(255, 102, 68, 0.15);
  color: var(--color-early);
}

.save-status.failed,
.save-status.network-error {
  background: rgba(255, 51, 51, 0.15);
  color: var(--color-danger);
}

.status-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.status-icon {
  font-weight: 700;
}

.stats-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.stat-card {
  background: var(--color-surface);
  border-radius: var(--border-radius-sm);
  padding: 1rem;
  animation: fadeInUp 0.4s ease-out;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: 700;
}

.stat-unit {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.error-chip {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  margin-right: 0.25rem;
  margin-bottom: 0.25rem;
}

.error-chip.early {
  background: rgba(255, 102, 68, 0.2);
  color: var(--color-early);
}

.error-chip.timeout {
  background: rgba(255, 136, 0, 0.2);
  color: var(--color-timeout);
}

.error-chip.abnormal {
  background: rgba(255, 51, 51, 0.2);
  color: var(--color-danger);
}

.error-chip.none {
  background: rgba(0, 255, 136, 0.2);
  color: var(--color-clickable);
}

.chart-section {
  background: var(--color-surface);
  border-radius: var(--border-radius-sm);
  padding: 1rem;
  animation: fadeInUp 0.45s ease-out;
}

.chart-section .section-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.chart-wrapper {
  width: 100%;
  overflow-x: auto;
}

.chart-svg {
  width: 100%;
  height: auto;
  max-height: 240px;
  display: block;
}

.chart-legend {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot.early { background: var(--color-early); }
.legend-dot.timeout { background: var(--color-timeout); }
.legend-dot.abnormal { background: var(--color-danger); }

.rounds-detail {
  background: var(--color-surface);
  border-radius: var(--border-radius-sm);
  padding: 1rem;
  animation: fadeInUp 0.5s ease-out;
}

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.rounds-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.round-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  transition: background var(--transition-fast);
  min-height: 40px;
}

.round-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.round-index {
  font-size: 0.8rem;
  font-weight: 600;
  min-width: 60px;
  color: var(--color-text-secondary);
}

.round-bar-container {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.round-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease-out;
}

.round-bar.placeholder {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
}

.round-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 90px;
  justify-content: flex-end;
}

.round-time {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
}

.round-type {
  font-size: 0.7rem;
  padding: 0.125rem 0.375rem;
  border-radius: 6px;
  font-weight: 600;
}

.round-type.success {
  background: rgba(0, 255, 136, 0.2);
  color: var(--color-clickable);
}

.round-type.early {
  background: rgba(255, 102, 68, 0.2);
  color: var(--color-early);
}

.round-type.timeout {
  background: rgba(255, 136, 0, 0.2);
  color: var(--color-timeout);
}

.round-type.abnormal {
  background: rgba(255, 51, 51, 0.2);
  color: var(--color-danger);
}

.actions-row {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  padding-top: 0.5rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 24px;
  font-size: 0.95rem;
  font-weight: 600;
  transition: all var(--transition-fast);
  cursor: pointer;
  min-height: 44px;
  min-width: 100px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: #000;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.btn-retry {
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  background: transparent;
}

.btn-retry:hover:not(:disabled) {
  background: rgba(0, 212, 255, 0.1);
}

@media (max-width: 480px) {
  .stats-row {
    grid-template-columns: 1fr;
  }

  .actions-row {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }

  .rounds-list {
    gap: 0.375rem;
  }

  .round-item {
    gap: 0.5rem;
    padding: 0.375rem;
  }

  .round-info {
    min-width: 70px;
  }

  .chart-legend {
    flex-wrap: wrap;
    font-size: 0.7rem;
  }
}

@media (max-width: 360px) {
  .result-content {
    padding: 0 1rem 1.5rem;
  }

  .hero-card {
    padding: 1.5rem 1rem;
  }

  .average-value .number {
    font-size: 2.5rem;
  }

  .btn {
    padding: 0.625rem 1rem;
    font-size: 0.9rem;
    min-width: 80px;
  }
}
</style>

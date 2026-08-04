<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { useGameSession } from '@/composables/useGameSession'
import NicknameDialog from '@/components/NicknameDialog.vue'
import SettingsDialog from '@/components/SettingsDialog.vue'

const router = useRouter()
const route = useRoute()
const api = useApi()
const gameSession = useGameSession()

const showNicknameDialog = ref(false)
const showSettingsDialog = ref(false)
const flashMessage = ref('')
const activeTab = ref<'average' | 'fastest'>('average')

watch(
  () => route.query.flash,
  (val) => {
    if (val) {
      flashMessage.value = val as string
      setTimeout(() => {
        flashMessage.value = ''
      }, 3000)
      router.replace({ query: {} })
    }
  },
  { immediate: true }
)

watch([showNicknameDialog, showSettingsDialog], ([nick, settings]) => {
  const isOpen = nick || settings
  document.dispatchEvent(new CustomEvent('modal-opening', { detail: isOpen }))
})

onMounted(async () => {
  const online = await api.checkServerHealth()
  if (online) {
    await api.loadLeaderboards()
  }
})

function handleStart() {
  showNicknameDialog.value = true
}

function handleNicknameSubmit(nickname: string, confirmed: boolean) {
  gameSession.startGame(nickname, confirmed)
  showNicknameDialog.value = false
  router.push('/game')
}

function handleNicknameCancel() {
  showNicknameDialog.value = false
}

async function handleDataCleared() {
  flashMessage.value = '排行榜数据已清空'
  setTimeout(() => { flashMessage.value = '' }, 3000)
  await api.loadLeaderboards()
}

function getStatusClass() {
  if (api.serverStatus.value === 'online') return 'status-online'
  if (api.serverStatus.value === 'offline') return 'status-offline'
  return 'status-checking'
}

function getStatusText() {
  if (api.serverStatus.value === 'online') return '服务器在线'
  if (api.serverStatus.value === 'offline') return '服务器离线'
  return '检测中...'
}

function getRankMedal(rank: number): string {
  switch (rank) {
    case 1: return '🥇'
    case 2: return '🥈'
    case 3: return '🥉'
    default: return `${rank}`
  }
}

function getRankClass(rank: number): string {
  if (rank === 1) return 'rank-gold'
  if (rank === 2) return 'rank-silver'
  if (rank === 3) return 'rank-bronze'
  return ''
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const fastestEntry = computed(() => api.historyFastest.value)
</script>

<template>
  <div class="home-page">
    <transition name="fade" mode="out-in">
      <div v-if="flashMessage" class="flash-message">
        {{ flashMessage }}
      </div>
    </transition>

    <header class="top-bar">
      <div class="status-indicator" :class="getStatusClass()">
        <span class="status-dot" />
        <span class="status-text">{{ getStatusText() }}</span>
      </div>
      <button class="icon-btn" @click="showSettingsDialog = true" aria-label="打开设置">
        ⚙️
      </button>
    </header>

    <main class="home-main">
      <section class="hero">
        <h1 class="hero-title">Reaction Rush</h1>
        <p class="hero-subtitle">极限反应挑战 · 你的手速有多快？</p>
      </section>

      <section v-if="fastestEntry" class="record-banner" aria-label="历史最快单轮记录">
        <div class="record-badge">🏆 历史最快</div>
        <div class="record-info">
          <span class="record-value">{{ fastestEntry.fastestMs }}<small>ms</small></span>
          <span class="record-owner">由 {{ fastestEntry.nickname }} 创造</span>
        </div>
      </section>

      <section class="actions">
        <button class="start-btn" @click="handleStart" aria-label="开始测试">
          <span class="start-icon" aria-hidden="true">▶</span>
          <span>开始测试</span>
        </button>
        <button class="settings-entry-btn" @click="showSettingsDialog = true" aria-label="打开高级设置">
          ⚙️ 高级设置
        </button>
      </section>

      <section class="leaderboard-section" aria-label="排行榜">
        <template v-if="api.serverStatus.value === 'offline'">
          <div class="lb-unavailable">
            <div class="lb-icon">📡</div>
            <p>排行榜暂时不可用</p>
            <small>服务器离线，请稍后再试</small>
          </div>
        </template>

        <template v-else-if="api.leaderboardLoading.value">
          <div class="lb-loading">
            <div class="spinner" />
            <p>加载排行榜...</p>
          </div>
        </template>

        <template v-else-if="api.leaderboardError.value">
          <div class="lb-unavailable">
            <div class="lb-icon">⚠️</div>
            <p>{{ api.leaderboardError.value }}</p>
            <small>请刷新页面重试</small>
          </div>
        </template>

        <template v-else-if="api.isLeaderboardEmpty.value">
          <div class="lb-empty">
            <div class="lb-icon">🏆</div>
            <p>暂无排行榜数据</p>
            <small>成为第一个挑战者吧！</small>
          </div>
        </template>

        <template v-else>
          <div class="lb-tabs-bar" role="tablist" aria-label="排行榜类型">
            <button
              class="lb-tab"
              :class="{ active: activeTab === 'average' }"
              @click="activeTab = 'average'"
              role="tab"
              :aria-selected="activeTab === 'average'"
            >🏆 平均反应榜</button>
            <button
              class="lb-tab"
              :class="{ active: activeTab === 'fastest' }"
              @click="activeTab = 'fastest'"
              role="tab"
              :aria-selected="activeTab === 'fastest'"
            >⚡ 最快单轮榜</button>
          </div>

          <div class="lb-panels">
            <div v-show="activeTab === 'average'" class="lb-panel" role="tabpanel">
              <div class="lb-list">
                <div
                  v-for="entry in api.leaderboardAvg.value"
                  :key="'avg-' + entry.rank"
                  class="lb-item"
                  :class="getRankClass(entry.rank)"
                  role="listitem"
                >
                  <span class="lb-rank" :aria-label="`第${entry.rank}名`">{{ getRankMedal(entry.rank) }}</span>
                  <span class="lb-name">{{ entry.nickname }}</span>
                  <span class="lb-detail avg-detail">{{ entry.fastestMs }}ms 最快</span>
                  <span class="lb-detail round-detail">{{ entry.validRounds }}轮</span>
                  <span class="lb-value" aria-label="平均反应时间">{{ entry.averageMs }}ms</span>
                  <span class="lb-date">{{ formatDate(entry.achievedAt) }}</span>
                </div>
                <div v-if="api.leaderboardAvg.value.length < 10" class="lb-more">
                  还有 {{ 10 - api.leaderboardAvg.value.length }} 个名额等你挑战
                </div>
              </div>
            </div>

            <div v-show="activeTab === 'fastest'" class="lb-panel" role="tabpanel">
              <div class="lb-list">
                <div
                  v-for="entry in api.leaderboardFastest.value"
                  :key="'fast-' + entry.rank"
                  class="lb-item"
                  :class="getRankClass(entry.rank)"
                  role="listitem"
                >
                  <span class="lb-rank" :aria-label="`第${entry.rank}名`">{{ getRankMedal(entry.rank) }}</span>
                  <span class="lb-name">{{ entry.nickname }}</span>
                  <span class="lb-detail avg-detail">{{ entry.averageMs }}ms 平均</span>
                  <span class="lb-detail round-detail">{{ entry.validRounds }}轮</span>
                  <span class="lb-value" aria-label="最快单轮">{{ entry.fastestMs }}ms</span>
                  <span class="lb-date">{{ formatDate(entry.achievedAt) }}</span>
                </div>
                <div v-if="api.leaderboardFastest.value.length < 10" class="lb-more">
                  还有 {{ 10 - api.leaderboardFastest.value.length }} 个名额等你挑战
                </div>
              </div>
            </div>
          </div>

        </template>
      </section>

      <section class="tips-section" aria-label="游戏规则">
        <h3>💡 游戏规则</h3>
        <ul>
          <li>屏幕变红等待，变绿立即点击</li>
          <li>过早点击将记录为 early</li>
          <li>超时未点击将记录为 timeout</li>
          <li>共 5 轮测试，取有效成绩</li>
          <li>有效成绩需满足：反应时间 ≥ 50ms</li>
          <li>至少 3 个有效成绩参与排名</li>
        </ul>
      </section>
    </main>

    <NicknameDialog
      v-model="showNicknameDialog"
      @submit="handleNicknameSubmit"
      @cancel="handleNicknameCancel"
    />

    <SettingsDialog
      v-model="showSettingsDialog"
      @close="showSettingsDialog = false"
      @cleared="handleDataCleared"
    />
  </div>
</template>

<style scoped>
.home-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  padding-bottom: 2rem;
  animation: fadeIn 0.4s ease-out;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.status-indicator.status-online {
  background: rgba(0, 255, 136, 0.15);
  color: var(--color-clickable);
}

.status-indicator.status-offline {
  background: rgba(255, 68, 102, 0.15);
  color: var(--color-danger);
}

.status-indicator.status-checking {
  background: rgba(255, 170, 0, 0.15);
  color: var(--color-warning);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.icon-btn {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 1.1rem;
  transition: all var(--transition-fast);
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.home-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem 1.5rem;
  gap: 1.25rem;
  max-width: 700px;
  margin: 0 auto;
  width: 100%;
}

.hero {
  text-align: center;
  padding: 0.5rem 0;
}

.hero-title {
  font-size: clamp(2rem, 8vw, 3rem);
  font-weight: 900;
  background: linear-gradient(135deg, var(--color-primary), var(--color-clickable));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;
}

.hero-subtitle {
  font-size: clamp(0.9rem, 3vw, 1.125rem);
  color: var(--color-text-secondary);
}

.record-banner {
  width: 100%;
  background: linear-gradient(135deg, rgba(255, 200, 0, 0.15), rgba(255, 200, 0, 0.05));
  border: 1px solid rgba(255, 200, 0, 0.3);
  border-radius: var(--border-radius);
  padding: 0.875rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  animation: fadeInUp 0.5s ease-out;
}

.record-badge {
  background: rgba(255, 200, 0, 0.2);
  color: #ffc800;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.record-info {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.record-value {
  font-size: clamp(1.5rem, 5vw, 2rem);
  font-weight: 900;
  font-family: var(--font-mono);
  color: #ffc800;
}

.record-value small {
  font-size: 0.875rem;
  font-weight: 600;
  opacity: 0.7;
}

.record-owner {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.start-btn {
  background: var(--color-primary);
  color: var(--color-bg);
  padding: 1rem 2rem;
  border-radius: var(--border-radius);
  font-size: 1.125rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: all var(--transition-fast);
  box-shadow: 0 4px 20px color-mix(in srgb, var(--color-primary) 25%, transparent);
  min-height: 56px;
  min-width: 56px;
}

.start-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px color-mix(in srgb, var(--color-primary) 35%, transparent);
}

.start-btn:active {
  transform: translateY(0);
}

.start-icon {
  font-size: 0.875rem;
}

.settings-entry-btn {
  background: transparent;
  color: var(--color-text-secondary);
  padding: 0.75rem;
  font-size: 0.95rem;
  transition: color var(--transition-fast);
  min-height: 44px;
}

.settings-entry-btn:hover {
  color: var(--color-text);
}

.leaderboard-section {
  width: 100%;
  background: var(--color-surface);
  border-radius: var(--border-radius);
  padding: 1.25rem;
  box-shadow: var(--shadow-card);
  border: 1px solid rgba(255, 255, 255, 0.05);
  animation: fadeInUp 0.5s ease-out;
}

.lb-tabs-bar {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.lb-tab {
  flex: 1;
  background: transparent;
  color: var(--color-text-secondary);
  padding: 0.75rem 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  border-bottom: 2px solid transparent;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.lb-tab:hover {
  color: var(--color-text);
}

.lb-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.lb-panels {
  min-height: 200px;
}

.lb-panel {
  animation: fadeIn 0.2s ease;
}

.lb-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.lb-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--border-radius-sm);
  transition: background var(--transition-fast), transform var(--transition-fast);
  min-height: 40px;
}

.lb-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.lb-item.rank-gold {
  background: linear-gradient(90deg, rgba(255, 200, 0, 0.18), rgba(255, 200, 0, 0.02));
  border-left: 3px solid #ffc800;
  animation: slideUp 0.5s ease-out;
}

.lb-item.rank-silver {
  background: linear-gradient(90deg, rgba(192, 192, 192, 0.15), rgba(192, 192, 192, 0.02));
  border-left: 3px solid #c0c0c0;
  animation: slideUp 0.45s ease-out;
}

.lb-item.rank-bronze {
  background: linear-gradient(90deg, rgba(205, 127, 50, 0.15), rgba(205, 127, 50, 0.02));
  border-left: 3px solid #cd7f32;
  animation: slideUp 0.4s ease-out;
}

.lb-rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  color: var(--color-primary);
  flex-shrink: 0;
}

.lb-name {
  flex: 1;
  font-weight: 600;
  font-size: 0.9rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lb-detail {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.lb-value {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--color-primary);
  font-size: 0.95rem;
  min-width: 55px;
  text-align: right;
  flex-shrink: 0;
}

.lb-date {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  opacity: 0.6;
  white-space: nowrap;
  flex-shrink: 0;
}

.lb-more {
  text-align: center;
  padding: 0.75rem;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  opacity: 0.6;
}

.lb-unavailable,
.lb-empty,
.lb-loading {
  text-align: center;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.lb-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.lb-unavailable p,
.lb-empty p {
  color: var(--color-text);
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.lb-unavailable small,
.lb-empty small {
  opacity: 0.6;
  font-size: 0.85rem;
}

.lb-loading p {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-text-secondary);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.tips-section {
  width: 100%;
  background: var(--color-surface);
  border-radius: var(--border-radius);
  padding: 1.25rem;
  box-shadow: var(--shadow-card);
  border: 1px solid rgba(255, 255, 255, 0.05);
  animation: fadeInUp 0.5s ease-out;
}

.tips-section h3 {
  font-size: 1rem;
  margin-bottom: 0.75rem;
}

.tips-section ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tips-section li {
  color: var(--color-text-secondary);
  font-size: 0.9rem;
  padding-left: 1rem;
  position: relative;
}

.tips-section li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--color-primary);
}

.flash-message {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-surface);
  color: var(--color-warning);
  padding: 0.75rem 1.25rem;
  border-radius: var(--border-radius-sm);
  box-shadow: var(--shadow-elevated);
  z-index: 2000;
  border: 1px solid var(--color-warning);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (min-width: 768px) {
  .lb-item {
    gap: 0.75rem;
  }
}

@media (max-width: 480px) {
  .top-bar {
    padding: 0.75rem 1rem;
  }

  .home-main {
    padding: 0.5rem 1rem;
    gap: 1rem;
  }

  .record-banner {
    padding: 0.75rem 1rem;
    gap: 0.5rem;
  }

  .lb-tabs-bar {
    flex-direction: row;
  }

  .lb-tab {
    font-size: 0.8rem;
    padding: 0.625rem 0.25rem;
  }

  .lb-detail {
    display: none;
  }

  .lb-date {
    display: none;
  }

  .lb-name {
    font-size: 0.85rem;
  }

  .lb-value {
    font-size: 0.9rem;
    min-width: 50px;
  }

  .lb-rank {
    width: 24px;
    height: 24px;
    font-size: 0.875rem;
  }
}

@media (max-width: 360px) {
  .home-main {
    padding: 0.5rem 0.75rem;
  }

  .hero-title {
    font-size: 1.75rem;
  }

  .hero-subtitle {
    font-size: 0.85rem;
  }

  .record-banner {
    padding: 0.5rem 0.75rem;
  }

  .record-value {
    font-size: 1.25rem;
  }

  .leaderboard-section,
  .tips-section {
    padding: 0.875rem;
  }

  .lb-tab {
    font-size: 0.75rem;
    padding: 0.5rem 0.25rem;
  }

  .lb-item {
    padding: 0.375rem 0.5rem;
    gap: 0.375rem;
    min-height: 36px;
  }

  .lb-value {
    font-size: 0.85rem;
    min-width: 45px;
  }

  .lb-rank {
    width: 22px;
    height: 22px;
    font-size: 0.75rem;
  }

  .lb-name {
    font-size: 0.8rem;
  }

  .start-btn {
    padding: 0.875rem 1.5rem;
    font-size: 1rem;
  }
}
</style>

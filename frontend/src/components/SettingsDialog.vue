<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSettings } from '@/composables/useSettings'
import { useApi } from '@/composables/useApi'
import { PRESET_THEMES } from '@/types/settings'
import type { ThemeColors } from '@/types/settings'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'cleared'): void
}>()

const props = defineProps<{
  modelValue: boolean
}>()

const {
  settings,
  activeThemeId,
  setTheme,
  setCustomColor,
  toggleSound,
  toggleVibration,
  resetToDefaults
} = useSettings()

const api = useApi()
const showClearConfirm = ref(false)
const clearLoading = ref(false)

watch(() => props.modelValue, (val) => {
  if (val) {
    activeThemeId.value = settings.activeThemeId
    document.dispatchEvent(new CustomEvent('modal-opening', { detail: true }))
  } else {
    document.dispatchEvent(new CustomEvent('modal-opening', { detail: false }))
    showClearConfirm.value = false
  }
})

const themes = computed(() => [...PRESET_THEMES, {
  id: 'custom',
  name: '自定义',
  isCustom: true,
  colors: settings.customColors
}])

const customColorKeys: { key: keyof ThemeColors; label: string }[] = [
  { key: 'primary', label: '主题色' },
  { key: 'initial', label: '初始状态' },
  { key: 'waiting', label: '等待状态' },
  { key: 'clickable', label: '可点击' },
  { key: 'early', label: '过早反应' },
  { key: 'timeout', label: '超时' },
  { key: 'complete', label: '完成' }
]

function handleColorInput(key: keyof ThemeColors, value: string) {
  setCustomColor(key, value)
  if (activeThemeId.value !== 'custom') {
    setTheme('custom')
  }
}

function handleReset() {
  resetToDefaults()
  activeThemeId.value = settings.activeThemeId
}

async function handleClearConfirm() {
  clearLoading.value = true
  try {
    const result = await api.clearAllData()
    showClearConfirm.value = false
    if (result.success) {
      emit('cleared')
    }
  } finally {
    clearLoading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="emit('close')" role="dialog" aria-modal="true" aria-label="高级设置">
      <div class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">高级设置</h2>
          <button class="close-btn" @click="emit('close')" aria-label="关闭设置">✕</button>
        </div>

        <div class="modal-body">
          <section class="settings-section">
            <h3 class="section-title">主题</h3>
            <div class="theme-grid" role="listbox" aria-label="主题选择">
              <div
                v-for="theme in themes"
                :key="theme.id"
                class="theme-card"
                :class="{ active: activeThemeId === theme.id }"
                @click="setTheme(theme.id)"
                role="option"
                :aria-selected="activeThemeId === theme.id"
                :aria-label="`主题：${theme.name}`"
              >
                <div class="theme-preview" :style="{ background: theme.colors.initial }">
                  <span class="preview-dot" :style="{ background: theme.colors.primary }" />
                </div>
                <span class="theme-name">{{ theme.name }}</span>
              </div>
            </div>
          </section>

          <section v-if="activeThemeId === 'custom'" class="settings-section">
            <h3 class="section-title">自定义颜色</h3>
            <div class="color-grid">
              <div
                v-for="item in customColorKeys"
                :key="item.key"
                class="color-item"
              >
                <label :for="'color-' + item.key">{{ item.label }}</label>
                <input
                  :id="'color-' + item.key"
                  type="color"
                  :value="settings.customColors[item.key]"
                  @input="handleColorInput(item.key, ($event.target as HTMLInputElement).value)"
                  :aria-label="`${item.label}颜色选择器`"
                />
              </div>
            </div>
          </section>

          <section class="settings-section">
            <h3 class="section-title">其他设置</h3>
            <div class="toggle-list">
              <div class="toggle-item" @click="toggleSound" role="switch" :aria-checked="settings.soundEnabled" tabindex="0" aria-label="提示音开关">
                <span>提示音</span>
                <div class="toggle-switch" :class="{ on: settings.soundEnabled }" aria-hidden="true">
                  <div class="toggle-thumb" />
                </div>
              </div>
              <div class="toggle-item" @click="toggleVibration" role="switch" :aria-checked="settings.vibrationEnabled" tabindex="0" aria-label="震动反馈开关">
                <span>震动反馈</span>
                <div class="toggle-switch" :class="{ on: settings.vibrationEnabled }" aria-hidden="true">
                  <div class="toggle-thumb" />
                </div>
              </div>
            </div>
          </section>

          <section class="settings-section danger-zone">
            <h3 class="section-title danger-title">数据管理</h3>
            <p class="danger-desc">清空所有玩家和排行榜数据，操作不可恢复。</p>
            <button
              class="danger-btn"
              @click="showClearConfirm = true"
              :disabled="clearLoading"
            >{{ clearLoading ? '清空中...' : '🗑️ 清空排行榜数据' }}</button>
          </section>

          <Teleport to="body">
            <transition name="modal-fade">
              <div v-if="showClearConfirm" class="confirm-overlay" @click.self="showClearConfirm = false">
                <div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="clear-confirm-title">
                  <h3 id="clear-confirm-title" class="confirm-title">确认清空</h3>
                  <p class="confirm-message">
                    此操作将删除所有玩家和排行榜数据，且<strong>不可恢复</strong>。确定要继续吗？
                  </p>
                  <div class="confirm-actions">
                    <button
                      class="confirm-cancel"
                      @click="showClearConfirm = false"
                      :disabled="clearLoading"
                    >取消</button>
                    <button
                      class="confirm-ok"
                      @click="handleClearConfirm"
                      :disabled="clearLoading"
                    >{{ clearLoading ? '清空中...' : '确认清空' }}</button>
                  </div>
                </div>
              </div>
            </transition>
          </Teleport>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="handleReset">恢复默认</button>
          <button class="btn-primary" @click="emit('close')">完成</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
  padding: 1rem;
  overflow-y: auto;
}

.modal-container {
  background: var(--color-surface);
  border-radius: var(--border-radius);
  padding: 1.5rem;
  width: 100%;
  max-width: 480px;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  box-shadow: var(--shadow-elevated);
  border: 1px solid rgba(255, 255, 255, 0.1);
  animation: slideUp 0.3s ease;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
}

.close-btn {
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 1.2rem;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  transition: all var(--transition-fast);
  min-width: 36px;
  min-height: 36px;
}

.close-btn:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.1);
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  opacity: 0.8;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.theme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem;
  border-radius: var(--border-radius-sm);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.theme-card:hover {
  background: rgba(255, 255, 255, 0.05);
}

.theme-card.active {
  border-color: var(--color-primary);
  background: rgba(255, 255, 255, 0.08);
}

.theme-preview {
  width: 100%;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  box-shadow: 0 0 8px currentColor;
}

.theme-name {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-align: center;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.color-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-bg);
  border-radius: var(--border-radius-sm);
}

.color-item label {
  flex: 1;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.color-item input[type="color"] {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: transparent;
}

.toggle-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toggle-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: var(--color-bg);
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
  min-height: 44px;
}

.toggle-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.toggle-switch {
  width: 44px;
  height: 24px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  position: relative;
  transition: background var(--transition-fast);
}

.toggle-switch.on {
  background: var(--color-primary);
}

.toggle-thumb {
  position: absolute;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: transform var(--transition-fast);
}

.toggle-switch.on .toggle-thumb {
  transform: translateX(20px);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-primary {
  background: var(--color-primary);
  color: var(--color-bg);
  padding: 0.625rem 1.25rem;
  border-radius: var(--border-radius-sm);
  font-weight: 600;
  transition: all var(--transition-fast);
  min-height: 40px;
  min-width: 80px;
}

.btn-primary:hover {
  transform: translateY(-1px);
  opacity: 0.9;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
  padding: 0.625rem 1.25rem;
  border-radius: var(--border-radius-sm);
  font-weight: 500;
  transition: all var(--transition-fast);
  min-height: 40px;
  min-width: 80px;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 480px) {
  .theme-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .color-grid {
    grid-template-columns: 1fr;
  }

  .modal-footer {
    flex-direction: column-reverse;
  }

  .modal-footer button {
    width: 100%;
  }
}

@media (max-width: 360px) {
  .modal-container {
    padding: 1rem;
  }

  .theme-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .theme-preview {
    height: 36px;
  }

  .theme-name {
    font-size: 0.7rem;
  }

  .modal-title {
    font-size: 1.1rem;
  }
}

.danger-zone {
  border-top: 1px solid rgba(255, 68, 102, 0.2);
  padding-top: 0.75rem;
}

.danger-title {
  color: var(--color-danger);
}

.danger-desc {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin: 0;
}

.danger-btn {
  background: rgba(255, 68, 102, 0.1);
  color: var(--color-danger);
  border: 1px solid rgba(255, 68, 102, 0.3);
  padding: 0.625rem 1rem;
  border-radius: var(--border-radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  transition: all var(--transition-fast);
  width: 100%;
  min-height: 40px;
}

.danger-btn:hover:not(:disabled) {
  background: rgba(255, 68, 102, 0.2);
  border-color: var(--color-danger);
}

.danger-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 1rem;
}

.confirm-dialog {
  background: var(--color-surface);
  border-radius: var(--border-radius);
  padding: 1.5rem;
  max-width: 400px;
  width: 100%;
  box-shadow: var(--shadow-elevated);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.confirm-title {
  font-size: 1.125rem;
  margin-bottom: 0.75rem;
  color: var(--color-danger);
}

.confirm-message {
  font-size: 0.95rem;
  color: var(--color-text);
  margin-bottom: 1.25rem;
  line-height: 1.5;
}

.confirm-message strong {
  color: var(--color-danger);
}

.confirm-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.confirm-cancel,
.confirm-ok {
  padding: 0.625rem 1.25rem;
  border-radius: var(--border-radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  transition: all var(--transition-fast);
}

.confirm-cancel {
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.confirm-cancel:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.confirm-ok {
  background: var(--color-danger);
  color: #fff;
}

.confirm-ok:hover:not(:disabled) {
  opacity: 0.9;
}

.confirm-cancel:disabled,
.confirm-ok:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .confirm-dialog,
.modal-fade-leave-active .confirm-dialog {
  transition: transform 0.2s ease;
}

.modal-fade-enter-from .confirm-dialog,
.modal-fade-leave-to .confirm-dialog {
  transform: scale(0.95);
}
</style>

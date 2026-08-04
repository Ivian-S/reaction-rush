<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useApi } from '@/composables/useApi'

const emit = defineEmits<{
  (e: 'submit', nickname: string, confirmed: boolean): void
  (e: 'cancel'): void
}>()

const props = defineProps<{
  modelValue: boolean
  initialNickname?: string
}>()

const api = useApi()

const nickname = ref(props.initialNickname || '')
const step = ref<'input' | 'checking' | 'confirm'>('input')
const error = ref('')
const dialogRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const validationMessage = computed(() => {
  const raw = nickname.value
  if (!raw || raw.trim().length === 0) return ''
  const trimmed = raw.trim()
  if (trimmed.length < 1 || trimmed.length > 12) return '昵称长度 1-12 位'
  if (!/^[\u4e00-\u9fa5a-zA-Z0-9]+$/.test(trimmed)) return '仅支持中文、英文和数字'
  return ''
})

const isValidFormat = computed(() => {
  const n = nickname.value.trim()
  if (!n) return false
  if (n.length < 1 || n.length > 12) return false
  return /^[\u4e00-\u9fa5a-zA-Z0-9]+$/.test(n)
})

watch(() => props.modelValue, (val) => {
  if (val) {
    nickname.value = props.initialNickname || ''
    step.value = 'input'
    error.value = ''
    document.dispatchEvent(new CustomEvent('modal-opening', { detail: true }))
    nextTick(() => {
      inputRef.value?.focus()
    })
  } else {
    document.dispatchEvent(new CustomEvent('modal-opening', { detail: false }))
  }
})

onUnmounted(() => {
  document.dispatchEvent(new CustomEvent('modal-opening', { detail: false }))
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

function handleKeydown(e: KeyboardEvent) {
  if (e.code === 'Escape' && props.modelValue) {
    handleCancel()
  }
}

async function handleSubmit() {
  if (!isValidFormat.value) {
    error.value = '昵称长度 1-12 位，支持中文、英文和数字'
    return
  }

  error.value = ''
  step.value = 'checking'

  const result = await api.checkNickname(nickname.value.trim())

  if (result === null) {
    emit('submit', nickname.value.trim(), false)
    return
  }

  if (result.exists) {
    step.value = 'confirm'
  } else {
    emit('submit', nickname.value.trim(), false)
  }
}

function confirmExisting() {
  emit('submit', nickname.value.trim(), true)
}

function goBack() {
  step.value = 'input'
}

function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-overlay" @click.self="handleCancel" role="dialog" aria-modal="true" aria-label="输入昵称">
      <div ref="dialogRef" class="modal-container">
        <div class="modal-header">
          <h2 class="modal-title">
            {{ step === 'confirm' ? '昵称已存在' : '输入昵称' }}
          </h2>
          <button class="close-btn" @click="handleCancel" aria-label="关闭弹窗">✕</button>
        </div>

        <div class="modal-body">
          <template v-if="step === 'input'">
            <p class="modal-desc">请输入昵称用于排行榜展示</p>
            <input
              ref="inputRef"
              v-model="nickname"
              type="text"
              class="nickname-input"
              placeholder="1-12 位，支持中英文和数字"
              maxlength="12"
              @keyup.enter="handleSubmit"
              aria-label="昵称输入框"
            />
            <p v-if="validationMessage" class="error-text" role="alert">{{ validationMessage }}</p>
            <p v-else-if="error" class="error-text" role="alert">{{ error }}</p>
            <p class="hint-text">{{ nickname.trim().length }}/12</p>
          </template>

          <template v-else-if="step === 'checking'">
            <div class="checking-state">
              <div class="spinner" />
              <p>正在检查昵称...</p>
            </div>
          </template>

          <template v-else-if="step === 'confirm'">
            <p class="modal-desc">
              该昵称 <strong>{{ nickname }}</strong> 已经存在，是否继续使用并挑战原纪录？
            </p>
            <div class="confirm-actions">
              <button class="btn-secondary" @click="goBack">返回修改</button>
              <button class="btn-primary" @click="confirmExisting">确认使用</button>
            </div>
          </template>
        </div>

        <div v-if="step === 'input'" class="modal-footer">
          <button class="btn-secondary" @click="handleCancel">取消</button>
          <button
            class="btn-primary"
            :disabled="!isValidFormat"
            @click="handleSubmit"
          >
            开始游戏
          </button>
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
  max-width: 400px;
  box-shadow: var(--shadow-elevated);
  border: 1px solid rgba(255, 255, 255, 0.1);
  animation: slideUp 0.3s ease;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
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
  color: var(--color-text);
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
  margin-bottom: 1.25rem;
}

.modal-desc {
  color: var(--color-text-secondary);
  margin-bottom: 1rem;
  line-height: 1.5;
}

.modal-desc strong {
  color: var(--color-primary);
}

.nickname-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--color-bg);
  border: 2px solid transparent;
  border-radius: var(--border-radius-sm);
  color: var(--color-text);
  font-size: 1rem;
  transition: border-color var(--transition-fast);
}

.nickname-input:focus {
  border-color: var(--color-primary);
}

.error-text {
  color: var(--color-danger);
  margin-top: 0.5rem;
  font-size: 0.875rem;
}

.hint-text {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  margin-top: 0.5rem;
  text-align: right;
}

.checking-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem 0;
  color: var(--color-text-secondary);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-text-secondary);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.confirm-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-primary {
  background: var(--color-primary);
  color: var(--color-bg);
  padding: 0.625rem 1.25rem;
  border-radius: var(--border-radius-sm);
  font-weight: 600;
  font-size: 0.95rem;
  transition: all var(--transition-fast);
  min-height: 40px;
  min-width: 80px;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
  padding: 0.625rem 1.25rem;
  border-radius: var(--border-radius-sm);
  font-weight: 500;
  font-size: 0.95rem;
  transition: all var(--transition-fast);
  min-height: 40px;
  min-width: 80px;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.2);
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
  .modal-container {
    padding: 1.25rem;
  }

  .modal-footer,
  .confirm-actions {
    flex-direction: column-reverse;
  }

  .modal-footer button,
  .confirm-actions button {
    width: 100%;
  }
}

@media (max-width: 360px) {
  .modal-container {
    padding: 1rem;
  }

  .modal-title {
    font-size: 1.1rem;
  }

  .nickname-input {
    padding: 0.625rem 0.75rem;
    font-size: 0.95rem;
  }
}
</style>

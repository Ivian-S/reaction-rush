const NICKNAME_REGEX = /^[\u4e00-\u9fa5a-zA-Z0-9]+$/

export function validateNickname(raw: string): { valid: boolean; nickname: string; key: string; error?: string } {
  const trimmed = raw.trim()

  if (trimmed.length === 0) {
    return { valid: false, nickname: '', key: '', error: '昵称不能为空' }
  }

  if (trimmed.length > 12) {
    return { valid: false, nickname: trimmed, key: '', error: '昵称长度不能超过 12 个字符' }
  }

  if (!NICKNAME_REGEX.test(trimmed)) {
    return { valid: false, nickname: trimmed, key: '', error: '昵称只能包含中文、英文和数字' }
  }

  return { valid: true, nickname: trimmed, key: trimmed.toLowerCase() }
}
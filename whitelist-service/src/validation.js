export function normalizeUuid(value) {
  if (typeof value !== 'string') return null
  const normalized = value.replaceAll('-', '').toLowerCase()
  return /^[0-9a-f]{32}$/u.test(normalized) ? normalized : null
}

export function formatUuid(value) {
  const normalized = normalizeUuid(value)
  if (!normalized) return ''
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`
}

export function normalizeUsername(value) {
  if (typeof value !== 'string') return null
  const username = value.trim()
  return /^[A-Za-z0-9_]{3,16}$/u.test(username) ? username : null
}

export function normalizeServerCode(value) {
  if (typeof value !== 'string') return null
  const code = value.trim().toLowerCase()
  return /^[a-z0-9][a-z0-9_-]{1,31}$/u.test(code) ? code : null
}

export function cleanText(value, maxLength, required = false) {
  if (typeof value !== 'string') return required ? null : ''
  const text = value.trim()
  if ((required && text.length === 0) || text.length > maxLength) return null
  return text
}

export function cleanBoolean(value) {
  return typeof value === 'boolean' ? value : null
}

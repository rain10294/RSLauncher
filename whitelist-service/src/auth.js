const encoder = new TextEncoder()

function bytesToBase64(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '')
}

function base64UrlToBytes(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((value.length + 3) % 4)
  return base64ToBytes(padded)
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false

  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index]
  }
  return difference === 0
}

async function derivePassword(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256
  )
  return new Uint8Array(bits)
}

export async function hashPassword(password, iterations = 210000) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
    throw new Error('비밀번호는 8~256자로 설정해 주세요.')
  }

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derivePassword(password, salt, iterations)
  return `pbkdf2$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`
}

export async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false

  const [algorithm, iterationText, saltText, hashText, extra] = storedHash.split('$')
  const iterations = Number.parseInt(iterationText, 10)
  if (
    algorithm !== 'pbkdf2' ||
    extra !== undefined ||
    !Number.isSafeInteger(iterations) ||
    iterations < 100000 ||
    iterations > 1000000
  ) {
    return false
  }

  try {
    const expected = base64ToBytes(hashText)
    const actual = await derivePassword(password, base64ToBytes(saltText), iterations)
    return safeEqual(actual, expected)
  } catch {
    return false
  }
}

async function digestSecret(value) {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', encoder.encode(value.normalize('NFC')))
  )
}

export async function verifySecretPassword(password, storedPassword) {
  if (
    typeof password !== 'string' ||
    typeof storedPassword !== 'string' ||
    password.length < 8 ||
    password.length > 256
  ) {
    return false
  }

  return safeEqual(
    await digestSecret(password),
    await digestSecret(storedPassword)
  )
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

export async function createSessionToken(secret, ttlSeconds, nowSeconds = Math.floor(Date.now() / 1000)) {
  const payload = bytesToBase64Url(
    encoder.encode(JSON.stringify({ version: 1, expiresAt: nowSeconds + ttlSeconds }))
  )
  const signature = bytesToBase64Url(await sign(payload, secret))
  return `${payload}.${signature}`
}

export async function verifySessionToken(token, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string' || typeof secret !== 'string' || secret.length < 32) return false

  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) return false

  try {
    const expectedSignature = await sign(payload, secret)
    if (!safeEqual(base64UrlToBytes(signature), expectedSignature)) return false

    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)))
    return session.version === 1 && Number.isSafeInteger(session.expiresAt) && session.expiresAt > nowSeconds
  } catch {
    return false
  }
}

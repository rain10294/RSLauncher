import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import test from 'node:test'
import {
  createSessionToken,
  hashPassword,
  verifySecretPassword,
  verifyPassword,
  verifySessionToken
} from '../src/auth.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto

test('원하는 비밀번호를 해시하고 검증한다', async () => {
  const hash = await hashPassword('test-password-123', 100000)
  assert.match(hash, /^pbkdf2\$100000\$/u)
  assert.equal(await verifyPassword('test-password-123', hash), true)
  assert.equal(await verifyPassword('wrong-password', hash), false)
})

test('서명된 세션은 만료 전까지만 유효하다', async () => {
  const secret = 'a-secure-session-secret-that-is-longer-than-32-characters'
  const token = await createSessionToken(secret, 3600, 1000)
  assert.equal(await verifySessionToken(token, secret, 2000), true)
  assert.equal(await verifySessionToken(token, secret, 5000), false)
  assert.equal(await verifySessionToken(`${token}x`, secret, 2000), false)
})

test('짧은 비밀번호를 거부한다', async () => {
  await assert.rejects(() => hashPassword('short'), /8~256/u)
})

test('Cloudflare Secret 비밀번호를 고정 길이 다이제스트로 비교한다', async () => {
  assert.equal(await verifySecretPassword('관리자-password-123', '관리자-password-123'), true)
  assert.equal(await verifySecretPassword('관리자-password-123', '다른-password-123'), false)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cleanText,
  formatUuid,
  normalizeServerCode,
  normalizeUsername,
  normalizeUuid
} from '../src/validation.js'
import { resolveMinecraftProfile } from '../src/mojang.js'

test('UUID의 하이픈 유무와 대소문자를 정규화한다', () => {
  const compact = '069A79F444E94726A5BEFCA90E38AFCB'
  assert.equal(normalizeUuid(compact), compact.toLowerCase())
  assert.equal(
    formatUuid(compact),
    '069a79f4-44e9-4726-a5be-fca90e38afcb'
  )
  assert.equal(normalizeUuid('invalid'), null)
})

test('마인크래프트 아이디와 서버 코드를 검증한다', () => {
  assert.equal(normalizeUsername(' Notch '), 'Notch')
  assert.equal(normalizeUsername('공백 이름'), null)
  assert.equal(normalizeServerCode(' CobbleMon_01 '), 'cobblemon_01')
  assert.equal(normalizeServerCode('-invalid'), null)
  assert.equal(cleanText(' 설명 ', 20), '설명')
})

test('Mojang 프로필 응답에서 UUID를 가져온다', async () => {
  const fakeFetch = async () => new Response(JSON.stringify({
    id: '069a79f444e94726a5befca90e38afcb',
    name: 'Notch'
  }), { status: 200 })
  const profile = await resolveMinecraftProfile('Notch', fakeFetch)
  assert.deepEqual(profile, {
    ok: true,
    uuid: '069a79f444e94726a5befca90e38afcb',
    username: 'Notch'
  })
})

test('존재하지 않는 Mojang 프로필을 구분한다', async () => {
  const fakeFetch = async () => new Response(null, { status: 204 })
  assert.deepEqual(await resolveMinecraftProfile('NoSuchPlayer', fakeFetch), {
    ok: false,
    error: 'minecraft_account_not_found'
  })
})

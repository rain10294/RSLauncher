const baseUrl = process.env.RS_WHITELIST_TEST_URL || 'http://localhost:8788'
const password = process.env.RS_WHITELIST_TEST_PASSWORD

if (!password) {
  console.error('RS_WHITELIST_TEST_PASSWORD 환경 변수에 로컬 테스트 비밀번호를 넣어 주세요.')
  process.exit(1)
}

async function request(path, options = {}, cookie = '') {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Origin: baseUrl,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(options.headers || {})
    }
  })
  const data = await response.json()
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(data)}`)
  return { response, data }
}

const health = await request('/api/health')
if (!health.data.configured) throw new Error('로컬 Secret이 설정되지 않았습니다.')

const login = await request('/api/admin/login', {
  method: 'POST',
  body: JSON.stringify({ password })
})
const cookie = (login.response.headers.get('set-cookie') || '').split(';', 1)[0]
if (!cookie) throw new Error('로그인 쿠키를 받지 못했습니다.')

const code = `smoke-${Date.now().toString(36)}`
const created = await request('/api/admin/servers', {
  method: 'POST',
  body: JSON.stringify({ code, name: '자동 점검 서버', description: '실행 후 자동 삭제됩니다.' })
}, cookie)
const serverId = created.data.server.id

try {
  const before = await request('/api/v1/check', {
    method: 'POST',
    body: JSON.stringify({
      serverId: code,
      uuid: '069a79f4-44e9-4726-a5be-fca90e38afcb'
    })
  })
  if (before.data.allowed) throw new Error('등록 전 계정이 허용되었습니다.')

  const added = await request(`/api/admin/servers/${serverId}/entries`, {
    method: 'POST',
    body: JSON.stringify({ username: 'Notch', note: '자동 점검' })
  }, cookie)
  if (added.data.entry.username !== 'Notch') throw new Error('UUID 프로필 조회 결과가 올바르지 않습니다.')

  const after = await request('/api/v1/check', {
    method: 'POST',
    body: JSON.stringify({ serverId: code, uuid: added.data.entry.uuid })
  })
  if (!after.data.allowed) throw new Error(`등록 후 검사가 거부되었습니다: ${after.data.reason}`)

  console.log('로그인 → 서버 생성 → UUID 등록 → 화이트리스트 허용 검사가 모두 통과했습니다.')
} finally {
  await request(`/api/admin/servers/${serverId}`, { method: 'DELETE' }, cookie)
}

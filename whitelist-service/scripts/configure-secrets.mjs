import { spawnSync } from 'node:child_process'
import { randomBytes, webcrypto } from 'node:crypto'
import { fileURLToPath } from 'node:url'

if (!globalThis.crypto) globalThis.crypto = webcrypto

async function readHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    console.error('대화형 터미널이 아닙니다. RS_ADMIN_PASSWORD 환경 변수를 사용해 주세요.')
    process.exit(1)
  }

  process.stdout.write(prompt)
  process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  return new Promise((resolve, reject) => {
    let value = ''
    const finish = () => {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdout.write('\n')
      process.stdin.off('data', onData)
      resolve(value)
    }
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          process.stdin.setRawMode(false)
          process.stdout.write('\n')
          reject(new Error('사용자가 취소했습니다.'))
          return
        }
        if (character === '\r' || character === '\n') {
          finish()
          return
        }
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1)
          continue
        }
        if (character >= ' ') value += character
      }
    }
    process.stdin.on('data', onData)
  })
}

const password = process.env.RS_ADMIN_PASSWORD || await readHidden('원하는 관리자 비밀번호(입력 내용 숨김): ')
if (!process.env.RS_ADMIN_PASSWORD) {
  const confirmation = await readHidden('비밀번호 다시 입력: ')
  if (password !== confirmation) {
    console.error('두 비밀번호가 일치하지 않습니다.')
    process.exit(1)
  }
}

if (password.length < 8 || password.length > 256) {
  console.error('관리자 비밀번호는 8~256자로 설정해 주세요.')
  process.exit(1)
}

const projectDirectory = fileURLToPath(new URL('..', import.meta.url))
const wranglerCli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url))

function putSecret(name, value) {
  const result = spawnSync(process.execPath, [wranglerCli, 'secret', 'put', name], {
    cwd: projectDirectory,
    input: `${value}\n`,
    encoding: 'utf8',
    stdio: ['pipe', 'inherit', 'inherit'],
    windowsHide: true
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}

async function verifyRemoteLogin(passwordToVerify) {
  const baseUrl = (process.env.RS_WHITELIST_ADMIN_URL || 'https://rslauncher-whitelist.rain10294.workers.dev')
    .replace(/\/+$/u, '')
  let invalidPasswordResponses = 0
  let lastError = 'unknown'

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, attempt === 1 ? 5000 : 2000))
    const response = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: {
        Origin: baseUrl,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: passwordToVerify })
    })
    if (response.ok) return

    const result = await response.json().catch(() => ({}))
    lastError = result.error || String(response.status)
    if (result.error === 'invalid_password') {
      invalidPasswordResponses += 1
      if (invalidPasswordResponses >= 2) break
    } else if (!['service_not_configured', 'internal_error'].includes(result.error)) {
      break
    }
  }
  throw new Error(`저장된 비밀번호로 실제 사이트에 로그인하지 못했습니다. (${lastError})`)
}

console.log('관리자 비밀번호를 Cloudflare 암호화 Secret에 저장하고 있습니다...')
putSecret('ADMIN_PASSWORD', password.normalize('NFC'))

console.log('로그인 세션 암호화 키를 만들고 있습니다...')
putSecret('SESSION_SECRET', randomBytes(48).toString('base64url'))

console.log('실제 관리자 사이트 로그인을 확인하고 있습니다...')
await verifyRemoteLogin(password)
console.log('Cloudflare Secret 설정과 실제 로그인 검증이 완료되었습니다.')

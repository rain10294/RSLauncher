import { spawnSync } from 'node:child_process'
import { randomBytes, webcrypto } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { hashPassword } from '../src/auth.js'

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

console.log('관리자 비밀번호를 안전한 해시로 변환하고 있습니다...')
putSecret('ADMIN_PASSWORD_HASH', await hashPassword(password))

console.log('로그인 세션 암호화 키를 만들고 있습니다...')
putSecret('SESSION_SECRET', randomBytes(48).toString('base64url'))

console.log('Cloudflare Secret 설정이 완료되었습니다.')

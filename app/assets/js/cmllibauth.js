const { spawn } = require('child_process')
const crypto = require('crypto')
const fs = require('fs-extra')
const path = require('path')

const MAX_OUTPUT_SIZE = 1024 * 1024

class CmlLibAuthError extends Error {
    constructor(code, message) {
        super(message)
        this.name = 'CmlLibAuthError'
        this.code = code
    }
}

class CmlLibAuthService {
    constructor(electronApp, projectRoot) {
        this.app = electronApp
        this.projectRoot = projectRoot
        this.accountDirectory = path.join(this.app.getPath('userData'), 'cmllib-auth')
    }

    getExecutablePath() {
        if(this.app.isPackaged) {
            return path.join(process.resourcesPath, 'auth-helper', 'RSLauncher.Auth.exe')
        }
        return path.join(this.projectRoot, 'auth-helper', 'publish', 'RSLauncher.Auth.exe')
    }

    async login(clientId) {
        await fs.ensureDir(this.accountDirectory)
        const pendingFile = path.join(this.accountDirectory, `pending-${crypto.randomUUID()}.json`)

        try {
            const result = await this.run(this.createAuthArguments('login', clientId, pendingFile))
            const uuid = this.normalizeUuid(result.account?.uuid)
            if(!uuid) {
                throw new CmlLibAuthError('invalid_response', 'Minecraft 계정 UUID를 받지 못했습니다.')
            }

            const accountFile = `${uuid}.json`
            await fs.move(pendingFile, path.join(this.accountDirectory, accountFile), { overwrite: true })
            return { account: result.account, accountFile }
        } catch(error) {
            await fs.remove(pendingFile).catch(() => undefined)
            throw error
        }
    }

    async refresh(clientId, uuid, accountFile) {
        const safeFile = this.resolveAccountFile(accountFile)
        const result = await this.run([
            ...this.createAuthArguments('refresh', clientId, safeFile),
            '--uuid', this.normalizeUuid(uuid)
        ])
        return result.account
    }

    async logout(clientId, uuid, accountFile) {
        const safeFile = this.resolveAccountFile(accountFile)
        try {
            await this.run([
                ...this.createAuthArguments('logout', clientId, safeFile),
                '--uuid', this.normalizeUuid(uuid)
            ])
        } finally {
            await fs.remove(safeFile).catch(() => undefined)
        }
    }

    resolveAccountFile(accountFile) {
        if(typeof accountFile !== 'string' || !/^[a-f0-9]{32}\.json$/i.test(accountFile)) {
            throw new CmlLibAuthError('invalid_account', '저장된 Microsoft 계정 파일이 올바르지 않습니다.')
        }
        return path.join(this.accountDirectory, accountFile)
    }

    normalizeUuid(uuid) {
        return typeof uuid === 'string' ? uuid.replaceAll('-', '').trim().toLowerCase() : ''
    }

    createAuthArguments(command, clientId, accountFile) {
        const arguments_ = [command, '--account-file', accountFile]
        if(clientId) {
            arguments_.push('--client-id', clientId)
        } else {
            arguments_.push('--use-default-client', 'true')
        }
        return arguments_
    }

    run(arguments_) {
        const executable = this.getExecutablePath()
        if(!fs.existsSync(executable)) {
            return Promise.reject(new CmlLibAuthError(
                'helper_missing',
                'CmlLib 로그인 구성요소가 없습니다. 런처를 다시 설치해주세요.'
            ))
        }

        return new Promise((resolve, reject) => {
            const child = spawn(executable, arguments_, {
                windowsHide: false,
                stdio: ['ignore', 'pipe', 'pipe']
            })
            let stdout = ''
            let stderrSize = 0

            child.stdout.setEncoding('utf8')
            child.stdout.on('data', chunk => {
                if(stdout.length + chunk.length <= MAX_OUTPUT_SIZE) {
                    stdout += chunk
                }
            })
            child.stderr.on('data', chunk => {
                stderrSize += chunk.length
            })
            child.on('error', error => {
                reject(new CmlLibAuthError('helper_start_failed', error.message))
            })
            child.on('close', () => {
                try {
                    const lines = stdout.trim().split(/\r?\n/).filter(Boolean)
                    const result = JSON.parse(lines.at(-1) || '{}')
                    if(result.success) {
                        resolve(result)
                        return
                    }
                    reject(new CmlLibAuthError(
                        result.error?.code || 'authentication_failed',
                        result.error?.message || (stderrSize > 0
                            ? 'Microsoft 로그인 구성요소에서 오류가 발생했습니다.'
                            : 'Microsoft 로그인에 실패했습니다.')
                    ))
                } catch(_error) {
                    reject(new CmlLibAuthError('invalid_response', 'Microsoft 로그인 응답을 읽지 못했습니다.'))
                }
            })
        })
    }
}

module.exports = { CmlLibAuthService, CmlLibAuthError }

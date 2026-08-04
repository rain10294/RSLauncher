const childProcess = require('child_process')
const fs = require('fs-extra')
const { LoggerUtil } = require('helios-core')
const { Type } = require('helios-distribution-types')
const path = require('path')

const logger = LoggerUtil.getLogger('NeoForgeInstaller')

function getConfigManager() {
    return require('./configmanager')
}

function getNeoForgeModule(server) {
    return server.modules.find((module) => {
        const id = module.rawModule.id || ''
        return module.rawModule.type === Type.Forge && id.startsWith('net.neoforged:neoforge:')
    })
}

function getNeoForgeVersion(module) {
    return module.getMavenComponents().version
}

function getInstallPaths(module) {
    const version = getNeoForgeVersion(module)
    const ConfigManager = getConfigManager()
    const commonDir = ConfigManager.getCommonDirectory()
    return {
        commonDir,
        version,
        manifest: path.join(commonDir, 'versions', `neoforge-${version}`, `neoforge-${version}.json`),
        patchedClient: path.join(commonDir, 'libraries', 'net', 'neoforged', 'neoforge', version, `neoforge-${version}-client.jar`)
    }
}

function resolveJavaExecutable(serverId) {
    const ConfigManager = getConfigManager()
    const configured = ConfigManager.getJavaExecutable(serverId)
    if (!configured) {
        throw new Error('NeoForge 설치에 사용할 Java 실행 파일을 찾지 못했습니다.')
    }
    if (configured.toLowerCase().endsWith('javaw.exe')) {
        return configured.slice(0, -9) + 'java.exe'
    }
    if (configured.toLowerCase().endsWith('javaw')) {
        return configured.slice(0, -5) + 'java'
    }
    return configured
}

async function ensureInstalled(server) {
    const module = getNeoForgeModule(server)
    if (!module) {
        return false
    }

    const installPaths = getInstallPaths(module)
    if (await fs.pathExists(installPaths.manifest) && await fs.pathExists(installPaths.patchedClient)) {
        return false
    }

    const launcherProfiles = path.join(installPaths.commonDir, 'launcher_profiles.json')
    if (!await fs.pathExists(launcherProfiles)) {
        await fs.ensureDir(installPaths.commonDir)
        await fs.writeJson(launcherProfiles, { profiles: {}, settings: {}, version: 3 }, { spaces: 2 })
    }

    const javaExecutable = resolveJavaExecutable(server.rawServer.id)
    if (!await fs.pathExists(javaExecutable)) {
        throw new Error(`NeoForge 설치용 Java를 찾지 못했습니다: ${javaExecutable}`)
    }

    logger.info(`Installing NeoForge ${installPaths.version}.`)
    await new Promise((resolve, reject) => {
        const installer = childProcess.spawn(javaExecutable, [
            '-jar',
            module.getPath(),
            '--install-client',
            installPaths.commonDir
        ], {
            cwd: installPaths.commonDir,
            detached: false,
            windowsHide: true
        })

        installer.stdout.setEncoding('utf8')
        installer.stderr.setEncoding('utf8')
        installer.stdout.on('data', (data) => logger.info(data.trim()))
        installer.stderr.on('data', (data) => logger.warn(data.trim()))
        installer.on('error', reject)
        installer.on('close', (code) => {
            if (code === 0) {
                resolve()
            } else {
                reject(new Error(`NeoForge 설치기가 종료 코드 ${code}로 끝났습니다.`))
            }
        })
    })

    if (!await fs.pathExists(installPaths.manifest) || !await fs.pathExists(installPaths.patchedClient)) {
        throw new Error('NeoForge 설치가 완료됐지만 필요한 실행 파일을 찾지 못했습니다.')
    }

    return true
}

async function loadVersionManifest(server) {
    const module = getNeoForgeModule(server)
    if (!module) {
        return null
    }
    return fs.readJson(getInstallPaths(module).manifest, { encoding: 'utf8' })
}

module.exports = {
    ensureInstalled,
    getNeoForgeModule,
    loadVersionManifest
}

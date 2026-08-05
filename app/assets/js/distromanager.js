const { DistributionAPI } = require('helios-core/common')
const fs = require('fs-extra')
const path = require('path')

const ConfigManager = require('./configmanager')
const launcherConfig = require('../config/launcher.json')

const configuredDistroUrl = process.env.RSLAUNCHER_DISTRIBUTION_URL || launcherConfig.distributionUrl
const hasRemoteDistribution = typeof configuredDistroUrl === 'string' && configuredDistroUrl.trim().length > 0

// A bundled Fabric profile keeps development builds usable before an operator
// publishes the complete RSLauncher modpack distribution index.
const bundledDistroPath = path.join(__dirname, '..', 'distribution.json')
const launcherDirectory = ConfigManager.getLauncherDirectory()
const localDistroPath = path.join(launcherDirectory, 'distribution.json')
const localDevDistroPath = path.join(launcherDirectory, 'distribution_dev.json')

fs.ensureDirSync(launcherDirectory)
if(!hasRemoteDistribution) {
    // The bundled file is the source of truth when no remote distribution is
    // configured. Refresh both caches on every launcher start so an updated
    // launcher never keeps showing a distribution from an older installation.
    fs.copyFileSync(bundledDistroPath, localDistroPath)
    fs.copyFileSync(bundledDistroPath, localDevDistroPath)
} else {
    if(!fs.existsSync(localDistroPath)) {
        fs.copyFileSync(bundledDistroPath, localDistroPath)
    }
    if(!fs.existsSync(localDevDistroPath)) {
        fs.copyFileSync(bundledDistroPath, localDevDistroPath)
    }
}

exports.REMOTE_DISTRO_URL = hasRemoteDistribution
    ? configuredDistroUrl.trim()
    : 'https://localhost.invalid/rslauncher/distribution.json'

const api = new DistributionAPI(
    launcherDirectory,
    null, // Injected forcefully by the preloader.
    null, // Injected forcefully by the preloader.
    exports.REMOTE_DISTRO_URL,
    !hasRemoteDistribution
)

exports.DistroAPI = api

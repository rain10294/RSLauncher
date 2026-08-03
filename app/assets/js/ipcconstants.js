const launcherConfig = require('../config/launcher.json')

// Never reuse another launcher's Microsoft application ID. Configure an app
// registration in launcher.json or through this environment variable.
exports.AZURE_CLIENT_ID = process.env.RSLAUNCHER_AZURE_CLIENT_ID || launcherConfig.azureClientId || null

// Keep updates disabled until an RSLauncher-owned update endpoint is provided.
// This prevents a branded build from inheriting the upstream Helios release feed.
exports.UPDATE_URL = process.env.RSLAUNCHER_UPDATE_URL || launcherConfig.updateUrl || null
exports.AUTO_UPDATE_ENABLED = Boolean(exports.UPDATE_URL)


// Opcodes
exports.MSFT_OPCODE = {
    OPEN_LOGIN: 'MSFT_AUTH_OPEN_LOGIN',
    OPEN_LOGOUT: 'MSFT_AUTH_OPEN_LOGOUT',
    REPLY_LOGIN: 'MSFT_AUTH_REPLY_LOGIN',
    REPLY_LOGOUT: 'MSFT_AUTH_REPLY_LOGOUT'
}
// Reply types for REPLY opcode.
exports.MSFT_REPLY_TYPE = {
    SUCCESS: 'MSFT_AUTH_REPLY_SUCCESS',
    ERROR: 'MSFT_AUTH_REPLY_ERROR'
}
// Error types for ERROR reply.
exports.MSFT_ERROR = {
    ALREADY_OPEN: 'MSFT_AUTH_ERR_ALREADY_OPEN',
    NOT_FINISHED: 'MSFT_AUTH_ERR_NOT_FINISHED',
    CONFIG_REQUIRED: 'MSFT_AUTH_ERR_CONFIG_REQUIRED'
}

exports.SHELL_OPCODE = {
    TRASH_ITEM: 'TRASH_ITEM'
}

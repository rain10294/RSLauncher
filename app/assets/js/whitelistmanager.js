const got = require('got')
const launcherConfig = require('../config/launcher.json')

const whitelistConfig = launcherConfig.whitelist || {}
const configuredApiUrl = process.env.RSLAUNCHER_WHITELIST_API_URL || whitelistConfig.apiUrl || ''

function getApiUrl(){
    const value = configuredApiUrl.trim().replace(/\/+$/u, '')
    if(value.length === 0){
        throw new Error('Whitelist API URL is not configured.')
    }

    const parsed = new URL(value)
    if(parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)){
        throw new Error('Whitelist API URL must use HTTPS.')
    }
    return value
}

function getTimeout(){
    const configured = Number.parseInt(whitelistConfig.timeoutMs, 10)
    return Number.isSafeInteger(configured) && configured >= 1000 && configured <= 30000
        ? configured
        : 8000
}

function getServerCode(serverId){
    const mapping = whitelistConfig.serverCodes || {}
    const mapped = mapping[serverId]
    return typeof mapped === 'string' && mapped.trim().length > 0
        ? mapped.trim()
        : serverId.toLowerCase()
}

exports.isEnabled = function(){
    return whitelistConfig.enabled === true
}

exports.checkAccess = async function(serverId, uuid){
    if(!exports.isEnabled()){
        return { allowed: true, reason: 'disabled' }
    }
    if(typeof serverId !== 'string' || serverId.trim().length === 0){
        throw new Error('No server is selected for the whitelist check.')
    }
    if(typeof uuid !== 'string' || uuid.trim().length === 0){
        return { allowed: false, reason: 'account_unavailable' }
    }

    const response = await got.post(`${getApiUrl()}/api/v1/check`, {
        json: {
            serverId: getServerCode(serverId.trim()),
            uuid: uuid.trim()
        },
        responseType: 'json',
        timeout: { request: getTimeout() },
        retry: { limit: 0 },
        followRedirect: false,
        headers: { Accept: 'application/json' }
    })

    const result = response.body
    if(result == null || typeof result.allowed !== 'boolean' || typeof result.reason !== 'string'){
        throw new Error('Whitelist API returned an invalid response.')
    }
    return result
}

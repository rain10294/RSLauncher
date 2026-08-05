/**
 * Core UI functions are initialized in this file. This prevents
 * unexpected errors from breaking the core features. Specifically,
 * actions in this file should not require the usage of any internal
 * modules, excluding dependencies.
 */
// Requirements
const $                              = require('jquery')
const {ipcRenderer, shell, webFrame} = require('electron')
const remote                         = require('@electron/remote')
const isDev                          = require('./assets/js/isdev')
const { LoggerUtil }                 = require('helios-core')
const Lang                           = require('./assets/js/langloader')
const { AUTO_UPDATE_ENABLED }        = require('./assets/js/ipcconstants')

const loggerUICore             = LoggerUtil.getLogger('UICore')
const loggerAutoUpdater        = LoggerUtil.getLogger('AutoUpdater')

// Log deprecation and process warnings.
process.traceProcessWarnings = true
process.traceDeprecation = true

// Disable eval function.
window.eval = global.eval = function () {
    throw new Error('Sorry, this app does not support window.eval().')
}

// Display warning when devtools window is opened.
remote.getCurrentWebContents().on('devtools-opened', () => {
    console.log('%cThe console is dark and full of terrors.', 'color: white; -webkit-text-stroke: 4px #a02d2a; font-size: 60px; font-weight: bold')
    console.log('%cIf you\'ve been told to paste something here, you\'re being scammed.', 'font-size: 16px')
    console.log('%cUnless you know exactly what you\'re doing, close this window.', 'font-size: 16px')
})

// Disable zoom, needed for darwin.
webFrame.setZoomLevel(0)
webFrame.setVisualZoomLevelLimits(1, 1)

// Initialize auto updates in production environments.
let updateCheckListener
const launcherUpdateState = {
    status: !isDev && AUTO_UPDATE_ENABLED ? 'checking' : 'disabled',
    info: null,
    progress: 0,
    initialCheckComplete: isDev || !AUTO_UPDATE_ENABLED,
    launchBlocked: !isDev && AUTO_UPDATE_ENABLED,
    downloadRequested: false,
    lastError: null
}

window.RSLauncherUpdate = {
    isLaunchBlocked: () => launcherUpdateState.launchBlocked,
    getStatus: () => launcherUpdateState.status,
    getInfo: () => launcherUpdateState.info,
    openPrompt: () => {
        if(launcherUpdateState.info != null){
            showUpdateUI(launcherUpdateState.info, true)
        }
    },
    checkForUpdates: () => requestUpdateCheck()
}

function applyLauncherUpdateLock(){
    if(typeof window.applyUpdateLaunchLock === 'function'){
        window.applyUpdateLaunchLock()
        return
    }

    const launchButton = document.getElementById('launch_button')
    if(launchButton != null && launcherUpdateState.launchBlocked){
        launchButton.disabled = true
    }
}

function setLauncherUpdateState(status, launchBlocked){
    launcherUpdateState.status = status
    launcherUpdateState.launchBlocked = launchBlocked
    applyLauncherUpdateLock()
    refreshLandingUpdateButton()
}

function requestUpdateCheck(){
    if(isDev || !AUTO_UPDATE_ENABLED || launcherUpdateState.status === 'downloading' || launcherUpdateState.status === 'downloaded'){
        return
    }

    launcherUpdateState.lastError = null
    const shouldBlockLaunch = !launcherUpdateState.initialCheckComplete || launcherUpdateState.info != null
    setLauncherUpdateState('checking', shouldBlockLaunch)
    ipcRenderer.send('autoUpdateAction', 'checkForUpdate')
}

function beginUpdateDownload(){
    if(isDev || !AUTO_UPDATE_ENABLED || launcherUpdateState.info == null || launcherUpdateState.status === 'downloading'){
        return
    }

    launcherUpdateState.downloadRequested = true
    launcherUpdateState.lastError = null
    launcherUpdateState.progress = 0
    setLauncherUpdateState('downloading', true)
    refreshOpenUpdatePrompt()
    ipcRenderer.send('autoUpdateAction', 'downloadUpdate')
}

function refreshLandingUpdateButton(){
    const button = document.getElementById('landingUpdateButton')
    const label = document.getElementById('landingUpdateButtonText')
    const icon = button?.querySelector('.landingUpdateIcon')
    if(button == null || label == null || icon == null){
        return
    }

    button.hidden = launcherUpdateState.status === 'disabled'
    button.dataset.state = launcherUpdateState.status
    button.disabled = false

    switch(launcherUpdateState.status){
        case 'checking':
            icon.textContent = '↻'
            label.textContent = Lang.queryJS('uicore.autoUpdate.landingUpdateChecking')
            button.disabled = true
            button.title = Lang.queryJS('uicore.autoUpdate.checkingForUpdateButton')
            break
        case 'available':
            icon.textContent = '↑'
            label.textContent = Lang.queryJS('uicore.autoUpdate.landingUpdateAvailable', {
                version: launcherUpdateState.info?.version || ''
            })
            button.title = Lang.queryJS('uicore.autoUpdate.launchBlockedTooltip')
            button.onclick = () => showUpdateUI(launcherUpdateState.info, true)
            break
        case 'downloading':
            icon.textContent = '↓'
            label.textContent = Lang.queryJS('uicore.autoUpdate.landingUpdateDownloading', {
                percent: Math.round(launcherUpdateState.progress)
            })
            button.title = Lang.queryJS('uicore.autoUpdate.downloadingMessage')
            button.onclick = () => showUpdateUI(launcherUpdateState.info, true)
            break
        case 'downloaded':
            icon.textContent = '✓'
            label.textContent = Lang.queryJS('uicore.autoUpdate.landingUpdateInstalling')
            button.disabled = true
            button.title = Lang.queryJS('uicore.autoUpdate.installingButton')
            break
        case 'error':
            icon.textContent = '!'
            label.textContent = Lang.queryJS('uicore.autoUpdate.landingUpdateRetry')
            button.title = Lang.queryJS('uicore.autoUpdate.updateCheckFailed')
            button.onclick = () => requestUpdateCheck()
            break
        default:
            icon.textContent = '↻'
            label.textContent = Lang.queryJS('uicore.autoUpdate.checkForUpdatesButton')
            button.title = Lang.queryJS('uicore.autoUpdate.landingUpdateCurrent')
            button.onclick = () => requestUpdateCheck()
            break
    }
}

if(!isDev && AUTO_UPDATE_ENABLED){
    ipcRenderer.on('autoUpdateNotification', (event, arg, info) => {
        switch(arg){
            case 'checking-for-update':
                loggerAutoUpdater.info('Checking for update..')
                setLauncherUpdateState('checking', !launcherUpdateState.initialCheckComplete || launcherUpdateState.info != null)
                settingsUpdateButtonStatus(Lang.queryJS('uicore.autoUpdate.checkingForUpdateButton'), true)
                break
            case 'update-available':
                loggerAutoUpdater.info('New update available', info.version)
                launcherUpdateState.info = info
                launcherUpdateState.initialCheckComplete = true
                launcherUpdateState.downloadRequested = false
                setLauncherUpdateState('available', true)
                populateSettingsUpdateInformation(info)
                settingsUpdateButtonStatus(Lang.queryJS('uicore.autoUpdate.installNowButton'), false, () => {
                    showUpdateUI(info, true)
                })
                showUpdateUI(info)
                break
            case 'update-download-started':
                setLauncherUpdateState('downloading', true)
                refreshOpenUpdatePrompt()
                break
            case 'download-progress':
                launcherUpdateState.progress = Number.isFinite(info?.percent) ? info.percent : 0
                setLauncherUpdateState('downloading', true)
                settingsUpdateButtonStatus(Lang.queryJS('uicore.autoUpdate.landingUpdateDownloading', {
                    percent: Math.round(launcherUpdateState.progress)
                }), true)
                refreshOpenUpdatePrompt()
                break
            case 'update-downloaded':
                loggerAutoUpdater.info('Update ' + info.version + ' ready to be installed.')
                launcherUpdateState.info = info
                launcherUpdateState.progress = 100
                setLauncherUpdateState('downloaded', true)
                settingsUpdateButtonStatus(Lang.queryJS('uicore.autoUpdate.installingButton'), true)
                refreshOpenUpdatePrompt()
                if(launcherUpdateState.downloadRequested){
                    setTimeout(() => {
                        ipcRenderer.send('autoUpdateAction', 'installUpdateNow')
                    }, 600)
                }
                break
            case 'update-not-available':
                loggerAutoUpdater.info('No new update found.')
                launcherUpdateState.info = null
                launcherUpdateState.initialCheckComplete = true
                launcherUpdateState.downloadRequested = false
                setLauncherUpdateState('current', false)
                clearUpdateIndicator()
                populateSettingsUpdateInformation(null)
                break
            case 'ready':
                if(updateCheckListener != null){
                    clearInterval(updateCheckListener)
                }
                updateCheckListener = setInterval(() => {
                    requestUpdateCheck()
                }, 1800000)
                requestUpdateCheck()
                break
            case 'realerror':
                launcherUpdateState.lastError = info
                if(launcherUpdateState.info != null){
                    loggerAutoUpdater.error('Error while downloading update.', info)
                    launcherUpdateState.downloadRequested = false
                    setLauncherUpdateState('available', true)
                    settingsUpdateButtonStatus(Lang.queryJS('uicore.autoUpdate.installNowButton'), false, () => {
                        showUpdateUI(launcherUpdateState.info, true)
                    })
                    refreshOpenUpdatePrompt()
                } else {
                    launcherUpdateState.initialCheckComplete = true
                    setLauncherUpdateState('error', false)
                    settingsUpdateButtonStatus(Lang.queryJS('uicore.autoUpdate.landingUpdateRetry'), false, () => {
                        requestUpdateCheck()
                    })
                    if(info != null && info.code != null){
                        if(info.code === 'ERR_UPDATER_INVALID_RELEASE_FEED'){
                            loggerAutoUpdater.info('No suitable releases found.')
                        } else if(info.code === 'ERR_XML_MISSED_ELEMENT'){
                            loggerAutoUpdater.info('No releases found.')
                        } else {
                            loggerAutoUpdater.error('Error during update check..', info)
                            loggerAutoUpdater.debug('Error Code:', info.code)
                        }
                    }
                }
                break
            case 'disabled':
                launcherUpdateState.initialCheckComplete = true
                setLauncherUpdateState('disabled', false)
                break
            default:
                loggerAutoUpdater.info('Unknown argument', arg)
                break
        }
    })
}

/**
 * Send a notification to the main process changing the value of
 * allowPrerelease. If we are running a prerelease version, then
 * this will always be set to true, regardless of the current value
 * of val.
 * 
 * @param {boolean} val The new allow prerelease value.
 */
function changeAllowPrerelease(val){
    ipcRenderer.send('autoUpdateAction', 'allowPrereleaseChange', val)
}

let promptedUpdateVersion

function clearUpdateIndicator(){
    const updateIndicator = document.getElementById('image_seal_container')
    if(updateIndicator != null){
        updateIndicator.removeAttribute('update')
        updateIndicator.onclick = null
    }
}

function renderUpdatePrompt(){
    const info = launcherUpdateState.info
    const overlayContent = document.getElementById('overlayContent')
    const acknowledgeButton = document.getElementById('overlayAcknowledge')
    if(info == null || overlayContent == null || acknowledgeButton == null){
        return
    }

    const updateVersion = info.version || ''
    let description = Lang.queryJS('uicore.autoUpdate.promptMessage', {
        currentVersion: remote.app.getVersion(),
        newVersion: updateVersion,
        targetVersion: updateVersion
    })
    let acknowledgeText = Lang.queryJS('uicore.autoUpdate.installNowButton')
    let acknowledgeDisabled = false

    if(launcherUpdateState.status === 'downloading'){
        description += '<br><span class="rsUpdateDownloadStatus">' + Lang.queryJS('uicore.autoUpdate.downloadingMessage') + '</span>'
        acknowledgeText = Lang.queryJS('uicore.autoUpdate.landingUpdateDownloading', {
            percent: Math.round(launcherUpdateState.progress)
        })
        acknowledgeDisabled = true
    } else if(launcherUpdateState.status === 'downloaded'){
        description += '<br><span class="rsUpdateDownloadStatus">' + Lang.queryJS('uicore.autoUpdate.installingMessage') + '</span>'
        acknowledgeText = Lang.queryJS('uicore.autoUpdate.installingButton')
        acknowledgeDisabled = true
    } else if(launcherUpdateState.lastError != null){
        description += '<br><span class="rsUpdateDownloadError">' + Lang.queryJS('uicore.autoUpdate.downloadFailed') + '</span>'
    }

    overlayContent.setAttribute('data-dialog', 'update')
    setOverlayContent(
        Lang.queryJS('uicore.autoUpdate.promptTitle'),
        description,
        acknowledgeText,
        Lang.queryJS('uicore.autoUpdate.laterButton')
    )
    acknowledgeButton.disabled = acknowledgeDisabled
    setOverlayHandler(() => {
        beginUpdateDownload()
    })
    setDismissHandler(() => {
        overlayContent.removeAttribute('data-dialog')
        toggleOverlay(false, true)
    })
}

function refreshOpenUpdatePrompt(){
    const overlayContent = document.getElementById('overlayContent')
    if(overlayContent?.getAttribute('data-dialog') === 'update' && isOverlayVisible()){
        renderUpdatePrompt()
    }
}

function showUpdateUI(info, forceOpen = false){
    if(info == null){
        return
    }

    launcherUpdateState.info = info
    const updateVersion = info.version || ''
    const updateIndicator = document.getElementById('image_seal_container')

    const openUpdatePrompt = () => {
        renderUpdatePrompt()
        toggleOverlay(true, true)
    }

    if(updateIndicator != null){
        updateIndicator.setAttribute('update', true)
        updateIndicator.onclick = openUpdatePrompt
    }

    if(forceOpen || (promptedUpdateVersion !== updateVersion && !isOverlayVisible())){
        promptedUpdateVersion = updateVersion
        openUpdatePrompt()
    }
}

/* jQuery Example
$(function(){
    loggerUICore.info('UICore Initialized');
})*/

document.addEventListener('readystatechange', function () {
    if (document.readyState === 'interactive'){
        loggerUICore.info('UICore Initializing..')

        // Bind close button.
        Array.from(document.getElementsByClassName('fCb')).map((val) => {
            val.addEventListener('click', e => {
                const window = remote.getCurrentWindow()
                window.close()
            })
        })

        // Bind restore down button.
        Array.from(document.getElementsByClassName('fRb')).map((val) => {
            val.addEventListener('click', e => {
                const window = remote.getCurrentWindow()
                if(window.isMaximized()){
                    window.unmaximize()
                } else {
                    window.maximize()
                }
                document.activeElement.blur()
            })
        })

        // Bind minimize button.
        Array.from(document.getElementsByClassName('fMb')).map((val) => {
            val.addEventListener('click', e => {
                const window = remote.getCurrentWindow()
                window.minimize()
                document.activeElement.blur()
            })
        })

        // Remove focus from social media buttons once they're clicked.
        Array.from(document.getElementsByClassName('mediaURL')).map(val => {
            val.addEventListener('click', e => {
                document.activeElement.blur()
            })
        })

    } else if(document.readyState === 'complete'){

        //266.01
        //170.8
        //53.21
        // Bind progress bar length to length of bot wrapper
        //const targetWidth = document.getElementById("launch_content").getBoundingClientRect().width
        //const targetWidth2 = document.getElementById("server_selection").getBoundingClientRect().width
        //const targetWidth3 = document.getElementById("launch_button").getBoundingClientRect().width

        document.getElementById('launch_details').style.maxWidth = 266.01
        document.getElementById('launch_progress').style.width = 170.8
        document.getElementById('launch_details_right').style.maxWidth = 170.8
        document.getElementById('launch_progress_label').style.width = 53.21
        
    }

}, false)

/**
 * Open web links in the user's default browser.
 */
$(document).on('click', 'a[href^="http"]', function(event) {
    event.preventDefault()
    shell.openExternal(this.href)
})

/**
 * Opens DevTools window if you hold (ctrl + shift + i).
 * This will crash the program if you are using multiple
 * DevTools, for example the chrome debugger in VS Code. 
 */
document.addEventListener('keydown', function (e) {
    if((e.key === 'I' || e.key === 'i') && e.ctrlKey && e.shiftKey){
        let window = remote.getCurrentWindow()
        window.toggleDevTools()
    }
})

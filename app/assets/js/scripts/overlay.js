/**
 * Script for overlay.ejs
 */

/* Overlay Wrapper Functions */

/**
 * Check to see if the overlay is visible.
 * 
 * @returns {boolean} Whether or not the overlay is visible.
 */
function isOverlayVisible(){
    return document.getElementById('main').hasAttribute('overlay')
}

let overlayHandlerContent

/**
 * Overlay keydown handler for a non-dismissable overlay.
 * 
 * @param {KeyboardEvent} e The keydown event.
 */
function overlayKeyHandler (e){
    if(e.key === 'Enter' || e.key === 'Escape'){
        document.getElementById(overlayHandlerContent).getElementsByClassName('overlayKeybindEnter')[0].click()
    }
}
/**
 * Overlay keydown handler for a dismissable overlay.
 * 
 * @param {KeyboardEvent} e The keydown event.
 */
function overlayKeyDismissableHandler (e){
    if(e.key === 'Enter'){
        document.getElementById(overlayHandlerContent).getElementsByClassName('overlayKeybindEnter')[0].click()
    } else if(e.key === 'Escape'){
        document.getElementById(overlayHandlerContent).getElementsByClassName('overlayKeybindEsc')[0].click()
    }
}

/**
 * Bind overlay keydown listeners for escape and exit.
 * 
 * @param {boolean} state Whether or not to add new event listeners.
 * @param {string} content The overlay content which will be shown.
 * @param {boolean} dismissable Whether or not the overlay is dismissable 
 */
function bindOverlayKeys(state, content, dismissable){
    overlayHandlerContent = content
    document.removeEventListener('keydown', overlayKeyHandler)
    document.removeEventListener('keydown', overlayKeyDismissableHandler)
    if(state){
        if(dismissable){
            document.addEventListener('keydown', overlayKeyDismissableHandler)
        } else {
            document.addEventListener('keydown', overlayKeyHandler)
        }
    }
}

/**
 * Toggle the visibility of the overlay.
 * 
 * @param {boolean} toggleState True to display, false to hide.
 * @param {boolean} dismissable Optional. True to show the dismiss option, otherwise false.
 * @param {string} content Optional. The content div to be shown.
 */
function toggleOverlay(toggleState, dismissable = false, content = 'overlayContent'){
    if(toggleState == null){
        toggleState = !document.getElementById('main').hasAttribute('overlay')
    }
    if(typeof dismissable === 'string'){
        content = dismissable
        dismissable = false
    }
    bindOverlayKeys(toggleState, content, dismissable)
    if(toggleState){
        document.getElementById('main').setAttribute('overlay', true)
        // Make things untabbable.
        $('#main *').attr('tabindex', '-1')
        $('#' + content).parent().children().hide()
        $('#' + content).show()
        if(dismissable){
            $('#overlayDismiss').show()
        } else {
            $('#overlayDismiss').hide()
        }
        $('#overlayContainer').fadeIn({
            duration: 250,
            start: () => {
                if(getCurrentView() === VIEWS.settings){
                    document.getElementById('settingsContainer').style.backgroundColor = 'transparent'
                }
            }
        })
    } else {
        document.getElementById('main').removeAttribute('overlay')
        // Make things tabbable.
        $('#main *').removeAttr('tabindex')
        $('#overlayContainer').fadeOut({
            duration: 250,
            start: () => {
                if(getCurrentView() === VIEWS.settings){
                    document.getElementById('settingsContainer').style.backgroundColor = 'rgba(0, 0, 0, 0.50)'
                }
            },
            complete: () => {
                $('#' + content).parent().children().hide()
                $('#' + content).show()
                if(dismissable){
                    $('#overlayDismiss').show()
                } else {
                    $('#overlayDismiss').hide()
                }
            }
        })
    }
}

async function toggleServerSelection(toggleState){
    await prepareServerSelectionList()
    toggleOverlay(toggleState, true, 'serverSelectContent')
}

/**
 * Set the content of the overlay.
 * 
 * @param {string} title Overlay title text.
 * @param {string} description Overlay description text.
 * @param {string} acknowledge Acknowledge button text.
 * @param {string} dismiss Dismiss button text.
 */
function setOverlayContent(title, description, acknowledge, dismiss = Lang.queryJS('overlay.dismiss')){
    document.getElementById('overlayTitle').innerHTML = title
    document.getElementById('overlayDesc').innerHTML = description
    document.getElementById('overlayAcknowledge').innerHTML = acknowledge
    document.getElementById('overlayDismiss').innerHTML = dismiss
}

/**
 * Set the onclick handler of the overlay acknowledge button.
 * If the handler is null, a default handler will be added.
 * 
 * @param {function} handler 
 */
function setOverlayHandler(handler){
    if(handler == null){
        document.getElementById('overlayAcknowledge').onclick = () => {
            toggleOverlay(false)
        }
    } else {
        document.getElementById('overlayAcknowledge').onclick = handler
    }
}

/**
 * Set the onclick handler of the overlay dismiss button.
 * If the handler is null, a default handler will be added.
 * 
 * @param {function} handler 
 */
function setDismissHandler(handler){
    if(handler == null){
        document.getElementById('overlayDismiss').onclick = () => {
            toggleOverlay(false)
        }
    } else {
        document.getElementById('overlayDismiss').onclick = handler
    }
}

/* Server Select View */

document.getElementById('serverSelectConfirm').addEventListener('click', async () => {
    const listings = document.getElementsByClassName('serverListing')
    for(let i=0; i<listings.length; i++){
        if(listings[i].hasAttribute('selected')){
            const serv = (await DistroAPI.getDistribution()).getServerById(listings[i].getAttribute('servid'))
            updateSelectedServer(serv)
            refreshServerStatus(true)
            toggleOverlay(false)
            return
        }
    }
    // None are selected? Not possible right? Meh, handle it.
    if(listings.length > 0){
        const serv = (await DistroAPI.getDistribution()).getServerById(listings[0].getAttribute('servid'))
        updateSelectedServer(serv)
        refreshServerStatus(true)
        toggleOverlay(false)
    }
})

document.getElementById('accountSelectConfirm').addEventListener('click', async () => {
    const listings = document.getElementsByClassName('accountListing')
    for(let i=0; i<listings.length; i++){
        if(listings[i].hasAttribute('selected')){
            const authAcc = ConfigManager.setSelectedAccount(listings[i].getAttribute('uuid'))
            ConfigManager.save()
            updateSelectedAccount(authAcc)
            if(getCurrentView() === VIEWS.settings) {
                await prepareSettings()
            }
            toggleOverlay(false)
            validateSelectedAccount()
            return
        }
    }
    // None are selected? Not possible right? Meh, handle it.
    if(listings.length > 0){
        const authAcc = ConfigManager.setSelectedAccount(listings[0].getAttribute('uuid'))
        ConfigManager.save()
        updateSelectedAccount(authAcc)
        if(getCurrentView() === VIEWS.settings) {
            await prepareSettings()
        }
        toggleOverlay(false)
        validateSelectedAccount()
    }
})

// Bind server select cancel button.
document.getElementById('serverSelectCancel').addEventListener('click', () => {
    toggleOverlay(false)
})

document.getElementById('accountSelectCancel').addEventListener('click', () => {
    $('#accountSelectContent').fadeOut(250, () => {
        $('#overlayContent').fadeIn(250)
    })
})

function setServerListingHandlers(){
    const listings = Array.from(document.getElementsByClassName('serverListing'))
    listings.map((val) => {
        val.onclick = e => {
            if(val.hasAttribute('selected')){
                return
            }
            const cListings = document.getElementsByClassName('serverListing')
            for(let i=0; i<cListings.length; i++){
                if(cListings[i].hasAttribute('selected')){
                    cListings[i].removeAttribute('selected')
                    cListings[i].setAttribute('aria-pressed', 'false')
                }
            }
            val.setAttribute('selected', '')
            val.setAttribute('aria-pressed', 'true')
            document.activeElement.blur()
        }
    })
}

function setAccountListingHandlers(){
    const listings = Array.from(document.getElementsByClassName('accountListing'))
    listings.map((val) => {
        val.onclick = e => {
            if(val.hasAttribute('selected')){
                return
            }
            const cListings = document.getElementsByClassName('accountListing')
            for(let i=0; i<cListings.length; i++){
                if(cListings[i].hasAttribute('selected')){
                    cListings[i].removeAttribute('selected')
                }
            }
            val.setAttribute('selected', '')
            document.activeElement.blur()
        }
    })
}

function escapeServerListingText(value){
    return String(value == null ? '' : value)
        .replace(/&/gu, '&amp;')
        .replace(/</gu, '&lt;')
        .replace(/>/gu, '&gt;')
        .replace(/"/gu, '&quot;')
        .replace(/'/gu, '&#039;')
}

function getServerLoaderLabel(serv){
    const modules = Array.isArray(serv.modules) ? serv.modules : []
    const rawModules = modules.map(module => module.rawModule || {})
    if(rawModules.some(module => module.type === 'Forge' && String(module.id || '').startsWith('net.neoforged:neoforge:'))){
        return 'NeoForge'
    }
    if(rawModules.some(module => module.type === 'Fabric')){
        return 'Fabric'
    }
    if(rawModules.some(module => module.type === 'Forge')){
        return 'Forge'
    }
    return 'Vanilla'
}

function isWhitelistServer(){
    return typeof WhitelistManager !== 'undefined' && WhitelistManager.isEnabled()
}

function findServerListing(serverId){
    return Array.from(document.getElementsByClassName('serverListing'))
        .find(listing => listing.getAttribute('servid') === serverId)
}

async function refreshServerListingStatus(serv){
    const listing = findServerListing(serv.rawServer.id)
    const status = listing == null ? null : listing.querySelector('.serverListingStatus')
    const statusText = status == null ? null : status.querySelector('.serverListingStatusText')
    if(status == null || statusText == null){
        return
    }

    try {
        const servStat = await getServerStatus(47, serv.hostname, serv.port)
        status.setAttribute('data-state', 'online')
        statusText.textContent = `${Lang.queryJS('overlay.serverSelect.online')} · ${servStat.players.online}/${servStat.players.max}`
    } catch (err) {
        status.setAttribute('data-state', 'offline')
        statusText.textContent = Lang.queryJS('overlay.serverSelect.offline')
    }
}

async function populateServerListings(){
    const distro = await DistroAPI.getDistribution()
    const giaSel = ConfigManager.getSelectedServer()
    const servers = distro.servers
    let htmlString = ''
    for(const serv of servers){
        const rawServer = serv.rawServer
        const selected = rawServer.id === giaSel
        const serverName = escapeServerListingText(rawServer.name)
        const serverIcon = String(rawServer.icon || '').trim()
        const iconMarkup = serverIcon.length > 0
            ? `<img class="serverListingImg" src="${escapeServerListingText(serverIcon)}" alt=""/>`
            : `<span class="serverListingFallback" aria-hidden="true">${escapeServerListingText(String(rawServer.name || 'S').charAt(0).toUpperCase())}</span>`
        const mainBadge = rawServer.mainServer
            ? `<span class="serverListingBadge serverListingBadgeMain">${Lang.queryJS('overlay.serverSelect.main')}</span>`
            : ''
        const whitelistBadge = isWhitelistServer()
            ? `<span class="serverListingBadge serverListingBadgeWhitelist">${Lang.queryJS('overlay.serverSelect.whitelist')}</span>`
            : ''

        htmlString += `<button class="serverListing" servid="${escapeServerListingText(rawServer.id)}" ${selected ? 'selected' : ''} aria-pressed="${selected}">
            <span class="serverListingIcon">${iconMarkup}</span>
            <span class="serverListingDetails">
                <span class="serverListingTopline">
                    <span class="serverListingName">${serverName}</span>
                    <span class="serverListingStatus" data-state="checking">
                        <i aria-hidden="true"></i>
                        <span class="serverListingStatusText">${Lang.queryJS('overlay.serverSelect.checking')}</span>
                    </span>
                </span>
                <span class="serverListingDescription">${escapeServerListingText(rawServer.description)}</span>
                <span class="serverListingInfo">
                    <span class="serverListingBadge">MC ${escapeServerListingText(rawServer.minecraftVersion)}</span>
                    <span class="serverListingBadge">${getServerLoaderLabel(serv)}</span>
                    ${mainBadge}
                    ${whitelistBadge}
                </span>
            </span>
            <span class="serverListingSelectedMark" aria-hidden="true">✓</span>
        </button>`
    }
    document.getElementById('serverSelectListScrollable').innerHTML = htmlString
    for(const serv of servers){
        void refreshServerListingStatus(serv)
    }
}

function populateAccountListings(){
    const accountsObj = ConfigManager.getAuthAccounts()
    const accounts = Array.from(Object.keys(accountsObj), v=>accountsObj[v])
    let htmlString = ''
    for(let i=0; i<accounts.length; i++){
        htmlString += `<button class="accountListing" uuid="${accounts[i].uuid}" ${i===0 ? 'selected' : ''}>
            <img src="https://mc-heads.net/head/${accounts[i].uuid}/40">
            <div class="accountListingName">${accounts[i].displayName}</div>
        </button>`
    }
    document.getElementById('accountSelectListScrollable').innerHTML = htmlString

}

async function prepareServerSelectionList(){
    await populateServerListings()
    setServerListingHandlers()
}

function prepareAccountSelectionList(){
    populateAccountListings()
    setAccountListingHandlers()
}

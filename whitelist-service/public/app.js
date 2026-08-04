const elements = {
  loginView: document.querySelector('#loginView'),
  dashboardView: document.querySelector('#dashboardView'),
  loginForm: document.querySelector('#loginForm'),
  password: document.querySelector('#password'),
  loginMessage: document.querySelector('#loginMessage'),
  logoutButton: document.querySelector('#logoutButton'),
  serverList: document.querySelector('#serverList'),
  emptyServer: document.querySelector('#emptyServer'),
  serverDetail: document.querySelector('#serverDetail'),
  selectedServerName: document.querySelector('#selectedServerName'),
  selectedServerStatus: document.querySelector('#selectedServerStatus'),
  selectedServerDescription: document.querySelector('#selectedServerDescription'),
  selectedServerCode: document.querySelector('#selectedServerCode'),
  totalEntryCount: document.querySelector('#totalEntryCount'),
  enabledEntryCount: document.querySelector('#enabledEntryCount'),
  toggleServerButton: document.querySelector('#toggleServerButton'),
  deleteServerButton: document.querySelector('#deleteServerButton'),
  editServerButton: document.querySelector('#editServerButton'),
  copyServerCodeButton: document.querySelector('#copyServerCodeButton'),
  showCreateServerButton: document.querySelector('#showCreateServerButton'),
  serverDialog: document.querySelector('#serverDialog'),
  serverDialogTitle: document.querySelector('#serverDialogTitle'),
  serverForm: document.querySelector('#serverForm'),
  serverEditId: document.querySelector('#serverEditId'),
  serverCodeGroup: document.querySelector('#serverCodeGroup'),
  serverCode: document.querySelector('#serverCode'),
  serverName: document.querySelector('#serverName'),
  serverDescription: document.querySelector('#serverDescription'),
  closeServerDialogButton: document.querySelector('#closeServerDialogButton'),
  cancelServerDialogButton: document.querySelector('#cancelServerDialogButton'),
  addEntryForm: document.querySelector('#addEntryForm'),
  minecraftUsername: document.querySelector('#minecraftUsername'),
  entryNote: document.querySelector('#entryNote'),
  entrySearch: document.querySelector('#entrySearch'),
  entryTableBody: document.querySelector('#entryTableBody'),
  emptyEntries: document.querySelector('#emptyEntries'),
  toast: document.querySelector('#toast')
}

const state = {
  servers: [],
  selectedServerId: null,
  entries: [],
  searchTimer: null
}

const errorMessages = {
  service_not_configured: 'Cloudflare 관리자 비밀번호가 아직 설정되지 않았습니다.',
  invalid_origin: '보안 확인에 실패했습니다. 페이지를 새로고침해 주세요.',
  invalid_password: '비밀번호가 올바르지 않습니다.',
  too_many_attempts: '로그인 시도가 너무 많습니다. 15분 뒤 다시 시도해 주세요.',
  authentication_required: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  invalid_server: '서버 이름과 코드를 확인해 주세요.',
  server_code_exists: '이미 사용 중인 서버 코드입니다.',
  server_not_found: '서버를 찾을 수 없습니다.',
  minecraft_account_not_found: '해당 마인크래프트 Java 아이디를 찾을 수 없습니다.',
  profile_service_unavailable: '마인크래프트 계정 조회 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  invalid_username: '마인크래프트 아이디 형식을 확인해 주세요.',
  entry_not_found: '등록 정보를 찾을 수 없습니다.',
  invalid_request: '입력한 내용을 확인해 주세요.',
  internal_error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (options.body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers,
    body: options.body === undefined || typeof options.body === 'string'
      ? options.body
      : JSON.stringify(options.body)
  })

  let payload
  try {
    payload = await response.json()
  } catch {
    payload = { error: 'internal_error' }
  }

  if (!response.ok) {
    const error = new Error(errorMessages[payload.error] || `요청에 실패했습니다. (${response.status})`)
    error.code = payload.error
    if (payload.error === 'authentication_required') showLogin('로그인이 만료되었습니다.')
    throw error
  }
  return payload
}

function showLogin(message = '') {
  elements.dashboardView.hidden = true
  elements.loginView.hidden = false
  elements.loginMessage.textContent = message
  elements.password.value = ''
  elements.password.focus()
}

function showDashboard() {
  elements.loginView.hidden = true
  elements.dashboardView.hidden = false
  elements.loginMessage.textContent = ''
}

let toastTimer
function toast(message, isError = false) {
  clearTimeout(toastTimer)
  elements.toast.textContent = message
  elements.toast.classList.toggle('error', isError)
  elements.toast.classList.add('visible')
  toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 2800)
}

function selectedServer() {
  return state.servers.find((server) => server.id === state.selectedServerId) || null
}

function renderServerList() {
  elements.serverList.replaceChildren()
  for (const server of state.servers) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `server-item${server.id === state.selectedServerId ? ' selected' : ''}`

    const dot = document.createElement('span')
    dot.className = `server-dot${server.enabled ? ' enabled' : ''}`

    const labels = document.createElement('span')
    const name = document.createElement('strong')
    name.textContent = server.name
    const details = document.createElement('small')
    details.textContent = `${server.enabledEntryCount}명 플레이 가능`
    labels.append(name, details)
    button.append(dot, labels)
    button.addEventListener('click', () => selectServer(server.id))
    elements.serverList.append(button)
  }
}

function renderSelectedServer() {
  const server = selectedServer()
  elements.emptyServer.hidden = Boolean(server)
  elements.serverDetail.hidden = !server
  if (!server) return

  elements.selectedServerName.textContent = server.name
  elements.selectedServerStatus.textContent = server.enabled ? '운영 중' : '검사 중지'
  elements.selectedServerStatus.className = `status${server.enabled ? ' enabled' : ''}`
  elements.selectedServerDescription.textContent = server.description || '등록된 설명이 없습니다.'
  elements.selectedServerCode.textContent = server.code
  elements.totalEntryCount.textContent = String(server.entryCount)
  elements.enabledEntryCount.textContent = String(server.enabledEntryCount)
  elements.toggleServerButton.textContent = server.enabled ? '서버 검사 중지' : '서버 검사 시작'
}

async function loadServers(preferredServerId = state.selectedServerId) {
  const payload = await api('/api/admin/servers')
  state.servers = payload.servers
  state.selectedServerId = state.servers.some((server) => server.id === preferredServerId)
    ? preferredServerId
    : state.servers[0]?.id || null
  renderServerList()
  renderSelectedServer()
  if (state.selectedServerId) await loadEntries()
  else renderEntries()
}

async function selectServer(serverId) {
  if (serverId === state.selectedServerId) return
  state.selectedServerId = serverId
  elements.entrySearch.value = ''
  renderServerList()
  renderSelectedServer()
  await loadEntries()
}

async function loadEntries() {
  if (!state.selectedServerId) {
    state.entries = []
    renderEntries()
    return
  }

  const query = elements.entrySearch.value.trim()
  const payload = await api(
    `/api/admin/servers/${encodeURIComponent(state.selectedServerId)}/entries?search=${encodeURIComponent(query)}`
  )
  state.entries = payload.entries
  renderEntries()
}

function createEntryButton(label, className, handler) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  if (className) button.className = className
  button.addEventListener('click', handler)
  return button
}

function renderEntries() {
  elements.entryTableBody.replaceChildren()
  elements.emptyEntries.hidden = state.entries.length > 0

  for (const entry of state.entries) {
    const row = document.createElement('tr')

    const usernameCell = document.createElement('td')
    usernameCell.className = 'player-name'
    usernameCell.textContent = entry.username

    const uuidCell = document.createElement('td')
    const uuid = document.createElement('code')
    uuid.textContent = entry.uuid
    uuidCell.append(uuid)

    const noteCell = document.createElement('td')
    noteCell.textContent = entry.note || '—'

    const statusCell = document.createElement('td')
    statusCell.className = `entry-state${entry.enabled ? ' enabled' : ''}`
    statusCell.textContent = entry.enabled ? '허용' : '중지'

    const actionCell = document.createElement('td')
    const actions = document.createElement('div')
    actions.className = 'entry-actions'
    actions.append(
      createEntryButton('메모', 'ghost', () => editEntryNote(entry)),
      createEntryButton(entry.enabled ? '중지' : '허용', 'ghost', () => toggleEntry(entry)),
      createEntryButton('삭제', 'danger-ghost', () => removeEntry(entry))
    )
    actionCell.append(actions)
    row.append(usernameCell, uuidCell, noteCell, statusCell, actionCell)
    elements.entryTableBody.append(row)
  }
}

async function toggleEntry(entry) {
  try {
    await api(`/api/admin/entries/${entry.id}`, {
      method: 'PATCH',
      body: { enabled: !entry.enabled }
    })
    await loadServers()
    toast(`${entry.username} 플레이 권한을 ${entry.enabled ? '중지했습니다.' : '허용했습니다.'}`)
  } catch (error) {
    toast(error.message, true)
  }
}

async function editEntryNote(entry) {
  const note = window.prompt(`${entry.username} 메모`, entry.note)
  if (note === null || note === entry.note) return
  try {
    await api(`/api/admin/entries/${entry.id}`, { method: 'PATCH', body: { note } })
    await loadEntries()
    toast('메모를 저장했습니다.')
  } catch (error) {
    toast(error.message, true)
  }
}

async function removeEntry(entry) {
  if (!window.confirm(`${entry.username}을(를) 이 서버 화이트리스트에서 삭제할까요?`)) return
  try {
    await api(`/api/admin/entries/${entry.id}`, { method: 'DELETE' })
    await loadServers()
    toast(`${entry.username}을(를) 삭제했습니다.`)
  } catch (error) {
    toast(error.message, true)
  }
}

function openCreateServerDialog() {
  elements.serverDialogTitle.textContent = '서버 추가'
  elements.serverEditId.value = ''
  elements.serverName.value = ''
  elements.serverCode.value = ''
  elements.serverDescription.value = ''
  elements.serverCodeGroup.hidden = false
  elements.serverCode.required = true
  elements.serverDialog.showModal()
  elements.serverName.focus()
}

function openEditServerDialog() {
  const server = selectedServer()
  if (!server) return
  elements.serverDialogTitle.textContent = '서버 정보 수정'
  elements.serverEditId.value = server.id
  elements.serverName.value = server.name
  elements.serverCode.value = server.code
  elements.serverDescription.value = server.description
  elements.serverCodeGroup.hidden = true
  elements.serverCode.required = false
  elements.serverDialog.showModal()
  elements.serverName.focus()
}

function closeServerDialog() {
  elements.serverDialog.close()
}

elements.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const submitButton = elements.loginForm.querySelector('button[type="submit"]')
  submitButton.disabled = true
  elements.loginMessage.textContent = ''
  try {
    await api('/api/admin/login', { method: 'POST', body: { password: elements.password.value } })
    showDashboard()
    await loadServers()
  } catch (error) {
    elements.loginMessage.textContent = error.message
  } finally {
    submitButton.disabled = false
  }
})

elements.logoutButton.addEventListener('click', async () => {
  try {
    await api('/api/admin/logout', { method: 'POST', body: {} })
  } finally {
    showLogin('로그아웃했습니다.')
  }
})

elements.showCreateServerButton.addEventListener('click', openCreateServerDialog)
elements.editServerButton.addEventListener('click', openEditServerDialog)
elements.closeServerDialogButton.addEventListener('click', closeServerDialog)
elements.cancelServerDialogButton.addEventListener('click', closeServerDialog)

elements.serverForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const submitButton = elements.serverForm.querySelector('button[type="submit"]')
  submitButton.disabled = true
  const editId = elements.serverEditId.value
  try {
    if (editId) {
      await api(`/api/admin/servers/${encodeURIComponent(editId)}`, {
        method: 'PATCH',
        body: { name: elements.serverName.value, description: elements.serverDescription.value }
      })
      await loadServers(editId)
      toast('서버 정보를 수정했습니다.')
    } else {
      const payload = await api('/api/admin/servers', {
        method: 'POST',
        body: {
          name: elements.serverName.value,
          code: elements.serverCode.value,
          description: elements.serverDescription.value
        }
      })
      await loadServers(payload.server.id)
      toast('서버를 추가했습니다.')
    }
    closeServerDialog()
  } catch (error) {
    toast(error.message, true)
  } finally {
    submitButton.disabled = false
  }
})

elements.toggleServerButton.addEventListener('click', async () => {
  const server = selectedServer()
  if (!server) return
  try {
    await api(`/api/admin/servers/${encodeURIComponent(server.id)}`, {
      method: 'PATCH',
      body: { enabled: !server.enabled }
    })
    await loadServers(server.id)
    toast(`서버 화이트리스트 검사를 ${server.enabled ? '중지했습니다.' : '시작했습니다.'}`)
  } catch (error) {
    toast(error.message, true)
  }
})

elements.deleteServerButton.addEventListener('click', async () => {
  const server = selectedServer()
  if (!server) return
  if (!window.confirm(`${server.name} 서버와 등록된 ${server.entryCount}명을 모두 삭제할까요?`)) return
  try {
    await api(`/api/admin/servers/${encodeURIComponent(server.id)}`, { method: 'DELETE' })
    state.selectedServerId = null
    await loadServers()
    toast('서버를 삭제했습니다.')
  } catch (error) {
    toast(error.message, true)
  }
})

elements.copyServerCodeButton.addEventListener('click', async () => {
  const server = selectedServer()
  if (!server) return
  try {
    await navigator.clipboard.writeText(server.code)
    toast('서버 코드를 복사했습니다.')
  } catch {
    toast('복사하지 못했습니다. 코드를 직접 선택해 주세요.', true)
  }
})

elements.addEntryForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const server = selectedServer()
  if (!server) return
  const button = elements.addEntryForm.querySelector('button[type="submit"]')
  const originalText = button.textContent
  button.disabled = true
  button.textContent = 'UUID 조회 중…'
  try {
    const payload = await api(`/api/admin/servers/${encodeURIComponent(server.id)}/entries`, {
      method: 'POST',
      body: { username: elements.minecraftUsername.value, note: elements.entryNote.value }
    })
    elements.minecraftUsername.value = ''
    elements.entryNote.value = ''
    elements.entrySearch.value = ''
    await loadServers(server.id)
    toast(`${payload.entry.username}을(를) 등록했습니다.`)
  } catch (error) {
    toast(error.message, true)
  } finally {
    button.disabled = false
    button.textContent = originalText
  }
})

elements.entrySearch.addEventListener('input', () => {
  clearTimeout(state.searchTimer)
  state.searchTimer = setTimeout(() => {
    loadEntries().catch((error) => toast(error.message, true))
  }, 250)
})

async function initialize() {
  try {
    const session = await api('/api/admin/session')
    if (!session.configured) {
      showLogin('Cloudflare Secret에 관리자 비밀번호를 먼저 설정해 주세요.')
    } else if (!session.authenticated) {
      showLogin()
    } else {
      showDashboard()
      await loadServers()
    }
  } catch (error) {
    showLogin(error.message)
  }
}

initialize()

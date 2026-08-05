import { createSessionToken, verifySecretPassword, verifySessionToken } from './auth.js'
import { resolveMinecraftProfile } from './mojang.js'
import {
  cleanBoolean,
  cleanText,
  formatUuid,
  normalizeServerCode,
  normalizeUuid
} from './validation.js'

const SESSION_COOKIE = 'rs_whitelist_session'
const LOGIN_WINDOW_SECONDS = 15 * 60
const LOGIN_FAILURE_LIMIT = 5

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer'
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  })
}

function publicJson(data, status = 200) {
  return json(data, status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  })
}

function errorResponse(code, status = 400, extra = {}) {
  return json({ ok: false, error: code, ...extra }, status)
}

async function readJson(request) {
  const contentType = request.headers.get('Content-Type') || ''
  const contentLength = Number.parseInt(request.headers.get('Content-Length') || '0', 10)
  if (!contentType.toLowerCase().includes('application/json') || contentLength > 16384) return null

  try {
    const value = await request.json()
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || ''
  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=')
    if (separator === -1) continue
    if (cookie.slice(0, separator).trim() === name) {
      return decodeURIComponent(cookie.slice(separator + 1).trim())
    }
  }
  return null
}

function sessionTtl(env) {
  const configured = Number.parseInt(env.SESSION_TTL_SECONDS || '', 10)
  return Number.isSafeInteger(configured) && configured >= 3600 && configured <= 86400
    ? configured
    : 43200
}

function sessionCookie(token, ttlSeconds) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ttlSeconds}`
}

function expiredSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

function isConfigured(env) {
  return Boolean(env.ADMIN_PASSWORD && env.SESSION_SECRET && env.SESSION_SECRET.length >= 32)
}

async function isAuthenticated(request, env) {
  if (!isConfigured(env)) return false
  const token = getCookie(request, SESSION_COOKIE)
  return verifySessionToken(token, env.SESSION_SECRET)
}

function isSameOrigin(request) {
  const origin = request.headers.get('Origin')
  return origin !== null && origin === new URL(request.url).origin
}

function requestIp(request) {
  return (request.headers.get('CF-Connecting-IP') || 'local').slice(0, 64)
}

async function isLoginBlocked(db, ip, now) {
  const attempt = await db
    .prepare('SELECT failures, window_started FROM login_attempts WHERE ip = ?')
    .bind(ip)
    .first()
  return Boolean(
    attempt &&
    now - attempt.window_started < LOGIN_WINDOW_SECONDS &&
    attempt.failures >= LOGIN_FAILURE_LIMIT
  )
}

async function recordLoginFailure(db, ip, now) {
  await db
    .prepare(`
      INSERT INTO login_attempts (ip, failures, window_started, updated_at)
      VALUES (?, 1, ?, ?)
      ON CONFLICT(ip) DO UPDATE SET
        failures = CASE
          WHEN excluded.updated_at - login_attempts.window_started >= ? THEN 1
          ELSE login_attempts.failures + 1
        END,
        window_started = CASE
          WHEN excluded.updated_at - login_attempts.window_started >= ? THEN excluded.updated_at
          ELSE login_attempts.window_started
        END,
        updated_at = excluded.updated_at
    `)
    .bind(ip, now, now, LOGIN_WINDOW_SECONDS, LOGIN_WINDOW_SECONDS)
    .run()
}

async function clearLoginFailures(db, ip) {
  await db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run()
}

async function handleLogin(request, env) {
  if (!isConfigured(env)) return errorResponse('service_not_configured', 503)
  if (!isSameOrigin(request)) return errorResponse('invalid_origin', 403)

  const body = await readJson(request)
  if (!body || typeof body.password !== 'string' || body.password.length > 256) {
    return errorResponse('invalid_request')
  }

  const now = Math.floor(Date.now() / 1000)
  const ip = requestIp(request)
  if (await isLoginBlocked(env.DB, ip, now)) {
    return errorResponse('too_many_attempts', 429, { retryAfterSeconds: LOGIN_WINDOW_SECONDS })
  }

  if (!(await verifySecretPassword(body.password, env.ADMIN_PASSWORD))) {
    await recordLoginFailure(env.DB, ip, now)
    return errorResponse('invalid_password', 401)
  }

  await clearLoginFailures(env.DB, ip)
  const ttl = sessionTtl(env)
  const token = await createSessionToken(env.SESSION_SECRET, ttl, now)
  return json(
    { ok: true, authenticated: true },
    200,
    { 'Set-Cookie': sessionCookie(token, ttl) }
  )
}

async function listServers(env) {
  const result = await env.DB.prepare(`
    SELECT
      servers.id,
      servers.code,
      servers.name,
      servers.description,
      servers.enabled,
      servers.created_at,
      servers.updated_at,
      COUNT(whitelist_entries.id) AS entry_count,
      COALESCE(SUM(CASE WHEN whitelist_entries.enabled = 1 THEN 1 ELSE 0 END), 0) AS enabled_entry_count
    FROM servers
    LEFT JOIN whitelist_entries ON whitelist_entries.server_id = servers.id
    GROUP BY servers.id
    ORDER BY servers.name COLLATE NOCASE
  `).all()

  return json({ ok: true, servers: result.results.map(serializeServer) })
}

function serializeServer(server) {
  return {
    id: server.id,
    code: server.code,
    name: server.name,
    description: server.description,
    enabled: Boolean(server.enabled),
    entryCount: Number(server.entry_count || 0),
    enabledEntryCount: Number(server.enabled_entry_count || 0),
    createdAt: Number(server.created_at),
    updatedAt: Number(server.updated_at)
  }
}

function serializeEntry(entry) {
  return {
    id: Number(entry.id),
    serverId: entry.server_id,
    uuid: formatUuid(entry.uuid),
    username: entry.username,
    note: entry.note,
    enabled: Boolean(entry.enabled),
    createdAt: Number(entry.created_at),
    updatedAt: Number(entry.updated_at)
  }
}

async function createServer(request, env) {
  const body = await readJson(request)
  const code = normalizeServerCode(body?.code)
  const name = cleanText(body?.name, 60, true)
  const description = cleanText(body?.description, 240)
  if (!code || !name || description === null) return errorResponse('invalid_server')

  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)
  try {
    await env.DB.prepare(`
      INSERT INTO servers (id, code, name, description, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).bind(id, code, name, description, now, now).run()
  } catch (error) {
    if (String(error).toLowerCase().includes('unique')) return errorResponse('server_code_exists', 409)
    throw error
  }

  return json({
    ok: true,
    server: serializeServer({
      id,
      code,
      name,
      description,
      enabled: 1,
      entry_count: 0,
      enabled_entry_count: 0,
      created_at: now,
      updated_at: now
    })
  }, 201)
}

async function updateServer(request, env, serverId) {
  const body = await readJson(request)
  if (!body) return errorResponse('invalid_request')

  const name = body.name === undefined ? undefined : cleanText(body.name, 60, true)
  const description = body.description === undefined ? undefined : cleanText(body.description, 240)
  const enabled = body.enabled === undefined ? undefined : cleanBoolean(body.enabled)
  if (name === null || description === null || enabled === null) return errorResponse('invalid_server')
  if (name === undefined && description === undefined && enabled === undefined) {
    return errorResponse('no_changes')
  }

  const current = await env.DB.prepare('SELECT * FROM servers WHERE id = ?').bind(serverId).first()
  if (!current) return errorResponse('server_not_found', 404)

  const now = Math.floor(Date.now() / 1000)
  await env.DB.prepare(`
    UPDATE servers
    SET name = ?, description = ?, enabled = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    name ?? current.name,
    description ?? current.description,
    enabled === undefined ? current.enabled : Number(enabled),
    now,
    serverId
  ).run()

  return json({ ok: true })
}

async function deleteServer(env, serverId) {
  const result = await env.DB.prepare('DELETE FROM servers WHERE id = ?').bind(serverId).run()
  if (!result.meta.changes) return errorResponse('server_not_found', 404)
  return json({ ok: true })
}

async function listEntries(request, env, serverId) {
  const server = await env.DB.prepare('SELECT id FROM servers WHERE id = ?').bind(serverId).first()
  if (!server) return errorResponse('server_not_found', 404)

  const search = cleanText(new URL(request.url).searchParams.get('search') || '', 50)
  if (search === null) return errorResponse('invalid_search')
  const pattern = `%${search}%`
  const result = await env.DB.prepare(`
    SELECT id, server_id, uuid, username, note, enabled, created_at, updated_at
    FROM whitelist_entries
    WHERE server_id = ? AND (username LIKE ? ESCAPE '\\' OR uuid LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\')
    ORDER BY username COLLATE NOCASE
    LIMIT 500
  `).bind(serverId, pattern, pattern, pattern).all()

  return json({ ok: true, entries: result.results.map(serializeEntry) })
}

async function addEntry(request, env, serverId) {
  const body = await readJson(request)
  const note = cleanText(body?.note, 120)
  if (!body || note === null) return errorResponse('invalid_request')

  const server = await env.DB.prepare('SELECT id FROM servers WHERE id = ?').bind(serverId).first()
  if (!server) return errorResponse('server_not_found', 404)

  const profile = await resolveMinecraftProfile(body.username)
  if (!profile.ok) return errorResponse(profile.error, profile.error === 'minecraft_account_not_found' ? 404 : 502)

  const now = Math.floor(Date.now() / 1000)
  await env.DB.prepare(`
    INSERT INTO whitelist_entries (server_id, uuid, username, note, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(server_id, uuid) DO UPDATE SET
      username = excluded.username,
      note = excluded.note,
      enabled = 1,
      updated_at = excluded.updated_at
  `).bind(serverId, profile.uuid, profile.username, note, now, now).run()

  const entry = await env.DB.prepare(`
    SELECT id, server_id, uuid, username, note, enabled, created_at, updated_at
    FROM whitelist_entries WHERE server_id = ? AND uuid = ?
  `).bind(serverId, profile.uuid).first()

  return json({ ok: true, entry: serializeEntry(entry) }, 201)
}

async function updateEntry(request, env, entryId) {
  const body = await readJson(request)
  if (!body) return errorResponse('invalid_request')
  const note = body.note === undefined ? undefined : cleanText(body.note, 120)
  const enabled = body.enabled === undefined ? undefined : cleanBoolean(body.enabled)
  if (note === null || enabled === null) return errorResponse('invalid_entry')
  if (note === undefined && enabled === undefined) return errorResponse('no_changes')

  const entry = await env.DB.prepare('SELECT note, enabled FROM whitelist_entries WHERE id = ?').bind(entryId).first()
  if (!entry) return errorResponse('entry_not_found', 404)
  const now = Math.floor(Date.now() / 1000)
  await env.DB.prepare(`
    UPDATE whitelist_entries SET note = ?, enabled = ?, updated_at = ? WHERE id = ?
  `).bind(note ?? entry.note, enabled === undefined ? entry.enabled : Number(enabled), now, entryId).run()
  return json({ ok: true })
}

async function deleteEntry(env, entryId) {
  const result = await env.DB.prepare('DELETE FROM whitelist_entries WHERE id = ?').bind(entryId).run()
  if (!result.meta.changes) return errorResponse('entry_not_found', 404)
  return json({ ok: true })
}

async function checkWhitelist(request, env) {
  const body = await readJson(request)
  const serverId = cleanText(body?.serverId, 64, true)
  const uuid = normalizeUuid(body?.uuid)
  if (!serverId || !uuid) return publicJson({ ok: false, allowed: false, reason: 'invalid_request' }, 400)

  const row = await env.DB.prepare(`
    SELECT
      servers.id AS server_id,
      servers.code AS server_code,
      servers.enabled AS server_enabled,
      whitelist_entries.enabled AS entry_enabled
    FROM servers
    LEFT JOIN whitelist_entries
      ON whitelist_entries.server_id = servers.id AND whitelist_entries.uuid = ?
    WHERE servers.id = ? OR servers.code = ? COLLATE NOCASE
    LIMIT 1
  `).bind(uuid, serverId, serverId).first()

  if (!row) return publicJson({ ok: true, allowed: false, reason: 'server_not_found' })
  if (!row.server_enabled) {
    return publicJson({ ok: true, allowed: false, serverId: row.server_code, reason: 'server_disabled' })
  }
  if (!row.entry_enabled) {
    return publicJson({ ok: true, allowed: false, serverId: row.server_code, reason: 'not_whitelisted' })
  }
  return publicJson({ ok: true, allowed: true, serverId: row.server_code, reason: 'allowed' })
}

async function handleAdmin(request, env, path) {
  if (path === '/api/admin/session' && request.method === 'GET') {
    return json({
      ok: true,
      configured: isConfigured(env),
      authenticated: await isAuthenticated(request, env)
    })
  }

  if (path === '/api/admin/login' && request.method === 'POST') return handleLogin(request, env)
  if (path === '/api/admin/logout' && request.method === 'POST') {
    if (!isSameOrigin(request)) return errorResponse('invalid_origin', 403)
    return json({ ok: true }, 200, { 'Set-Cookie': expiredSessionCookie() })
  }

  if (!(await isAuthenticated(request, env))) return errorResponse('authentication_required', 401)
  if (['POST', 'PATCH', 'DELETE'].includes(request.method) && !isSameOrigin(request)) {
    return errorResponse('invalid_origin', 403)
  }

  if (path === '/api/admin/servers') {
    if (request.method === 'GET') return listServers(env)
    if (request.method === 'POST') return createServer(request, env)
  }

  const entriesMatch = path.match(/^\/api\/admin\/servers\/([^/]+)\/entries$/u)
  if (entriesMatch) {
    const serverId = decodeURIComponent(entriesMatch[1])
    if (request.method === 'GET') return listEntries(request, env, serverId)
    if (request.method === 'POST') return addEntry(request, env, serverId)
  }

  const serverMatch = path.match(/^\/api\/admin\/servers\/([^/]+)$/u)
  if (serverMatch) {
    const serverId = decodeURIComponent(serverMatch[1])
    if (request.method === 'PATCH') return updateServer(request, env, serverId)
    if (request.method === 'DELETE') return deleteServer(env, serverId)
  }

  const entryMatch = path.match(/^\/api\/admin\/entries\/(\d+)$/u)
  if (entryMatch) {
    const entryId = Number.parseInt(entryMatch[1], 10)
    if (request.method === 'PATCH') return updateEntry(request, env, entryId)
    if (request.method === 'DELETE') return deleteEntry(env, entryId)
  }

  return errorResponse('not_found', 404)
}

function withAssetSecurityHeaders(response) {
  const secured = new Response(response.body, response)
  secured.headers.set('X-Content-Type-Options', 'nosniff')
  secured.headers.set('X-Frame-Options', 'DENY')
  secured.headers.set('Referrer-Policy', 'no-referrer')
  secured.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  )
  if ((secured.headers.get('Content-Type') || '').includes('text/html')) {
    secured.headers.set('Cache-Control', 'no-store')
  }
  return secured
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/u, '') : '/'

    try {
      if (path === '/api/health' && request.method === 'GET') {
        return json({ ok: true, configured: isConfigured(env) })
      }

      if (path === '/api/v1/check') {
        if (request.method === 'OPTIONS') return publicJson({ ok: true })
        if (request.method === 'POST') return checkWhitelist(request, env)
        return publicJson({ ok: false, error: 'method_not_allowed' }, 405)
      }

      if (path.startsWith('/api/admin/')) return handleAdmin(request, env, path)
      if (path.startsWith('/api/')) return errorResponse('not_found', 404)

      return withAssetSecurityHeaders(await env.ASSETS.fetch(request))
    } catch (error) {
      console.error('Whitelist service request failed', {
        method: request.method,
        path,
        error: error instanceof Error ? error.message : String(error)
      })
      return errorResponse('internal_error', 500)
    }
  }
}

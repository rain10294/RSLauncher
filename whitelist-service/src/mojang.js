import { normalizeUsername, normalizeUuid } from './validation.js'

const PROFILE_ENDPOINT = 'https://api.mojang.com/users/profiles/minecraft/'

export async function resolveMinecraftProfile(username, fetchImplementation = fetch) {
  const normalizedUsername = normalizeUsername(username)
  if (!normalizedUsername) {
    return { ok: false, error: 'invalid_username' }
  }

  let response
  try {
    response = await fetchImplementation(`${PROFILE_ENDPOINT}${encodeURIComponent(normalizedUsername)}`, {
      headers: { Accept: 'application/json' },
      cf: { cacheTtl: 60, cacheEverything: true }
    })
  } catch {
    return { ok: false, error: 'profile_service_unavailable' }
  }

  if (response.status === 204 || response.status === 404) {
    return { ok: false, error: 'minecraft_account_not_found' }
  }
  if (!response.ok) {
    return { ok: false, error: 'profile_service_unavailable' }
  }

  try {
    const profile = await response.json()
    const uuid = normalizeUuid(profile.id)
    const canonicalUsername = normalizeUsername(profile.name)
    if (!uuid || !canonicalUsername) throw new Error('Invalid profile response')
    return { ok: true, uuid, username: canonicalUsername }
  } catch {
    return { ok: false, error: 'profile_service_unavailable' }
  }
}

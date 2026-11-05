import { createHash } from 'node:crypto'
import { readJson, writeJson } from './store.js'

export const USERS_PATH = 'config/users.json'
const CACHE_MS = 30_000
const FALLBACK_CACHE_MS = 5_000
let cache = null

export const passwordVersion = (hash) => createHash('sha256').update(String(hash)).digest('hex').slice(0, 12)

export function envUsers(raw = process.env.AUTH_USERS) {
  try {
    const users = JSON.parse(raw ?? '')
    return users && typeof users === 'object' && !Array.isArray(users) ? users : null
  } catch {
    return null
  }
}

// Fonte di verità: config/users.json su Blob. Finché non esiste (nessuna modifica admin) vale AUTH_USERS.
export async function loadUsers() {
  if (cache && cache.until > Date.now()) return cache.users
  let users
  let ttl = CACHE_MS
  try {
    users = (await readJson(USERS_PATH))?.users ?? envUsers()
  } catch (error) {
    console.error('Users store read error', error?.name)
    users = envUsers()
    ttl = FALLBACK_CACHE_MS
  }
  cache = users ? { users, until: Date.now() + ttl } : null
  return users
}

export async function saveUsers(users) {
  await writeJson(USERS_PATH, { users })
  cache = { users, until: Date.now() + CACHE_MS }
}

// Solo per i test.
export const primeUsers = (users) => { cache = users ? { users, until: Date.now() + 3_600_000 } : null }

import { createHash } from 'node:crypto'
import { readJson, writeJson } from './store.js'

export const WINDOW_MS = 15 * 60 * 1000
export const LIMITS = { ip: 10, pair: 5 }

export const clientIp = (request) => String(request.headers?.['x-vercel-forwarded-for'] || request.headers?.['x-forwarded-for'] || 'unknown').split(',')[0].trim()

const pathFor = (kind, value) => `config/rl/${kind}-${createHash('sha256').update(value).digest('hex').slice(0, 32)}.json`
const keys = (ip, username) => [['ip', ip], ['pair', `${username}|${ip}`]]

// Contatori per IP e per coppia utente+IP: chi sbaglia da fuori non può bloccare l'utente vero da un altro IP.
export async function checkLock(ip, username, now = Date.now()) {
  let retryAfter = 0
  for (const [kind, value] of keys(ip, username)) {
    const state = await readJson(pathFor(kind, value)).catch(() => null)
    if (state && now - state.first < WINDOW_MS && state.count >= LIMITS[kind]) {
      retryAfter = Math.max(retryAfter, Math.ceil((state.first + WINDOW_MS - now) / 1000))
    }
  }
  return retryAfter
}

export async function recordFailure(ip, username, now = Date.now()) {
  await Promise.all(keys(ip, username).map(async ([kind, value]) => {
    const path = pathFor(kind, value)
    const state = await readJson(path).catch(() => null)
    const fresh = !state || now - state.first >= WINDOW_MS
    await writeJson(path, { count: fresh ? 1 : state.count + 1, first: fresh ? now : state.first }).catch(() => {})
  }))
}

export async function recordSuccess(ip, username) {
  await writeJson(pathFor('pair', `${username}|${ip}`), { count: 0, first: Date.now() }).catch(() => {})
}

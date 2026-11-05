import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { loadUsers, passwordVersion } from './users.js'

export const COOKIE_NAME = 'wt_session'
export const SESSION_SECONDS = 7 * 24 * 60 * 60

const derive = (password, salt) => new Promise((resolve, reject) => {
  scrypt(password, salt, 64, (error, key) => (error ? reject(error) : resolve(key)))
})

export async function hashPassword(password) {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('hex')}$${(await derive(password, salt)).toString('hex')}`
}

export async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored ?? '').split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = await derive(password, Buffer.from(saltHex, 'hex'))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url')

export function createSession({ username, name, role, pv }, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ u: username, n: name, r: role, pv, exp: Math.floor(now / 1000) + SESSION_SECONDS })).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

export function verifySession(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || !secret) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = Buffer.from(sign(payload, secret))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return data.exp > Math.floor(now / 1000) ? { username: data.u, name: data.n, role: data.r, pv: data.pv } : null
  } catch {
    return null
  }
}

export function readCookie(request, name = COOKIE_NAME) {
  const header = request.headers?.cookie ?? ''
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return value.join('=')
  }
  return null
}

export const sessionCookie = (token) => `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}`
export const clearCookie = () => `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`

// La sessione è valida solo se l'utente esiste ancora e la password non è cambiata (revoca immediata).
export async function getSession(request) {
  const session = verifySession(readCookie(request), process.env.AUTH_SECRET)
  if (!session) return null
  const user = (await loadUsers())?.[session.username]
  if (!user || passwordVersion(user.hash) !== session.pv) return null
  return { username: session.username, name: user.name || session.username, role: user.role === 'admin' ? 'admin' : 'user' }
}

// Restituisce la sessione oppure risponde 401/503 e restituisce null (fail-closed).
export async function requireAuth(request, response) {
  if (!process.env.AUTH_SECRET || !(await loadUsers())) {
    response.status(503).json({ detail: 'Accesso non configurato.' })
    return null
  }
  const session = await getSession(request)
  if (!session) {
    response.status(401).json({ detail: 'Accesso richiesto.' })
    return null
  }
  return session
}

export async function requireAdmin(request, response) {
  const session = await requireAuth(request, response)
  if (!session) return null
  if (session.role !== 'admin') {
    response.status(403).json({ detail: 'Riservato agli amministratori.' })
    return null
  }
  return session
}

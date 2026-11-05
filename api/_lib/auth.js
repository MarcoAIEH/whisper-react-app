import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

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

// AUTH_USERS = {"laura":{"hash":"scrypt$...","name":"Laura","role":"user"}, ...}
export function loadUsers(raw = process.env.AUTH_USERS) {
  try {
    const users = JSON.parse(raw ?? '')
    return users && typeof users === 'object' && !Array.isArray(users) ? users : null
  } catch {
    return null
  }
}

const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url')

export function createSession({ username, name, role }, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ u: username, n: name, r: role, exp: Math.floor(now / 1000) + SESSION_SECONDS })).toString('base64url')
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
    return data.exp > Math.floor(now / 1000) ? { username: data.u, name: data.n, role: data.r } : null
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

export const getSession = (request) => verifySession(readCookie(request), process.env.AUTH_SECRET)

// Restituisce la sessione oppure risponde 401/503 e restituisce null (fail-closed).
export function requireAuth(request, response) {
  if (!process.env.AUTH_SECRET || !loadUsers()) {
    response.status(503).json({ detail: 'Accesso non configurato.' })
    return null
  }
  const session = getSession(request)
  if (!session) {
    response.status(401).json({ detail: 'Accesso richiesto.' })
    return null
  }
  return session
}

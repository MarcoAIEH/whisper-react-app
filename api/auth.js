import { clearCookie, createSession, getSession, sessionCookie, verifyPassword } from './_lib/auth.js'
import { checkLock, clientIp, recordFailure, recordSuccess } from './_lib/ratelimit.js'
import { loadUsers, passwordVersion } from './_lib/users.js'

// Hash fittizio: il tempo di risposta non rivela se l'utente esiste.
const DUMMY_HASH = `scrypt$${'00'.repeat(16)}$${'00'.repeat(64)}`
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  const users = await loadUsers()
  if (!process.env.AUTH_SECRET || !users) return response.status(503).json({ detail: 'Accesso non configurato.' })

  if (request.method === 'GET') {
    const session = await getSession(request)
    return session ? response.status(200).json(session) : response.status(401).json({ detail: 'Accesso richiesto.' })
  }

  if (request.method === 'DELETE') {
    response.setHeader('Set-Cookie', clearCookie())
    return response.status(200).json({ ok: true })
  }

  if (request.method !== 'POST') return response.status(405).json({ detail: 'Metodo non consentito.' })

  const { username, password } = request.body || {}
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 200) {
    return response.status(422).json({ detail: 'Richiesta non valida.' })
  }
  const key = username.trim().toLowerCase().slice(0, 64)
  const ip = clientIp(request)

  const retryAfter = await checkLock(ip, key)
  if (retryAfter > 0) {
    response.setHeader('Retry-After', String(retryAfter))
    return response.status(429).json({ detail: `Troppi tentativi. Riprova tra ${Math.ceil(retryAfter / 60)} minuti.` })
  }

  const user = Object.hasOwn(users, key) ? users[key] : null
  const valid = await verifyPassword(password, user?.hash ?? DUMMY_HASH)
  if (!user || !valid) {
    await recordFailure(ip, key)
    await wait(600)
    return response.status(401).json({ detail: 'Nome utente o password non corretti.' })
  }
  await recordSuccess(ip, key)
  const session = { username: key, name: user.name || key, role: user.role === 'admin' ? 'admin' : 'user' }
  response.setHeader('Set-Cookie', sessionCookie(createSession({ ...session, pv: passwordVersion(user.hash) }, process.env.AUTH_SECRET)))
  return response.status(200).json(session)
}

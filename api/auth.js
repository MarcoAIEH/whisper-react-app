import { clearCookie, createSession, getSession, loadUsers, sessionCookie, verifyPassword } from './_lib/auth.js'

// Hash fittizio: il tempo di risposta non rivela se l'utente esiste.
const DUMMY_HASH = `scrypt$${'00'.repeat(16)}$${'00'.repeat(64)}`
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  const users = loadUsers()
  if (!process.env.AUTH_SECRET || !users) return response.status(503).json({ detail: 'Accesso non configurato.' })

  if (request.method === 'GET') {
    const session = getSession(request)
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
  const key = username.trim().toLowerCase()
  const user = Object.hasOwn(users, key) ? users[key] : null
  const valid = await verifyPassword(password, user?.hash ?? DUMMY_HASH)
  if (!user || !valid) {
    await wait(600)
    return response.status(401).json({ detail: 'Nome utente o password non corretti.' })
  }
  const session = { username: key, name: user.name || key, role: user.role === 'admin' ? 'admin' : 'user' }
  response.setHeader('Set-Cookie', sessionCookie(createSession(session, process.env.AUTH_SECRET)))
  return response.status(200).json(session)
}

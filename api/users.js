import { hashPassword, requireAdmin, requireAuth, verifyPassword } from './_lib/auth.js'
import { loadUsers, saveUsers } from './_lib/users.js'

const USERNAME = /^[a-z0-9][a-z0-9._-]{1,31}$/
const MIN_PASSWORD = 10
const isRole = (role) => role === 'user' || role === 'admin'
const validPassword = (password) => typeof password === 'string' && password.length >= MIN_PASSWORD && password.length <= 200
const validName = (name) => typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 60
const adminCount = (users) => Object.values(users).filter((user) => user.role === 'admin').length
const publicView = (users) => Object.entries(users)
  .map(([username, user]) => ({ username, name: user.name || username, role: user.role === 'admin' ? 'admin' : 'user' }))
  .sort((a, b) => a.username.localeCompare(b.username))

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store')
  const { method } = request

  // Cambio della propria password: consentito a ogni utente con la password attuale.
  if (method === 'PATCH' && request.body?.currentPassword !== undefined) {
    const session = await requireAuth(request, response)
    if (!session) return
    const { currentPassword, newPassword } = request.body
    if (typeof currentPassword !== 'string' || !validPassword(newPassword)) {
      return response.status(422).json({ detail: `La nuova password deve avere almeno ${MIN_PASSWORD} caratteri.` })
    }
    const users = { ...(await loadUsers()) }
    const user = users[session.username]
    if (!(await verifyPassword(currentPassword, user.hash))) return response.status(403).json({ detail: 'La password attuale non è corretta.' })
    users[session.username] = { ...user, hash: await hashPassword(newPassword) }
    await saveUsers(users)
    return response.status(200).json({ ok: true, reauthenticate: true })
  }

  const session = await requireAdmin(request, response)
  if (!session) return
  const users = { ...(await loadUsers()) }

  if (method === 'GET') return response.status(200).json({ users: publicView(users) })

  if (method === 'POST') {
    const { username, name, password, role = 'user' } = request.body || {}
    const key = typeof username === 'string' ? username.trim().toLowerCase() : ''
    if (!USERNAME.test(key)) return response.status(422).json({ detail: 'Nome utente: 2-32 caratteri tra lettere minuscole, numeri, punto, trattino.' })
    if (!validName(name)) return response.status(422).json({ detail: 'Inserisci il nome visualizzato (max 60 caratteri).' })
    if (!validPassword(password)) return response.status(422).json({ detail: `La password deve avere almeno ${MIN_PASSWORD} caratteri.` })
    if (!isRole(role)) return response.status(422).json({ detail: 'Ruolo non valido.' })
    if (Object.hasOwn(users, key)) return response.status(409).json({ detail: 'Esiste già un utente con questo nome.' })
    users[key] = { hash: await hashPassword(password), name: name.trim(), role }
    await saveUsers(users)
    return response.status(201).json({ users: publicView(users) })
  }

  if (method === 'PATCH') {
    const { username, password, role, name } = request.body || {}
    const key = typeof username === 'string' ? username.trim().toLowerCase() : ''
    if (!Object.hasOwn(users, key)) return response.status(404).json({ detail: 'Utente non trovato.' })
    const next = { ...users[key] }
    if (password !== undefined) {
      if (!validPassword(password)) return response.status(422).json({ detail: `La password deve avere almeno ${MIN_PASSWORD} caratteri.` })
      next.hash = await hashPassword(password)
    }
    if (name !== undefined) {
      if (!validName(name)) return response.status(422).json({ detail: 'Nome visualizzato non valido.' })
      next.name = name.trim()
    }
    if (role !== undefined) {
      if (!isRole(role)) return response.status(422).json({ detail: 'Ruolo non valido.' })
      if (next.role === 'admin' && role !== 'admin' && adminCount(users) <= 1) return response.status(409).json({ detail: 'Deve restare almeno un amministratore.' })
      next.role = role
    }
    users[key] = next
    await saveUsers(users)
    return response.status(200).json({ users: publicView(users) })
  }

  if (method === 'DELETE') {
    const key = String(request.query?.username ?? '').trim().toLowerCase()
    if (!Object.hasOwn(users, key)) return response.status(404).json({ detail: 'Utente non trovato.' })
    if (key === session.username) return response.status(409).json({ detail: 'Non puoi eliminare il tuo stesso account.' })
    if (users[key].role === 'admin' && adminCount(users) <= 1) return response.status(409).json({ detail: 'Deve restare almeno un amministratore.' })
    delete users[key]
    await saveUsers(users)
    return response.status(200).json({ users: publicView(users) })
  }

  return response.status(405).json({ detail: 'Metodo non consentito.' })
}

import { memory } from './blobmock.js'
import test from 'node:test'
import assert from 'node:assert/strict'

const { default: usersHandler } = await import('../api/users.js')
const { hashPassword, verifyPassword } = await import('../api/_lib/auth.js')
const { USERS_PATH, loadUsers, primeUsers } = await import('../api/_lib/users.js')
const { authHeaders, setAuthEnv } = await import('./helpers.js')

const makeResponse = () => ({ statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v }, status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this } })
const call = async (request) => { const response = makeResponse(); await usersHandler(request, response); return response }

const base = {
  marco: { hash: await hashPassword('Marco-password-1'), name: 'Marco', role: 'admin' },
  laura: { hash: await hashPassword('Laura-password-1'), name: 'Laura', role: 'user' },
}
const fresh = () => { memory.clear(); setAuthEnv(structuredClone(base)); primeUsers(structuredClone(base)) }
const admin = () => authHeaders('marco', base)
const asLaura = () => authHeaders('laura', base)

test('accesso: senza sessione 401, utente normale 403', async () => {
  fresh()
  assert.equal((await call({ method: 'GET', headers: {} })).statusCode, 401)
  assert.equal((await call({ method: 'GET', headers: asLaura() })).statusCode, 403)
  assert.equal((await call({ method: 'POST', headers: asLaura(), body: {} })).statusCode, 403)
  assert.equal((await call({ method: 'DELETE', headers: asLaura(), query: { username: 'marco' } })).statusCode, 403)
})

test('GET elenca utenti senza hash', async () => {
  fresh()
  const response = await call({ method: 'GET', headers: admin() })
  assert.deepEqual(response.body.users, [{ username: 'laura', name: 'Laura', role: 'user' }, { username: 'marco', name: 'Marco', role: 'admin' }])
  assert.ok(!JSON.stringify(response.body).includes('scrypt'))
})

test('POST crea utente e lo persiste nello store', async () => {
  fresh()
  const response = await call({ method: 'POST', headers: admin(), body: { username: ' Giulia ', name: 'Giulia', password: 'Password-lunga-1', role: 'user' } })
  assert.equal(response.statusCode, 201)
  assert.ok(response.body.users.some((u) => u.username === 'giulia'))
  const stored = JSON.parse(memory.get(USERS_PATH)).users
  assert.ok(stored.giulia.hash.startsWith('scrypt$'))
  assert.equal(await verifyPassword('Password-lunga-1', stored.giulia.hash), true)
  assert.ok(stored.marco && stored.laura, 'gli utenti esistenti vengono mantenuti')
})

test('POST validazione: nome utente, password corta, ruolo, duplicato', async () => {
  fresh()
  const post = (body) => call({ method: 'POST', headers: admin(), body })
  assert.equal((await post({ username: 'A', name: 'x', password: 'Password-lunga-1' })).statusCode, 422)
  assert.equal((await post({ username: 'bad name', name: 'x', password: 'Password-lunga-1' })).statusCode, 422)
  assert.equal((await post({ username: '__proto__', name: 'x', password: 'Password-lunga-1' })).statusCode, 422)
  assert.equal((await post({ username: 'nuovo', name: '', password: 'Password-lunga-1' })).statusCode, 422)
  assert.equal((await post({ username: 'nuovo', name: 'N', password: 'corta' })).statusCode, 422)
  assert.equal((await post({ username: 'nuovo', name: 'N', password: 'Password-lunga-1', role: 'root' })).statusCode, 422)
  assert.equal((await post({ username: 'laura', name: 'L', password: 'Password-lunga-1' })).statusCode, 409)
  assert.equal(memory.has(USERS_PATH), false)
})

test('PATCH admin: reimposta password, cambia ruolo e nome', async () => {
  fresh()
  const response = await call({ method: 'PATCH', headers: admin(), body: { username: 'laura', password: 'Nuova-password-9', name: 'Laura B.', role: 'admin' } })
  assert.equal(response.statusCode, 200)
  const stored = JSON.parse(memory.get(USERS_PATH)).users
  assert.equal(await verifyPassword('Nuova-password-9', stored.laura.hash), true)
  assert.equal(stored.laura.name, 'Laura B.')
  assert.equal(stored.laura.role, 'admin')
  assert.equal((await call({ method: 'PATCH', headers: admin(), body: { username: 'ghost', password: 'Nuova-password-9' } })).statusCode, 404)
  assert.equal((await call({ method: 'PATCH', headers: admin(), body: { username: 'laura', password: 'corta' } })).statusCode, 422)
})

test('ultimo admin: non declassabile né eliminabile; non puoi eliminare te stesso', async () => {
  fresh()
  assert.equal((await call({ method: 'PATCH', headers: admin(), body: { username: 'marco', role: 'user' } })).statusCode, 409)
  assert.equal((await call({ method: 'DELETE', headers: admin(), query: { username: 'marco' } })).statusCode, 409)
  // con un secondo admin, marco resta comunque non auto-eliminabile
  await call({ method: 'PATCH', headers: admin(), body: { username: 'laura', role: 'admin' } })
  assert.equal((await call({ method: 'DELETE', headers: admin(), query: { username: 'marco' } })).statusCode, 409)
})

test('DELETE elimina utente e la sessione di quell\'utente viene revocata', async () => {
  fresh()
  const lauraCookie = asLaura()
  const response = await call({ method: 'DELETE', headers: admin(), query: { username: 'laura' } })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body.users.map((u) => u.username), ['marco'])
  assert.equal((await call({ method: 'GET', headers: lauraCookie })).statusCode, 401)
  assert.equal((await call({ method: 'DELETE', headers: admin(), query: { username: 'laura' } })).statusCode, 404)
})

test('cambio password personale: richiede la password attuale', async () => {
  fresh()
  const patch = (body) => call({ method: 'PATCH', headers: asLaura(), body })
  assert.equal((await patch({ currentPassword: 'sbagliata', newPassword: 'Nuova-password-9' })).statusCode, 403)
  assert.equal((await patch({ currentPassword: 'Laura-password-1', newPassword: 'corta' })).statusCode, 422)
  const ok = await patch({ currentPassword: 'Laura-password-1', newPassword: 'Nuova-password-9' })
  assert.equal(ok.statusCode, 200)
  const stored = JSON.parse(memory.get(USERS_PATH)).users
  assert.equal(await verifyPassword('Nuova-password-9', stored.laura.hash), true)
  assert.equal((await call({ method: 'GET', headers: asLaura() })).statusCode, 401, 'la vecchia sessione non vale più')
})

test('bootstrap: senza file nello store vale AUTH_USERS, poi lo store prevale', async () => {
  memory.clear()
  setAuthEnv(structuredClone(base))
  primeUsers(null)
  assert.deepEqual(Object.keys(await loadUsers()).sort(), ['laura', 'marco'])
  memory.set(USERS_PATH, JSON.stringify({ users: { solo: { hash: 'x', name: 'Solo', role: 'admin' } } }))
  primeUsers(null)
  assert.deepEqual(Object.keys(await loadUsers()), ['solo'])
})

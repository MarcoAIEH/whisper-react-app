import { memory, failures } from './blobmock.js'
import test from 'node:test'
import assert from 'node:assert/strict'

// Import dinamici: devono avvenire dopo che il mock di @vercel/blob è registrato.
const { default: authHandler } = await import('../api/auth.js')
const { default: cleanupHandler } = await import('../api/cleanup.js')
const { createSession, hashPassword, readCookie, verifyPassword, verifySession } = await import('../api/_lib/auth.js')
const { primeUsers } = await import('../api/_lib/users.js')
const { AUTH_SECRET, authHeaders, setAuthEnv } = await import('./helpers.js')

const makeResponse = () => ({ statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v }, status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this } })
const call = async (handler, request) => { const response = makeResponse(); await handler(request, response); return response }

test('hash e verifica password (scrypt)', async () => {
  const hash = await hashPassword('Segreta-123')
  assert.ok(hash.startsWith('scrypt$'))
  assert.equal(await verifyPassword('Segreta-123', hash), true)
  assert.equal(await verifyPassword('sbagliata', hash), false)
  assert.equal(await verifyPassword('x', 'formato-rotto'), false)
  assert.notEqual(hash, await hashPassword('Segreta-123'))
})

test('sessione: valida, manomessa, scaduta, segreto sbagliato', () => {
  const user = { username: 'marco', name: 'Marco', role: 'admin', pv: 'abc' }
  const token = createSession(user, AUTH_SECRET, 1_000_000)
  assert.deepEqual(verifySession(token, AUTH_SECRET, 1_000_000), user)
  assert.equal(verifySession(token, 'altro-segreto', 1_000_000), null)
  assert.equal(verifySession(token + 'x', AUTH_SECRET, 1_000_000), null)
  const [, signature] = token.split('.')
  const forged = Buffer.from(JSON.stringify({ u: 'marco', n: 'Marco', r: 'admin', exp: 9e12 })).toString('base64url')
  assert.equal(verifySession(`${forged}.${signature}`, AUTH_SECRET, 1_000_000), null)
  assert.equal(verifySession(token, AUTH_SECRET, 1_000_000 + 8 * 24 * 3600 * 1000), null)
  assert.equal(verifySession(undefined, AUTH_SECRET), null)
})

test('readCookie', () => {
  assert.equal(readCookie({ headers: { cookie: 'a=1; wt_session=abc.def; b=2' } }), 'abc.def')
  assert.equal(readCookie({ headers: {} }), null)
})

test('endpoint /api/auth', async (t) => {
  const users = {
    laura: { hash: await hashPassword('Pw-Laura-1'), name: 'Laura', role: 'user' },
    marco: { hash: await hashPassword('Pw-Marco-1'), name: 'Marco', role: 'admin' },
  }
  setAuthEnv(users)
  let ipCounter = 0
  const login = (body, ip = `10.0.0.${++ipCounter}`) => call(authHandler, { method: 'POST', headers: { 'x-forwarded-for': ip }, body })

  await t.test('login corretto: cookie HttpOnly/Secure/SameSite e ruolo', async () => {
    const response = await login({ username: ' Laura ', password: 'Pw-Laura-1' })
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body, { username: 'laura', name: 'Laura', role: 'user' })
    const cookie = response.headers['Set-Cookie']
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Strict/)
    const me = await call(authHandler, { method: 'GET', headers: { cookie: cookie.split(';')[0] } })
    assert.deepEqual(me.body, { username: 'laura', name: 'Laura', role: 'user' })
  })

  await t.test('admin riconosciuto', async () => {
    assert.equal((await login({ username: 'marco', password: 'Pw-Marco-1' })).body.role, 'admin')
  })

  await t.test('password errata, utente inesistente, proprietà ereditate → 401 uguale', async () => {
    const results = []
    for (const body of [{ username: 'laura', password: 'no' }, { username: 'fantasma', password: 'no' }, { username: '__proto__', password: 'no' }, { username: 'constructor', password: 'x' }]) results.push(await login(body))
    for (const r of results) { assert.equal(r.statusCode, 401); assert.equal(r.headers['Set-Cookie'], undefined) }
    assert.equal(new Set(results.map((r) => r.body.detail)).size, 1)
  })

  await t.test('input non valido → 422', async () => {
    assert.equal((await login({ username: 'laura' })).statusCode, 422)
    assert.equal((await login({ username: 'laura', password: 'a'.repeat(201) })).statusCode, 422)
  })

  await t.test('GET senza cookie o con cookie falso → 401; DELETE cancella cookie', async () => {
    assert.equal((await call(authHandler, { method: 'GET', headers: {} })).statusCode, 401)
    assert.equal((await call(authHandler, { method: 'GET', headers: { cookie: 'wt_session=x.y' } })).statusCode, 401)
    assert.match((await call(authHandler, { method: 'DELETE', headers: {} })).headers['Set-Cookie'], /Max-Age=0/)
  })

  await t.test('utente rimosso o password cambiata: sessione revocata', async () => {
    const cookie = authHeaders('laura', users)
    assert.equal((await call(authHandler, { method: 'GET', headers: cookie })).statusCode, 200)
    primeUsers({ marco: users.marco })
    assert.equal((await call(authHandler, { method: 'GET', headers: cookie })).statusCode, 401)
    primeUsers({ ...users, laura: { ...users.laura, hash: await hashPassword('Nuova-Pw-123') } })
    assert.equal((await call(authHandler, { method: 'GET', headers: cookie })).statusCode, 401)
    primeUsers(users)
  })

  await t.test('limite tentativi: 5 errori stessa coppia utente+IP → 429, altro IP non bloccato', async () => {
    memory.clear()
    for (let i = 0; i < 5; i += 1) assert.equal((await login({ username: 'laura', password: 'x' }, '9.9.9.9')).statusCode, 401)
    const locked = await login({ username: 'laura', password: 'Pw-Laura-1' }, '9.9.9.9')
    assert.equal(locked.statusCode, 429)
    assert.ok(Number(locked.headers['Retry-After']) > 0)
    assert.equal(locked.headers['Set-Cookie'], undefined)
    assert.equal((await login({ username: 'laura', password: 'Pw-Laura-1' }, '8.8.8.8')).statusCode, 200)
    assert.equal((await login({ username: 'marco', password: 'Pw-Marco-1' }, '9.9.9.9')).statusCode, 200)
  })

  await t.test('store non raggiungibile: il login funziona comunque (fail-open sul limite)', async () => {
    failures.read = true
    primeUsers(users)
    assert.equal((await login({ username: 'laura', password: 'Pw-Laura-1' })).statusCode, 200)
    failures.read = false
  })

  await t.test('non configurato → 503 (fail-closed)', async () => {
    const saved = process.env.AUTH_SECRET
    delete process.env.AUTH_SECRET
    assert.equal((await login({ username: 'laura', password: 'Pw-Laura-1' })).statusCode, 503)
    assert.equal((await call(cleanupHandler, { method: 'POST', headers: authHeaders('laura', users), body: { blobUrl: 'x' } })).statusCode, 503)
    process.env.AUTH_SECRET = saved
  })
})

test('cleanup protetto: senza sessione 401', async () => {
  setAuthEnv()
  const response = await call(cleanupHandler, { method: 'POST', headers: {}, body: { blobUrl: 'https://x/audio/a.mp3' } })
  assert.equal(response.statusCode, 401)
})

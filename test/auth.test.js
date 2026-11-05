import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import authHandler from '../api/auth.js'
import cleanupHandler from '../api/cleanup.js'
import { createSession, hashPassword, readCookie, verifyPassword, verifySession } from '../api/_lib/auth.js'
import { AUTH_SECRET, authHeaders, setAuthEnv } from './helpers.js'

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
  const user = { username: 'marco', name: 'Marco', role: 'admin' }
  const token = createSession(user, AUTH_SECRET, 1_000_000)
  assert.deepEqual(verifySession(token, AUTH_SECRET, 1_000_000), user)
  assert.equal(verifySession(token, 'altro-segreto', 1_000_000), null)
  assert.equal(verifySession(token + 'x', AUTH_SECRET, 1_000_000), null)
  const [payload, signature] = token.split('.')
  const forged = Buffer.from(JSON.stringify({ u: 'marco', n: 'Marco', r: 'admin', exp: 9e12 })).toString('base64url')
  assert.equal(verifySession(`${forged}.${signature}`, AUTH_SECRET, 1_000_000), null)
  assert.equal(verifySession(token, AUTH_SECRET, 1_000_000 + 8 * 24 * 3600 * 1000), null)
  assert.equal(verifySession(undefined, AUTH_SECRET), null)
  assert.ok(payload)
})

test('readCookie', () => {
  assert.equal(readCookie({ headers: { cookie: 'a=1; wt_session=abc.def; b=2' } }), 'abc.def')
  assert.equal(readCookie({ headers: {} }), null)
})

test('endpoint /api/auth', async (t) => {
  setAuthEnv()
  process.env.AUTH_USERS = JSON.stringify({
    laura: { hash: await hashPassword('Pw-Laura-1'), name: 'Laura', role: 'user' },
    marco: { hash: await hashPassword('Pw-Marco-1'), name: 'Marco', role: 'admin' },
  })
  const login = (body) => call(authHandler, { method: 'POST', headers: {}, body })

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
    const results = await Promise.all([
      login({ username: 'laura', password: 'no' }), login({ username: 'fantasma', password: 'no' }), login({ username: '__proto__', password: 'no' }), login({ username: 'constructor', password: 'x' }),
    ])
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

  await t.test('non configurato → 503 (fail-closed)', async () => {
    const saved = process.env.AUTH_SECRET
    delete process.env.AUTH_SECRET
    assert.equal((await login({ username: 'laura', password: 'Pw-Laura-1' })).statusCode, 503)
    assert.equal((await call(cleanupHandler, { method: 'POST', headers: authHeaders(), body: { blobUrl: 'x' } })).statusCode, 503)
    process.env.AUTH_SECRET = saved
  })
})

test('cleanup protetto: senza sessione 401', async () => {
  setAuthEnv()
  mock.method(globalThis, 'fetch', async () => new Response('{}'))
  const response = await call(cleanupHandler, { method: 'POST', headers: {}, body: { blobUrl: 'https://x/audio/a.mp3' } })
  mock.restoreAll()
  assert.equal(response.statusCode, 401)
})

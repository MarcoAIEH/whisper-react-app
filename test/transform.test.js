import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/transform.js'
import { MAX_TEXT_CHARS } from '../api/_lib/presets.js'

const makeResponse = () => ({ statusCode: 0, body: null, status(c) { this.statusCode = c; return this }, json(b) { this.body = b; return this } })

async function call(request, upstream) {
  let sent
  mock.method(globalThis, 'fetch', async (url, init) => { sent = { url, init, body: JSON.parse(init.body) }; return upstream() })
  const response = makeResponse()
  await handler(request, response)
  mock.restoreAll()
  return { response, sent }
}
const ok = () => new Response(JSON.stringify({ content: [{ type: 'text', text: 'Risultato' }] }))
const post = (body) => ({ method: 'POST', body })

test('senza chiave: 503 (anche su GET)', async () => {
  delete process.env.ANTHROPIC_API_KEY
  assert.equal((await call(post({ text: 'a', presetId: 'riassunto' }), ok)).response.statusCode, 503)
  assert.equal((await call({ method: 'GET' }, ok)).response.statusCode, 503)
})

test('con chiave', async (t) => {
  process.env.ANTHROPIC_API_KEY = 'sk-test-secret'
  t.after(() => { delete process.env.ANTHROPIC_API_KEY })

  await t.test('GET elenca i preset senza prompt', async () => {
    const { response } = await call({ method: 'GET' }, ok)
    assert.equal(response.statusCode, 200)
    assert.ok(response.body.presets.length >= 6)
    assert.ok(response.body.presets.every((p) => Object.keys(p).sort().join() === 'id,label'))
  })

  await t.test('preset valido → result e chiamata corretta', async () => {
    const { response, sent } = await call(post({ text: 'Marco: ciao', presetId: 'verbale' }), ok)
    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.body, { result: 'Risultato' })
    assert.equal(sent.url, 'https://api.anthropic.com/v1/messages')
    assert.equal(sent.init.headers['x-api-key'], 'sk-test-secret')
    assert.equal(sent.init.headers['anthropic-version'], '2023-06-01')
    assert.ok(sent.body.messages[0].content.includes('Marco: ciao'))
    assert.ok(sent.body.system.includes('verbale'))
    assert.equal(typeof sent.body.max_tokens, 'number')
  })

  await t.test('ANTHROPIC_MODEL sovrascrive il default', async () => {
    process.env.ANTHROPIC_MODEL = 'modello-x'
    const { sent } = await call(post({ text: 'a', presetId: 'faq' }), ok)
    delete process.env.ANTHROPIC_MODEL
    assert.equal(sent.body.model, 'modello-x')
  })

  await t.test('preset sconosciuto, testo vuoto o troppo lungo → 422 senza chiamare Anthropic', async () => {
    for (const body of [{ text: 'a', presetId: 'boh' }, { text: '  ', presetId: 'faq' }, { text: 'a'.repeat(MAX_TEXT_CHARS + 1), presetId: 'faq' }]) {
      const { response, sent } = await call(post(body), ok)
      assert.equal(response.statusCode, 422)
      assert.equal(sent, undefined)
    }
  })

  await t.test('errore upstream → 502 senza leak di testo o chiave', async () => {
    const { response } = await call(post({ text: 'testo riservato', presetId: 'faq' }), () => new Response('sk-test-secret testo riservato', { status: 500 }))
    assert.equal(response.statusCode, 502)
    const serialized = JSON.stringify(response.body)
    assert.ok(!serialized.includes('sk-test-secret') && !serialized.includes('riservato'))
  })

  await t.test('metodo non consentito → 405', async () => {
    assert.equal((await call({ method: 'PUT' }, ok)).response.statusCode, 405)
  })
})

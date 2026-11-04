import test, { mock } from 'node:test'
import assert from 'node:assert/strict'

const deleted = []
const blobGet = mock.fn(async () => ({
  blob: { pathname: 'audio/abc-call.mp3', size: 1000, contentType: 'audio/mpeg' },
  stream: new Response(new Uint8Array([1, 2, 3])).body,
}))
mock.module('@vercel/blob', {
  namedExports: { get: blobGet, del: async (path) => { deleted.push(path) } },
})
process.env.ELEVENLABS_API_KEY = 'test-key'
process.env.BLOB_READ_WRITE_TOKEN = 'test-token'
const { default: handler } = await import('../api/transcribe.js')

const w = (text, speaker_id, start, end, type = 'word') => ({ text, type, start, end, speaker_id })
const scribe = {
  text: 'Ciao Marco Buongiorno',
  words: [w('Ciao', 'speaker_0', 0, 1), w(' ', 'speaker_0', null, null, 'spacing'), w('Marco', 'speaker_0', 1, 2),
    w(' ', 'speaker_1', null, null, 'spacing'), w('Buongiorno', 'speaker_1', 2.5, 3.5)],
}

function makeResponse() {
  return { statusCode: 0, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
}

async function call(body, { ok = true } = {}) {
  let sent
  mock.method(globalThis, 'fetch', async (url, init) => {
    sent = { url, form: init.body }
    return ok ? new Response(JSON.stringify(scribe)) : new Response('boom', { status: 500 })
  })
  deleted.length = 0
  blobGet.mock.resetCalls()
  const response = makeResponse()
  await handler({ method: 'POST', body: { blobUrl: 'https://x/audio/abc-call.mp3', ...body } }, response)
  mock.restoreAll()
  return { response, sent }
}

test('diarizzazione attiva di default: diarize=true, segments e speakers, blob cancellato', async () => {
  const { response, sent } = await call({})
  assert.equal(response.statusCode, 200)
  assert.equal(sent.form.get('diarize'), 'true')
  assert.equal(sent.form.get('timestamps_granularity'), 'word')
  assert.equal(sent.form.get('model_id'), 'scribe_v2')
  assert.equal(sent.form.get('num_speakers'), null)
  assert.deepEqual(response.body.speakers, ['speaker_0', 'speaker_1'])
  assert.deepEqual(response.body.segments.map((s) => s.text), ['Ciao Marco', 'Buongiorno'])
  assert.equal(response.body.transcript, scribe.text)
  assert.equal(response.body.cleanupCompleted, true)
  assert.deepEqual(deleted, ['audio/abc-call.mp3'])
})

test('numSpeakers valido viene inviato come num_speakers', async () => {
  const { response, sent } = await call({ numSpeakers: 2 })
  assert.equal(response.statusCode, 200)
  assert.equal(sent.form.get('num_speakers'), '2')
})

test('numSpeakers non valido → 422 senza chiamare ElevenLabs', async () => {
  for (const numSpeakers of [0, 33, 1.5, 'abc']) {
    const { response, sent } = await call({ numSpeakers })
    assert.equal(response.statusCode, 422, String(numSpeakers))
    assert.equal(sent, undefined)
  }
})

test('diarize=false: nessun parametro diarize e nessun segmento', async () => {
  const { response, sent } = await call({ diarize: false })
  assert.equal(response.statusCode, 200)
  assert.equal(sent.form.get('diarize'), null)
  assert.deepEqual(response.body.segments, [])
  assert.deepEqual(response.body.speakers, [])
  assert.equal(response.body.transcript, scribe.text)
})

test('errore ElevenLabs → 502 e blob comunque cancellato', async () => {
  const { response } = await call({}, { ok: false })
  assert.equal(response.statusCode, 502)
  assert.deepEqual(deleted, ['audio/abc-call.mp3'])
})

test('keyterms validi inviati come campi ripetuti', async () => {
  const { response, sent } = await call({ keyterms: ['AIEH', 'Relay app'] })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(sent.form.getAll('keyterms'), ['AIEH', 'Relay app'])
})

test('keyterms assenti: nessun campo; non validi → 422 senza chiamare ElevenLabs', async () => {
  assert.deepEqual((await call({})).sent.form.getAll('keyterms'), [])
  for (const keyterms of ['AIEH', ['a<b'], Array.from({ length: 51 }, (_, i) => `t${i}`)]) {
    const { response, sent } = await call({ keyterms })
    assert.equal(response.statusCode, 422)
    assert.equal(sent, undefined)
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSegments, listSpeakers, parseNumSpeakers } from '../api/_lib/segments.js'

const w = (text, speaker_id, start = 0, end = 1, type = 'word') => ({ text, type, start, end, speaker_id })
const sp = (speaker_id) => ({ text: ' ', type: 'spacing', start: null, end: null, speaker_id })

test('2 speaker alternati', () => {
  const words = [w('Ciao', 'speaker_0', 0, 1), sp('speaker_0'), w('a', 'speaker_0', 1, 1.5), sp('speaker_0'),
    w('Buongiorno', 'speaker_1', 2, 3), sp('speaker_1'), w('Marco', 'speaker_1', 3, 4), sp('speaker_0'),
    w('Grazie', 'speaker_0', 5, 6)]
  const segments = buildSegments(words)
  assert.deepEqual(segments.map((s) => [s.speaker, s.text]), [
    ['speaker_0', 'Ciao a'], ['speaker_1', 'Buongiorno Marco'], ['speaker_0', 'Grazie']])
  assert.equal(segments[1].start, 2)
  assert.equal(segments[1].end, 4)
  assert.deepEqual(listSpeakers(segments), ['speaker_0', 'speaker_1'])
})

test('3 speaker in ordine di apparizione', () => {
  const segments = buildSegments([w('a', 'speaker_2'), sp('speaker_2'), w('b', 'speaker_0'), sp('speaker_0'), w('c', 'speaker_1')])
  assert.deepEqual(listSpeakers(segments), ['speaker_2', 'speaker_0', 'speaker_1'])
})

test('1 solo speaker', () => {
  const segments = buildSegments([w('uno', 'speaker_0'), sp('speaker_0'), w('due', 'speaker_0')])
  assert.equal(segments.length, 1)
  assert.equal(segments[0].text, 'uno due')
})

test('speaker_id mancante: fallback a un solo speaker', () => {
  const segments = buildSegments([w('uno', null), sp(null), w('due', undefined)])
  assert.deepEqual(segments.map((s) => [s.speaker, s.text]), [['speaker_0', 'uno due']])
})

test('speaker_id mancante dopo un speaker noto eredita il precedente', () => {
  const segments = buildSegments([w('a', 'speaker_1'), sp(null), w('b', null)])
  assert.deepEqual(segments.map((s) => [s.speaker, s.text]), [['speaker_1', 'a b']])
})

test('audio_event incluso nel testo senza rompere i segmenti', () => {
  const segments = buildSegments([w('ciao', 'speaker_0'), sp('speaker_0'), w('(risata)', 'speaker_0', 1, 2, 'audio_event'), sp('speaker_1'), w('ok', 'speaker_1')])
  assert.deepEqual(segments.map((s) => s.text), ['ciao (risata)', 'ok'])
})

test('spacing iniziale e finale ignorati', () => {
  const segments = buildSegments([sp(null), w('ciao', 'speaker_0'), sp('speaker_0')])
  assert.equal(segments[0].text, 'ciao')
})

test('risposta vuota o malformata', () => {
  assert.deepEqual(buildSegments([]), [])
  assert.deepEqual(buildSegments(undefined), [])
  assert.deepEqual(buildSegments([null, {}, { text: 5 }]), [])
})

test('parseNumSpeakers', () => {
  assert.equal(parseNumSpeakers(undefined), null)
  assert.equal(parseNumSpeakers(''), null)
  assert.equal(parseNumSpeakers(2), 2)
  assert.equal(parseNumSpeakers('3'), 3)
  assert.equal(parseNumSpeakers(32), 32)
  for (const bad of [0, 33, -1, 1.5, 'abc', '2x', NaN]) assert.equal(parseNumSpeakers(bad), undefined, String(bad))
})

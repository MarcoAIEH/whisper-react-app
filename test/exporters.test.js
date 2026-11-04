import test from 'node:test'
import assert from 'node:assert/strict'
import { availableFormats, clockTime, exportItem, toMarkdown, toSrt, toVtt } from '../src/exporters.js'
import { MAX_TEXT_CHARS, PRESETS, findPreset } from '../api/_lib/presets.js'
import { parseKeyterms, splitKeyterms } from '../api/_lib/keyterms.js'

const item = {
  transcript: 'x',
  speakers: ['speaker_0', 'speaker_1'],
  names: { speaker_0: 'Marco' },
  segments: [
    { speaker: 'speaker_0', start: 1, end: 3.5, text: 'Ciao' },
    { speaker: 'speaker_1', start: 4, end: 6, text: 'Buongiorno' },
  ],
}

test('formato tempo SRT e VTT', () => {
  assert.equal(clockTime(1, ','), '00:00:01,000')
  assert.equal(clockTime(1, '.'), '00:00:01.000')
  assert.equal(clockTime(3725.5, ','), '01:02:05,500')
})

test('SRT: numerazione, tempi e nomi rinominati', () => {
  assert.equal(toSrt(item), '1\n00:00:01,000 --> 00:00:03,500\nMarco: Ciao\n\n2\n00:00:04,000 --> 00:00:06,000\nSpeaker 2: Buongiorno\n')
})

test('VTT: intestazione e separatore punto', () => {
  assert.ok(toVtt(item).startsWith('WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.500\nMarco: Ciao'))
})

test('segmento senza timestamp: tempi ricostruiti', () => {
  const srt = toSrt({ ...item, segments: [{ speaker: 'speaker_0', start: null, end: null, text: 'a' }, { speaker: 'speaker_1', start: 10, end: null, text: 'b' }] })
  assert.ok(srt.includes('00:00:00,000 --> 00:00:10,000\nMarco: a'))
  assert.ok(srt.includes('00:00:10,000 --> 00:00:13,000\nSpeaker 2: b'))
})

test('un solo speaker: cue senza etichetta; lista vuota: stringa vuota', () => {
  assert.ok(toSrt({ ...item, speakers: ['speaker_0'], segments: [item.segments[0]] }).includes('\nCiao\n'))
  assert.equal(toSrt({ ...item, segments: [] }), '')
})

test('Markdown con speaker in grassetto e fallback testo piatto', () => {
  assert.equal(toMarkdown(item, 'Call'), '# Call\n\n**Marco:** Ciao\n\n**Speaker 2:** Buongiorno\n')
  assert.equal(toMarkdown({ transcript: 'solo testo', segments: [], speakers: [] }, 'T'), '# T\n\nsolo testo\n')
})

test('formati disponibili: sottotitoli solo con segmenti', () => {
  assert.deepEqual(availableFormats(item).map((f) => f.id), ['txt', 'md', 'srt', 'vtt'])
  assert.deepEqual(availableFormats({ transcript: 'x', segments: [] }).map((f) => f.id), ['txt', 'md'])
})

test('exportItem txt coincide con formatTranscript', () => {
  assert.equal(exportItem(item, 'txt'), 'Marco: Ciao\n\nSpeaker 2: Buongiorno')
})

test('preset: id univoci, campi presenti, ricerca', () => {
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length)
  for (const p of PRESETS) assert.ok(p.id && p.label && p.prompt)
  assert.equal(findPreset('riassunto').id, 'riassunto')
  assert.equal(findPreset('boh'), undefined)
  assert.ok(MAX_TEXT_CHARS > 0)
})

test('keyterms: split e validazione', () => {
  assert.deepEqual(splitKeyterms(' Marco , AIEH,,Marco '), ['Marco', 'AIEH'])
  assert.equal(parseKeyterms(undefined), null)
  assert.equal(parseKeyterms([]), null)
  assert.deepEqual(parseKeyterms(['AIEH', 'Relay app']), ['AIEH', 'Relay app'])
  assert.equal(parseKeyterms('AIEH'), undefined)
  assert.equal(parseKeyterms(['a<b']), undefined)
  assert.equal(parseKeyterms(['uno due tre quattro cinque sei']), undefined)
  assert.equal(parseKeyterms(['x'.repeat(51)]), undefined)
  assert.equal(parseKeyterms(Array.from({ length: 51 }, (_, i) => `t${i}`)), undefined)
  assert.equal(parseKeyterms([123]), undefined)
})

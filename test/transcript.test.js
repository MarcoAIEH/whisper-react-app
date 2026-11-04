import test from 'node:test'
import assert from 'node:assert/strict'
import { formatTranscript, formatTimestamp, speakerName } from '../src/transcript.js'

const item = {
  transcript: 'testo piatto',
  speakers: ['speaker_1', 'speaker_0'],
  segments: [
    { speaker: 'speaker_1', start: 0, end: 2, text: 'Ciao a tutti' },
    { speaker: 'speaker_0', start: 65, end: 70, text: 'Buongiorno' },
  ],
  names: {},
}

test('nomi di default in ordine di apparizione', () => {
  assert.equal(formatTranscript(item), 'Speaker 1: Ciao a tutti\n\nSpeaker 2: Buongiorno')
})

test('nomi rinominati e timestamp', () => {
  const renamed = { ...item, names: { speaker_1: 'Marco', speaker_0: 'Giulia' } }
  assert.equal(formatTranscript(renamed), 'Marco: Ciao a tutti\n\nGiulia: Buongiorno')
  assert.equal(formatTranscript(renamed, { withTimestamps: true }), '[00:00] Marco: Ciao a tutti\n\n[01:05] Giulia: Buongiorno')
})

test('nome vuoto o spazi → default', () => {
  assert.equal(speakerName({ speaker_1: '   ' }, item.speakers, 'speaker_1'), 'Speaker 1')
})

test('nomi duplicati: nessun testo perso', () => {
  const dup = { ...item, names: { speaker_1: 'Anna', speaker_0: 'Anna' } }
  assert.equal(formatTranscript(dup), 'Anna: Ciao a tutti\n\nAnna: Buongiorno')
})

test('un solo speaker o nessun segmento → testo identico a oggi', () => {
  assert.equal(formatTranscript({ ...item, speakers: ['speaker_0'] }), 'testo piatto')
  assert.equal(formatTranscript({ transcript: 'x', segments: [], speakers: [] }), 'x')
  assert.equal(formatTranscript({ transcript: 'x' }), 'x')
})

test('formatTimestamp con ore', () => {
  assert.equal(formatTimestamp(3725), '1:02:05')
  assert.equal(formatTimestamp(null), '00:00')
})

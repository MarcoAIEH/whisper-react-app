const DEFAULT_SPEAKER = 'speaker_0'

export function parseNumSpeakers(value) {
  if (value === undefined || value === null || value === '') return null
  const number = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value
  return Number.isInteger(number) && number >= 1 && number <= 32 ? number : undefined
}

export function buildSegments(words) {
  const segments = []
  let current = null
  let lastSpeaker = null

  for (const word of Array.isArray(words) ? words : []) {
    if (typeof word?.text !== 'string') continue
    const isSpacing = word.type === 'spacing'
    const speaker = word.speaker_id || lastSpeaker || DEFAULT_SPEAKER
    if (!current || (speaker !== current.speaker && !(isSpacing && !word.speaker_id))) {
      if (isSpacing && !current) continue
      current = { speaker, start: null, end: null, text: '' }
      segments.push(current)
    }
    lastSpeaker = current.speaker
    current.text += word.text
    if (!isSpacing) {
      if (current.start === null && typeof word.start === 'number') current.start = word.start
      if (typeof word.end === 'number') current.end = word.end
    }
  }

  return segments
    .map((segment) => ({ ...segment, text: segment.text.trim() }))
    .filter((segment) => segment.text)
}

export const listSpeakers = (segments) => [...new Set(segments.map((segment) => segment.speaker))]

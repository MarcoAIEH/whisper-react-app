import { formatTranscript, hasSpeakers, speakerName } from './transcript.js'

const pad = (value, size = 2) => String(value).padStart(size, '0')

export function clockTime(seconds, separator) {
  const ms = Math.max(0, Math.round((seconds ?? 0) * 1000))
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor((ms % 3600000) / 60000))}:${pad(Math.floor((ms % 60000) / 1000))}${separator}${pad(ms % 1000, 3)}`
}

// Completa i tempi mancanti: start = fine del precedente, end = inizio del successivo (o +3s).
function timedCues(item) {
  const cues = []
  let previousEnd = 0
  item.segments.forEach((segment, index) => {
    const start = typeof segment.start === 'number' ? segment.start : previousEnd
    const next = item.segments[index + 1]
    const end = typeof segment.end === 'number' && segment.end > start ? segment.end : (typeof next?.start === 'number' && next.start > start ? next.start : start + 3)
    const label = hasSpeakers(item) ? `${speakerName(item.names, item.speakers, segment.speaker)}: ` : ''
    cues.push({ start, end, text: `${label}${segment.text}` })
    previousEnd = end
  })
  return cues
}

export const toSrt = (item) => timedCues(item)
  .map((cue, index) => `${index + 1}\n${clockTime(cue.start, ',')} --> ${clockTime(cue.end, ',')}\n${cue.text}\n`)
  .join('\n')

export const toVtt = (item) => `WEBVTT\n\n${timedCues(item)
  .map((cue, index) => `${index + 1}\n${clockTime(cue.start, '.')} --> ${clockTime(cue.end, '.')}\n${cue.text}\n`)
  .join('\n')}`

export function toMarkdown(item, title) {
  const heading = `# ${title}\n\n`
  if (!hasSpeakers(item)) return `${heading}${item.transcript}\n`
  return `${heading}${item.segments.map((segment) => `**${speakerName(item.names, item.speakers, segment.speaker)}:** ${segment.text}`).join('\n\n')}\n`
}

export const FORMATS = [
  { id: 'txt', label: '.txt', needsSegments: false, mime: 'text/plain;charset=utf-8' },
  { id: 'md', label: '.md', needsSegments: false, mime: 'text/markdown;charset=utf-8' },
  { id: 'srt', label: '.srt (sottotitoli)', needsSegments: true, mime: 'application/x-subrip;charset=utf-8' },
  { id: 'vtt', label: '.vtt (sottotitoli web)', needsSegments: true, mime: 'text/vtt;charset=utf-8' },
]

export const availableFormats = (item) => FORMATS.filter((format) => !format.needsSegments || item.segments?.length > 0)

export function exportItem(item, formatId, { title = 'Trascrizione', withTimestamps = false } = {}) {
  if (formatId === 'md') return toMarkdown(item, title)
  if (formatId === 'srt') return toSrt(item)
  if (formatId === 'vtt') return toVtt(item)
  return formatTranscript(item, { withTimestamps })
}

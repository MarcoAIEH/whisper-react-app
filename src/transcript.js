export const defaultSpeakerName = (speakers, speakerId) => `Speaker ${Math.max(speakers.indexOf(speakerId), 0) + 1}`

export const speakerName = (names, speakers, speakerId) => names?.[speakerId]?.trim() || defaultSpeakerName(speakers, speakerId)

export const formatTimestamp = (seconds) => {
  const total = Math.max(0, Math.floor(seconds ?? 0))
  const pad = (value) => String(value).padStart(2, '0')
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return hours ? `${hours}:${pad(minutes)}:${pad(total % 60)}` : `${pad(minutes)}:${pad(total % 60)}`
}

export const hasSpeakers = ({ segments, speakers }) => Boolean(segments?.length) && speakers?.length > 1

export function formatTranscript(item, { withTimestamps = false } = {}) {
  if (!hasSpeakers(item)) return item.transcript
  return item.segments
    .map((segment) => {
      const time = withTimestamps && segment.start !== null ? `[${formatTimestamp(segment.start)}] ` : ''
      return `${time}${speakerName(item.names, item.speakers, segment.speaker)}: ${segment.text}`
    })
    .join('\n\n')
}

const TARGET_BYTES = 23 * 1024 * 1024
const SAMPLE_RATE = 16000
const MIN_BITRATE_KBPS = 16
const MAX_BITRATE_KBPS = 64
const ENCODE_BLOCK_SIZE = 1152

function floatTo16BitPCM(floatSamples) {
  const output = new Int16Array(floatSamples.length)
  for (let i = 0; i < floatSamples.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, floatSamples[i]))
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }
  return output
}

async function encodeMp3(pcmInt16, bitrateKbps) {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const encoder = new Mp3Encoder(1, SAMPLE_RATE, bitrateKbps)
  const chunks = []
  for (let i = 0; i < pcmInt16.length; i += ENCODE_BLOCK_SIZE) {
    const block = pcmInt16.subarray(i, i + ENCODE_BLOCK_SIZE)
    const encoded = encoder.encodeBuffer(block)
    if (encoded.length > 0) chunks.push(encoded)
  }
  const final = encoder.flush()
  if (final.length > 0) chunks.push(final)
  return chunks
}

// Downmixes to mono, resamples to 16 kHz and encodes to MP3 at the highest
// bitrate that should still fit under OpenAI's 25 MB transcription limit.
export async function compressAudioToMp3(file) {
  const arrayBuffer = await file.arrayBuffer()
  const audioContext = new (window.AudioContext || window.webkitAudioContext)()
  let decoded
  try {
    decoded = await audioContext.decodeAudioData(arrayBuffer)
  } finally {
    await audioContext.close()
  }

  const frameCount = Math.ceil(decoded.duration * SAMPLE_RATE)
  const offlineContext = new OfflineAudioContext(1, frameCount, SAMPLE_RATE)
  const source = offlineContext.createBufferSource()
  source.buffer = decoded
  source.connect(offlineContext.destination)
  source.start()
  const rendered = await offlineContext.startRendering()
  const samples = rendered.getChannelData(0)

  const bitrateKbps = Math.min(
    MAX_BITRATE_KBPS,
    Math.max(MIN_BITRATE_KBPS, Math.floor((TARGET_BYTES * 8) / (1000 * rendered.duration))),
  )

  const pcm = floatTo16BitPCM(samples)
  const mp3Chunks = await encodeMp3(pcm, bitrateKbps)
  const blob = new Blob(mp3Chunks, { type: 'audio/mpeg' })
  return { blob, bitrateKbps }
}

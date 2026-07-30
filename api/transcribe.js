import { del, get } from '@vercel/blob'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

const MAX_AUDIO_BYTES = 100 * 1024 * 1024
const LANGUAGE_PATTERN = /^[a-z]{2,3}$/i

function isAuthorized(accessCode) {
  return Boolean(process.env.TRANSCRIBER_ACCESS_TOKEN)
    && accessCode === process.env.TRANSCRIBER_ACCESS_TOKEN
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ detail: 'Metodo non consentito.' })
  const { blobUrl, language = 'it', accessCode } = request.body || {}
  if (!isAuthorized(accessCode)) return response.status(401).json({ detail: 'Non autorizzato.' })
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('Transcription: ELEVENLABS_API_KEY is not set in this environment')
    return response.status(503).json({ detail: 'Servizio di trascrizione non configurato: manca ELEVENLABS_API_KEY.' })
  }
  if (typeof blobUrl !== 'string' || !LANGUAGE_PATTERN.test(language)) {
    return response.status(422).json({ detail: 'Richiesta non valida.' })
  }

  let blob
  let cleanedUp = false
  try {
    blob = await get(blobUrl, {
      access: 'private',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })
    if (!blob || !blob.blob.pathname.startsWith('audio/') || blob.blob.size > MAX_AUDIO_BYTES) {
      return response.status(422).json({ detail: 'File non valido o oltre il limite di 100 MB.' })
    }
    const isOpus = blob.blob.pathname.toLowerCase().endsWith('.opus')
    const audio = new Blob([await new Response(blob.stream).arrayBuffer()], {
      type: isOpus ? 'audio/ogg' : blob.blob.contentType,
    })
    const originalFilename = blob.blob.pathname.split('/').at(-1)
    const audioFilename = isOpus ? originalFilename.replace(/\.opus$/i, '.ogg') : originalFilename

    const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })
    let result
    try {
      result = await client.speechToText.convert({
        modelId: 'scribe_v2',
        file: { data: audio, filename: audioFilename, contentType: audio.type },
        languageCode: language.toLowerCase(),
        tagAudioEvents: false,
      })
    } catch (error) {
      console.error('ElevenLabs transcription error', error?.statusCode ?? '', error?.message ?? error)
      return response.status(502).json({ detail: 'Il servizio di trascrizione non è disponibile.' })
    }
    try {
      await del(blob.blob.pathname, { token: process.env.BLOB_READ_WRITE_TOKEN })
      cleanedUp = true
    } catch (error) {
      console.error('Blob cleanup error', error)
    }
    return response.status(200).json({
      transcript: result.text,
      model: 'scribe_v2',
      cleanupCompleted: cleanedUp,
    })
  } catch (error) {
    console.error('Transcription error', error)
    return response.status(500).json({ detail: 'Trascrizione non riuscita.' })
  } finally {
    if (!cleanedUp && blob?.blob?.pathname) {
      await del(blob.blob.pathname, { token: process.env.BLOB_READ_WRITE_TOKEN })
        .catch((error) => console.error('Blob cleanup error', error))
    }
  }
}

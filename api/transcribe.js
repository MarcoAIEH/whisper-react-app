import { del, get } from '@vercel/blob'
import ffmpegPath from 'ffmpeg-static'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { requireAuth } from './_lib/auth.js'
import { parseKeyterms } from './_lib/keyterms.js'
import { buildSegments, listSpeakers, parseNumSpeakers } from './_lib/segments.js'

const MAX_AUDIO_BYTES = 100 * 1024 * 1024
const LANGUAGE_PATTERN = /^[a-z]{2,3}$/i
const ISO_639_3_LANGUAGE_CODES = {
  it: 'ita',
  en: 'eng',
  fr: 'fra',
  de: 'deu',
  es: 'spa',
  pt: 'por',
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('FFmpeg non disponibile.'))
    const process = spawn(ffmpegPath, args)
    let stderr = ''
    process.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    process.once('error', reject)
    process.once('close', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`Conversione AAC fallita (ffmpeg ${code}): ${stderr.slice(-500)}`))
    })
  })
}

async function normalizeAac(audioBytes) {
  const jobId = randomUUID()
  const tempDirectory = join(tmpdir(), `whisper-aac-${jobId}`)
  const inputPath = join(tempDirectory, 'input.aac')
  const outputPath = join(tempDirectory, 'normalized.m4a')

  try {
    await mkdir(tempDirectory, { recursive: true })
    await writeFile(inputPath, Buffer.from(audioBytes))
    await runFfmpeg([
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', inputPath,
      '-vn',
      '-c:a', 'aac',
      '-b:a', '128k',
      outputPath,
    ])
    const output = await readFile(outputPath)
    if ((await stat(outputPath)).size > MAX_AUDIO_BYTES) {
      throw new Error('Il file convertito supera il limite di 100 MB.')
    }
    return new Blob([output], { type: 'audio/mp4' })
  } finally {
    await rm(tempDirectory, { recursive: true, force: true })
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ detail: 'Metodo non consentito.' })
  if (!requireAuth(request, response)) return
  const { blobUrl, language = 'it', diarize = true, numSpeakers, keyterms } = request.body || {}
  if (!process.env.ELEVENLABS_API_KEY) return response.status(503).json({ detail: 'Servizio di trascrizione non configurato.' })
  const speakerCount = parseNumSpeakers(numSpeakers)
  const terms = parseKeyterms(keyterms)
  if (typeof blobUrl !== 'string' || !LANGUAGE_PATTERN.test(language) || typeof diarize !== 'boolean' || speakerCount === undefined || terms === undefined) {
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
    const originalFilename = blob.blob.pathname.split('/').at(-1)
    const audioBytes = await new Response(blob.stream).arrayBuffer()
    const extension = originalFilename.split('.').at(-1)?.toLowerCase()
    const isOpus = extension === 'opus'
    const isAac = extension === 'aac'
    const audio = isAac
      ? await normalizeAac(audioBytes)
      : new Blob([audioBytes], { type: isOpus ? 'audio/ogg' : blob.blob.contentType })
    const body = new FormData()
    const elevenLabsFilename = isAac
      ? originalFilename.replace(/\.aac$/i, '.m4a')
      : isOpus
        ? originalFilename.replace(/\.opus$/i, '.ogg')
        : originalFilename
    body.append('file', audio, elevenLabsFilename)
    body.append('model_id', 'scribe_v2')
    if (diarize) {
      body.append('diarize', 'true')
      body.append('timestamps_granularity', 'word')
      if (speakerCount !== null) body.append('num_speakers', String(speakerCount))
    }
    if (terms) for (const term of terms) body.append('keyterms', term)
    const languageCode = ISO_639_3_LANGUAGE_CODES[language.toLowerCase()]
    if (languageCode) body.append('language_code', languageCode)

    const elevenLabsResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
      body,
    })
    if (!elevenLabsResponse.ok) {
      const detail = (await elevenLabsResponse.text()).slice(0, 500)
      console.error('ElevenLabs transcription error', elevenLabsResponse.status, detail)
      return response.status(502).json({ detail: 'Il servizio di trascrizione non è disponibile.' })
    }
    const result = await elevenLabsResponse.json()
    try {
      await del(blob.blob.pathname, { token: process.env.BLOB_READ_WRITE_TOKEN })
      cleanedUp = true
    } catch (error) {
      console.error('Blob cleanup error', error)
    }
    const segments = diarize ? buildSegments(result.words) : []
    return response.status(200).json({
      transcript: result.text,
      model: 'scribe_v2',
      cleanupCompleted: cleanedUp,
      segments,
      speakers: listSpeakers(segments),
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

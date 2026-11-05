import { del, head } from '@vercel/blob'
import { requireAuth } from './_lib/auth.js'

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ detail: 'Metodo non consentito.' })
  if (!requireAuth(request, response)) return
  const { blobUrl } = request.body || {}
  if (typeof blobUrl !== 'string') {
    return response.status(422).json({ detail: 'Richiesta non valida.' })
  }

  try {
    const blob = await head(blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN })
    if (!blob.pathname.startsWith('audio/')) return response.status(422).json({ detail: 'File non valido.' })
    await del(blob.pathname, { token: process.env.BLOB_READ_WRITE_TOKEN })
    return response.status(200).json({ deleted: true })
  } catch (error) {
    console.error('Client cleanup error', error)
    return response.status(500).json({ detail: 'Cancellazione non riuscita.' })
  }
}

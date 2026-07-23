import { del, head } from '@vercel/blob'

function isAuthorized(accessCode) {
  return Boolean(process.env.TRANSCRIBER_ACCESS_TOKEN)
    && accessCode === process.env.TRANSCRIBER_ACCESS_TOKEN
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ detail: 'Metodo non consentito.' })
  const { blobUrl, accessCode } = request.body || {}
  if (!isAuthorized(accessCode) || typeof blobUrl !== 'string') {
    return response.status(401).json({ detail: 'Non autorizzato.' })
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

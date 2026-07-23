import { del, list } from '@vercel/blob'

const MINIMUM_AGE_MS = 5 * 60 * 1000

function isCronRequest(request) {
  return Boolean(process.env.CRON_SECRET)
    && request.headers.authorization === `Bearer ${process.env.CRON_SECRET}`
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ detail: 'Metodo non consentito.' })
  if (!isCronRequest(request)) return response.status(401).json({ detail: 'Non autorizzato.' })

  try {
    const cutoff = Date.now() - MINIMUM_AGE_MS
    const stale = []
    let cursor
    do {
      const page = await list({
        prefix: 'audio/',
        limit: 1000,
        cursor,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
      stale.push(...page.blobs.filter((blob) => new Date(blob.uploadedAt).getTime() < cutoff))
      cursor = page.cursor
    } while (cursor)
    if (stale.length) await del(stale.map((blob) => blob.pathname), { token: process.env.BLOB_READ_WRITE_TOKEN })
    return response.status(200).json({ deleted: stale.length })
  } catch (error) {
    console.error('Stale blob cleanup error', error)
    return response.status(500).json({ detail: 'Cancellazione non riuscita.' })
  }
}

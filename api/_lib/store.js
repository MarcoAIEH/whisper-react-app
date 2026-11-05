import { get, put } from '@vercel/blob'

// Piccoli file JSON privati su Vercel Blob (utenti, contatori tentativi). Nessun database.
const token = () => process.env.BLOB_READ_WRITE_TOKEN

export async function readJson(pathname) {
  try {
    const result = await get(pathname, { access: 'private', token: token(), useCache: false })
    if (!result) return null
    return JSON.parse(await new Response(result.stream).text())
  } catch (error) {
    if (error?.name === 'BlobNotFoundError' || /not.?found/i.test(error?.message ?? '')) return null
    throw error
  }
}

export const writeJson = (pathname, data) => put(pathname, JSON.stringify(data), {
  access: 'private',
  token: token(),
  allowOverwrite: true,
  addRandomSuffix: false,
  contentType: 'application/json',
})

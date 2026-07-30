import { handleUpload } from '@vercel/blob/client'

const ALLOWED_CONTENT_TYPES = ['audio/*', 'video/mp4', 'video/quicktime', 'video/webm']
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024

function isAuthorized(accessCode) {
  return Boolean(process.env.TRANSCRIBER_ACCESS_TOKEN)
    && accessCode === process.env.TRANSCRIBER_ACCESS_TOKEN
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ detail: 'Metodo non consentito.' })

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('Blob upload: BLOB_READ_WRITE_TOKEN is not configured')
    return response.status(503).json({ detail: 'Storage non configurato.' })
  }

  try {
    const result = await handleUpload({
      body: request.body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { accessCode } = JSON.parse(clientPayload || '{}')
        if (!pathname.startsWith('audio/')) {
          console.error('Blob upload token error: invalid pathname', pathname)
          throw new Error('Non autorizzato.')
        }
        if (!isAuthorized(accessCode)) {
          console.error('Blob upload token error: access code mismatch')
          throw new Error('Non autorizzato.')
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          validUntil: Date.now() + 5 * 60 * 1000,
          addRandomSuffix: true,
          allowOverwrite: false,
        }
      },
      onUploadCompleted: async () => {},
    })
    return response.status(200).json(result)
  } catch (error) {
    console.error('Blob upload token error', error?.message ?? error)
    return response.status(401).json({ detail: 'Upload non autorizzato.' })
  }
}

import { handleUpload } from '@vercel/blob/client'

const ALLOWED_CONTENT_TYPES = ['audio/*', 'video/mp4', 'video/quicktime', 'video/webm']
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

function isAuthorized(accessCode) {
  return Boolean(process.env.TRANSCRIBER_ACCESS_TOKEN)
    && accessCode === process.env.TRANSCRIBER_ACCESS_TOKEN
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return response.status(405).json({ detail: 'Metodo non consentito.' })

  try {
    const result = await handleUpload({
      body: request.body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const { accessCode } = JSON.parse(clientPayload || '{}')
        if (!pathname.startsWith('audio/') || !isAuthorized(accessCode)) throw new Error('Non autorizzato.')
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
    console.error('Blob upload token error', error)
    return response.status(401).json({ detail: 'Upload non autorizzato.' })
  }
}

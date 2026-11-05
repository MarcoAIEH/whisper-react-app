import { mock } from 'node:test'

// Store Blob in memoria per i test (utenti, contatori tentativi).
export const memory = new Map()
export const failures = { read: false }
mock.module('@vercel/blob', {
  namedExports: {
    get: async (path) => {
      if (failures.read) throw new Error('store non raggiungibile')
      return memory.has(path) ? { stream: new Response(memory.get(path)).body, blob: { pathname: path } } : null
    },
    put: async (path, body) => { memory.set(path, body); return { pathname: path } },
    del: async () => {}, head: async () => ({}), list: async () => ({ blobs: [] }),
  },
})

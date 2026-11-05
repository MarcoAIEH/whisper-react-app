const ALPHABET = 'abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRTUVWXY346789'

// Password casuale leggibile (4 gruppi da 4 caratteri, senza lettere ambigue), generata nel browser.
export function generatePassword(random = globalThis.crypto) {
  const values = random.getRandomValues(new Uint32Array(16))
  const chars = Array.from(values, (value) => ALPHABET[value % ALPHABET.length])
  return [0, 4, 8, 12].map((start) => chars.slice(start, start + 4).join('')).join('-')
}

export const MIN_PASSWORD = 10
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,31}$/

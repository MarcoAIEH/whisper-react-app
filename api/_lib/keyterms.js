export const MAX_KEYTERMS = 50
const FORBIDDEN = /[<>{}[\]\\]/

// Da stringa "a, b, c" a lista pulita e deduplicata (usata dal frontend).
export const splitKeyterms = (input) => [...new Set(String(input ?? '').split(',').map((term) => term.trim()).filter(Boolean))]

// Valida la lista lato server: null = assente, undefined = non valida.
export function parseKeyterms(value) {
  if (value === undefined || value === null) return null
  if (!Array.isArray(value) || value.length > MAX_KEYTERMS) return undefined
  const valid = value.every((term) => typeof term === 'string' && term.trim() && term.length <= 50 && term.trim().split(/\s+/).length <= 5 && !FORBIDDEN.test(term))
  if (!valid) return undefined
  const terms = [...new Set(value.map((term) => term.trim()))]
  return terms.length ? terms : null
}

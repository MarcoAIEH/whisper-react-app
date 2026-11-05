import { createSession } from '../api/_lib/auth.js'

export const AUTH_SECRET = 'test-secret-0123456789'
export const setAuthEnv = () => {
  process.env.AUTH_SECRET = AUTH_SECRET
  process.env.AUTH_USERS = JSON.stringify({ laura: { hash: 'scrypt$00$00', name: 'Laura', role: 'user' } })
}
export const authHeaders = () => ({ cookie: `wt_session=${createSession({ username: 'laura', name: 'Laura', role: 'user' }, AUTH_SECRET)}` })

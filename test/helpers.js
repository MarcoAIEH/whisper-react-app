import { createSession } from '../api/_lib/auth.js'
import { passwordVersion, primeUsers } from '../api/_lib/users.js'

export const AUTH_SECRET = 'test-secret-0123456789'
export const DEFAULT_USERS = {
  laura: { hash: 'scrypt$00$00', name: 'Laura', role: 'user' },
  marco: { hash: 'scrypt$11$11', name: 'Marco', role: 'admin' },
}
export const setAuthEnv = (users = DEFAULT_USERS) => {
  process.env.AUTH_SECRET = AUTH_SECRET
  process.env.AUTH_USERS = JSON.stringify(users)
  primeUsers(users)
}
export const authHeaders = (username = 'laura', users = DEFAULT_USERS) => ({
  cookie: `wt_session=${createSession({ username, name: users[username].name, role: users[username].role, pv: passwordVersion(users[username].hash) }, AUTH_SECRET)}`,
})

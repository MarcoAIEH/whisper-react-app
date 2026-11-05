// Uso: node scripts/hash-password.js  (la password viene letta da stdin, mai dagli argomenti)
import { hashPassword } from '../api/_lib/auth.js'

let input = ''
for await (const chunk of process.stdin) input += chunk
console.log(await hashPassword(input.replace(/\r?\n$/, '')))

import test from 'node:test'
import assert from 'node:assert/strict'
import { MIN_PASSWORD, USERNAME_PATTERN, generatePassword } from '../src/password.js'

test('password generata: formato, lunghezza e unicità', () => {
  const passwords = Array.from({ length: 50 }, () => generatePassword())
  for (const password of passwords) {
    assert.match(password, /^[A-Za-z0-9]{4}(-[A-Za-z0-9]{4}){3}$/)
    assert.ok(password.length >= MIN_PASSWORD)
    assert.ok(!/[lIO01Z25S]/.test(password.replace(/-/g, '')), password)
  }
  assert.equal(new Set(passwords).size, passwords.length)
})

test('nome utente: pattern', () => {
  for (const ok of ['laura', 'a.b', 'marco-2', 'u_x'.replace('_', '-')]) assert.match(ok, USERNAME_PATTERN)
  for (const bad of ['A', 'Laura', 'bad name', '-x', '', 'x'.repeat(33)]) assert.doesNotMatch(bad, USERNAME_PATTERN)
})

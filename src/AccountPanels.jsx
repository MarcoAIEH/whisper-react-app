import { useEffect, useId, useState } from 'react'
import { MIN_PASSWORD, USERNAME_PATTERN, generatePassword } from './password.js'

const request = async (url, method, payload) => {
  const response = await fetch(url, {
    method,
    headers: payload ? { 'Content-Type': 'application/json' } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(body.detail || 'Operazione non riuscita.')
    error.status = response.status
    throw error
  }
  return body
}

function PasswordField({ label, value, onChange, onBlur, autoComplete, error, helper, children }) {
  const [visible, setVisible] = useState(false)
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <span className="password-row">
        <input id={id} type={visible ? 'text' : 'password'} value={value} autoComplete={autoComplete} aria-invalid={Boolean(error)} aria-describedby={error || helper ? `${id}-d` : undefined} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} />
        <button type="button" className="ghost" aria-pressed={visible} onClick={() => setVisible((current) => !current)}>{visible ? 'Nascondi' : 'Mostra'}</button>
        {children}
      </span>
      {error ? <span id={`${id}-d`} className="field-error" role="alert">{error}</span> : helper && <span id={`${id}-d`} className="hint">{helper}</span>}
    </div>
  )
}

export function UsersPanel({ me, onSessionExpired }) {
  const [users, setUsers] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'user' })
  const [touched, setTouched] = useState({})
  const [resetting, setResetting] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [confirming, setConfirming] = useState(null)
  const [created, setCreated] = useState(null)

  const run = async (key, action) => {
    setBusy(key); setError(''); setNotice('')
    try { return await action() } catch (requestError) {
      if (requestError.status === 401) onSessionExpired()
      setError(requestError.message)
      return null
    } finally { setBusy('') }
  }

  useEffect(() => {
    request('/api/users', 'GET').then((body) => setUsers(body.users)).catch((requestError) => {
      if (requestError.status === 401) onSessionExpired()
      setError(requestError.message)
    })
  }, [onSessionExpired])

  const problems = {
    name: form.name.trim() ? '' : 'Inserisci il nome visualizzato.',
    username: USERNAME_PATTERN.test(form.username.trim().toLowerCase()) ? '' : 'Usa 2-32 caratteri: lettere minuscole, numeri, punto o trattino.',
    password: form.password.length >= MIN_PASSWORD ? '' : `Almeno ${MIN_PASSWORD} caratteri.`,
  }
  const set = (field) => (value) => setForm((current) => ({ ...current, [field]: value }))
  const blur = (field) => () => setTouched((current) => ({ ...current, [field]: true }))

  const create = async (event) => {
    event.preventDefault()
    setTouched({ name: true, username: true, password: true })
    if (Object.values(problems).some(Boolean)) return
    const body = await run('create', () => request('/api/users', 'POST', { ...form, username: form.username.trim().toLowerCase() }))
    if (body) {
      setUsers(body.users)
      setCreated({ username: form.username.trim().toLowerCase(), password: form.password })
      setForm({ name: '', username: '', password: '', role: 'user' })
      setTouched({})
    }
  }

  const patch = async (key, payload, success) => {
    const body = await run(key, () => request('/api/users', 'PATCH', payload))
    if (body) { setUsers(body.users); setNotice(success); return true }
    return false
  }

  const remove = async (user) => {
    const body = await run(`delete-${user.username}`, () => request(`/api/users?username=${encodeURIComponent(user.username)}`, 'DELETE'))
    if (body) { setUsers(body.users); setConfirming(null); setNotice(`Utente ${user.name} eliminato.`) }
  }

  const copy = (text) => navigator.clipboard?.writeText(text).then(() => setNotice('Copiato negli appunti.')).catch(() => setError('Copia non riuscita: seleziona e copia a mano.'))

  return (
    <section className="panel" aria-labelledby="users-title">
      <header>
        <h2 id="users-title">Utenti</h2>
        <p className="hint">Chi può accedere all’app. Le modifiche valgono subito; gli utenti eliminati vengono disconnessi.</p>
      </header>

      {error && <p className="message error" role="alert">{error}</p>}
      {notice && <p className="message ok" role="status">{notice}</p>}

      {users === null && !error && <p className="message"><span className="spinner" aria-hidden="true" />Caricamento utenti…</p>}

      {users && (
        <ul className="user-list">
          {users.map((user) => (
            <li key={user.username} className="user-card">
              <div className="user-main">
                <span className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span>
                <div>
                  <strong>{user.name}{user.username === me.username && <span className="badge">tu</span>}</strong>
                  <span className="hint">@{user.username} · <span className={`role role-${user.role}`}>{user.role === 'admin' ? 'amministratore' : 'utente'}</span></span>
                </div>
              </div>
              <div className="actions">
                <button type="button" onClick={() => { setResetting(resetting === user.username ? null : user.username); setResetPassword(''); setConfirming(null) }}>Reimposta password</button>
                <button type="button" disabled={busy !== '' || user.username === me.username} onClick={() => patch(`role-${user.username}`, { username: user.username, role: user.role === 'admin' ? 'user' : 'admin' }, `Ruolo di ${user.name} aggiornato.`)}>{user.role === 'admin' ? 'Rendi utente' : 'Rendi admin'}</button>
                <button type="button" className="danger" disabled={user.username === me.username} onClick={() => { setConfirming(user.username); setResetting(null) }}>Elimina</button>
              </div>
              {resetting === user.username && (
                <form className="inline-form" onSubmit={async (event) => { event.preventDefault(); if (resetPassword.length >= MIN_PASSWORD && await patch(`reset-${user.username}`, { username: user.username, password: resetPassword }, `Password di ${user.name} aggiornata.`)) { setCreated({ username: user.username, password: resetPassword }); setResetting(null) } }}>
                  <PasswordField label={`Nuova password per ${user.name}`} value={resetPassword} onChange={setResetPassword} autoComplete="new-password" error={resetPassword && resetPassword.length < MIN_PASSWORD ? `Almeno ${MIN_PASSWORD} caratteri.` : ''}>
                    <button type="button" className="ghost" onClick={() => setResetPassword(generatePassword())}>Genera</button>
                  </PasswordField>
                  <button className="submit" type="submit" disabled={busy !== '' || resetPassword.length < MIN_PASSWORD}>{busy === `reset-${user.username}` ? 'Salvataggio…' : 'Salva password'}</button>
                </form>
              )}
              {confirming === user.username && (
                <div className="confirm" role="alertdialog" aria-label={`Conferma eliminazione di ${user.name}`}>
                  <span>Eliminare <strong>{user.name}</strong>? L’azione non si può annullare.</span>
                  <div className="actions">
                    <button type="button" className="danger solid" disabled={busy !== ''} onClick={() => remove(user)}>{busy === `delete-${user.username}` ? 'Eliminazione…' : 'Sì, elimina'}</button>
                    <button type="button" onClick={() => setConfirming(null)}>Annulla</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {created && (
        <div className="credentials" role="status">
          <strong>Credenziali da consegnare</strong>
          <code>{created.username} · {created.password}</code>
          <span className="hint">La password non verrà più mostrata: copiala ora.</span>
          <div className="actions">
            <button type="button" onClick={() => copy(`${created.username} / ${created.password}`)}>Copia</button>
            <button type="button" onClick={() => setCreated(null)}>Chiudi</button>
          </div>
        </div>
      )}

      <form className="panel-form" onSubmit={create} noValidate>
        <h3>Aggiungi utente</h3>
        <div className="options">
          <label className="field">Nome visualizzato
            <input value={form.name} autoComplete="off" aria-invalid={touched.name && Boolean(problems.name)} onChange={(event) => set('name')(event.target.value)} onBlur={blur('name')} />
            {touched.name && problems.name && <span className="field-error" role="alert">{problems.name}</span>}
          </label>
          <label className="field">Nome utente
            <input value={form.username} autoCapitalize="none" autoComplete="off" aria-invalid={touched.username && Boolean(problems.username)} onChange={(event) => set('username')(event.target.value)} onBlur={blur('username')} />
            {touched.username && problems.username && <span className="field-error" role="alert">{problems.username}</span>}
          </label>
          <PasswordField label="Password" value={form.password} onChange={set('password')} onBlur={blur('password')} autoComplete="new-password" error={touched.password ? problems.password : ''} helper="Genera una password casuale o scrivine una tua.">
            <button type="button" className="ghost" onClick={() => { set('password')(generatePassword()); setTouched((current) => ({ ...current, password: true })) }}>Genera</button>
          </PasswordField>
          <label className="field">Ruolo
            <select value={form.role} onChange={(event) => set('role')(event.target.value)}>
              <option value="user">Utente</option>
              <option value="admin">Amministratore</option>
            </select>
          </label>
        </div>
        <button className="submit" type="submit" disabled={busy !== ''}>{busy === 'create' ? 'Creazione…' : 'Crea utente'}</button>
      </form>
    </section>
  )
}

export function PasswordPanel({ onChanged, onSessionExpired }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const mismatch = confirm && next !== confirm ? 'Le due password non coincidono.' : ''
  const tooShort = touched && next.length < MIN_PASSWORD ? `Almeno ${MIN_PASSWORD} caratteri.` : ''

  const submit = async (event) => {
    event.preventDefault()
    setTouched(true)
    if (next.length < MIN_PASSWORD || next !== confirm) return
    setBusy(true); setError('')
    try {
      await request('/api/users', 'PATCH', { currentPassword: current, newPassword: next })
      onChanged()
    } catch (requestError) {
      if (requestError.status === 401) onSessionExpired()
      setError(requestError.message)
      setBusy(false)
    }
  }

  return (
    <section className="panel" aria-labelledby="password-title">
      <header>
        <h2 id="password-title">Cambia password</h2>
        <p className="hint">Dopo il cambio dovrai accedere di nuovo con la nuova password.</p>
      </header>
      <form className="panel-form" onSubmit={submit} noValidate>
        <PasswordField label="Password attuale" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordField label="Nuova password" value={next} onChange={setNext} onBlur={() => setTouched(true)} autoComplete="new-password" error={tooShort} helper={`Almeno ${MIN_PASSWORD} caratteri.`}>
          <button type="button" className="ghost" onClick={() => { const generated = generatePassword(); setNext(generated); setConfirm(generated) }}>Genera</button>
        </PasswordField>
        <PasswordField label="Ripeti la nuova password" value={confirm} onChange={setConfirm} autoComplete="new-password" error={mismatch} />
        {error && <p className="message error" role="alert">{error}</p>}
        <button className="submit" type="submit" disabled={busy || !current}>{busy ? 'Salvataggio…' : 'Aggiorna password'}</button>
      </form>
    </section>
  )
}

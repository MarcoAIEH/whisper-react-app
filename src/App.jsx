import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import './App.css'

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024

const postJson = (url, payload) => fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
})

const baseName = (name) => name.replace(/\.[^.]+$/, '') || 'trascrizione'

const saveText = (text, filename) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function App() {
  const inputRef = useRef(null)
  const [items, setItems] = useState([])
  const [language, setLanguage] = useState('it')
  const [status, setStatus] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState('')

  const updateItem = (id, patch) => setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  const chooseFiles = (fileList) => {
    const files = Array.from(fileList ?? [])
    if (!files.length) return
    setItems(files.map((file) => ({ id: crypto.randomUUID(), file, state: 'pending', transcript: '', error: '' })))
    setStatus('')
    setError('')
  }

  const transcribeOne = async ({ id, file }, prefix) => {
    let uploadedBlobUrl = null
    try {
      updateItem(id, { state: 'uploading', error: '' })
      setStatus(`${prefix}Caricamento sicuro: ${file.name}`)
      let blob
      try {
        blob = await upload(`audio/${crypto.randomUUID()}-${file.name}`, file, {
          access: 'private',
          handleUploadUrl: '/api/upload',
          multipart: file.size > 4 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setStatus(`${prefix}Caricamento sicuro di ${file.name}: ${Math.round(percentage)}%`),
        })
      } catch {
        throw new Error("Caricamento non riuscito. Il problema è nella configurazione del server (contatta l'amministratore).")
      }
      uploadedBlobUrl = blob.url
      updateItem(id, { state: 'transcribing' })
      setStatus(`${prefix}Trascrizione in corso: ${file.name}`)
      const response = await postJson('/api/transcribe', { blobUrl: blob.url, language: language.trim() })
      const body = await response.json()
      if (!response.ok) throw new Error(body.detail || 'Trascrizione non riuscita.')
      if (!body.cleanupCompleted) await postJson('/api/cleanup', { blobUrl: uploadedBlobUrl })
      uploadedBlobUrl = null
      updateItem(id, { state: 'done', transcript: body.transcript })
    } catch (requestError) {
      if (uploadedBlobUrl) await postJson('/api/cleanup', { blobUrl: uploadedBlobUrl }).catch(() => {})
      updateItem(id, { state: 'error', error: requestError.message })
    }
  }

  const transcribe = async (event) => {
    event.preventDefault()
    if (!items.length) {
      setError('Seleziona prima uno o più file audio o video.')
      return
    }
    const oversized = items.find(({ file }) => file.size > MAX_UPLOAD_BYTES)
    if (oversized) {
      setError(`${oversized.file.name} supera il limite di 100 MB.`)
      return
    }
    setIsTranscribing(true)
    setError('')
    const queue = items.filter((item) => item.state !== 'done')
    for (const [index, item] of queue.entries()) {
      await transcribeOne(item, queue.length > 1 ? `[${index + 1}/${queue.length}] ` : '')
    }
    setStatus('Elaborazione conclusa. Gli audio sono stati eliminati dallo storage temporaneo.')
    setIsTranscribing(false)
  }

  const doneItems = items.filter((item) => item.state === 'done')

  const downloadAll = () => saveText(
    doneItems.map(({ file, transcript }) => `=== ${file.name} ===\n\n${transcript}`).join('\n\n\n'),
    'trascrizioni.txt',
  )

  const stateLabel = { pending: 'in attesa', uploading: 'caricamento…', transcribing: 'trascrizione…', done: 'completato', error: 'errore' }

  return (
    <main>
      <header>
        <span className="eyebrow">SCRIBE · PRIVATO</span>
        <h1>Trascrivi in modo semplice e protetto.</h1>
        <p>L’audio viene elaborato da ElevenLabs Scribe e rimosso dallo storage temporaneo appena conclusa la trascrizione.</p>
      </header>

      <form onSubmit={transcribe}>
        <button
          className="dropzone"
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={(event) => { event.preventDefault(); chooseFiles(event.dataTransfer.files) }}
          onDragOver={(event) => event.preventDefault()}
        >
          <strong>{items.length ? `${items.length} file selezionat${items.length === 1 ? 'o' : 'i'}` : 'Scegli o trascina uno o più audio/video'}</strong>
          <span>{items.length ? 'Clicca o trascina per cambiare la selezione' : 'mp3, m4a, wav, opus, mp4, mov, webm · massimo 100 MB ciascuno'}</span>
        </button>
        <input ref={inputRef} type="file" multiple accept="audio/*,video/*,.opus,.ogg,.m4a,.wav,.mp3,.mp4,.mov,.webm" onChange={(event) => { chooseFiles(event.target.files); event.target.value = '' }} />

        {items.length > 0 && (
          <ul className="file-list">
            {items.map(({ id, file, state, error: itemError }) => (
              <li key={id} className={`file-${state}`}>
                <span className="file-name">{file.name}</span>
                <span className="file-meta">{Math.ceil(file.size / 1024 / 1024)} MB · {itemError || stateLabel[state]}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="options">
          <label>Lingua (codice)
            <input value={language} maxLength="3" onChange={(event) => setLanguage(event.target.value)} placeholder="it" />
          </label>
        </div>

        <button className="submit" type="submit" disabled={isTranscribing}>
          {isTranscribing ? 'Elaborazione…' : items.length > 1 ? `Trascrivi ${items.length} file` : 'Trascrivi'}
        </button>
      </form>

      {error && <p className="message error">{error}</p>}
      {status && <p className="message">{status}</p>}

      {doneItems.length > 0 && (
        <section className="result">
          <div className="result-header">
            <h2>Trascrizion{doneItems.length === 1 ? 'e' : 'i'}</h2>
            {doneItems.length > 1 && <button type="button" onClick={downloadAll}>Scarica tutto .txt</button>}
          </div>
          {doneItems.map(({ id, file, transcript }) => (
            <div key={id} className="result-item">
              <div className="result-header">
                <h3>{file.name}</h3>
                <button type="button" onClick={() => saveText(transcript, `${baseName(file.name)}.txt`)}>Scarica .txt</button>
              </div>
              <textarea value={transcript} onChange={(event) => updateItem(id, { transcript: event.target.value })} aria-label={`Trascrizione modificabile di ${file.name}`} />
            </div>
          ))}
        </section>
      )}

      <div className="orbit-scene" aria-hidden="true">
        <div className="orbit">
          <span className="orbit-core" />
          <span className="orbit-ring ring-a"><span className="orb" /></span>
          <span className="orbit-ring ring-b"><span className="orb" /></span>
          <span className="orbit-ring ring-c"><span className="orb" /></span>
        </div>
      </div>
    </main>
  )
}

export default App

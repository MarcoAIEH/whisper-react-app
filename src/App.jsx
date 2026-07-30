import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import './App.css'

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024

function App() {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState('it')
  const [accessCode, setAccessCode] = useState('')
  const [status, setStatus] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState('')
  const [transcript, setTranscript] = useState('')

  const chooseFile = (nextFile) => {
    setFile(nextFile ?? null)
    setTranscript('')
    setError('')
  }

  const transcribe = async (event) => {
    let uploadedBlobUrl = null
    event.preventDefault()
    if (!file) {
      setError('Seleziona prima un file audio o video.')
      return
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setError('Il file supera il limite di 100 MB.')
      return
    }
    if (!accessCode) {
      setError('Inserisci il codice di accesso.')
      return
    }
    setIsTranscribing(true)
    setError('')
    setTranscript('')
    try {
      setStatus('Caricamento sicuro in corso…')
      let blob
      try {
        blob = await upload(`audio/${crypto.randomUUID()}-${file.name}`, file, {
          access: 'private',
          handleUploadUrl: '/api/upload',
          clientPayload: JSON.stringify({ accessCode }),
          multipart: file.size > 4 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setStatus(`Caricamento sicuro: ${Math.round(percentage)}%`),
        })
      } catch {
        throw new Error("Caricamento non riuscito. Verifica il codice di accesso; se è corretto, il problema è nella configurazione del server (contatta l'amministratore).")
      }
      uploadedBlobUrl = blob.url
      setStatus('Trascrizione in corso…')
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobUrl: blob.url, language: language.trim(), accessCode }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.detail || 'Trascrizione non riuscita.')
      setTranscript(body.transcript)
      if (!body.cleanupCompleted) {
        await fetch('/api/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blobUrl: uploadedBlobUrl, accessCode }),
        })
      }
      setStatus(body.cleanupCompleted
        ? `Completata con ${body.model}. L'audio è stato eliminato dallo storage temporaneo.`
        : `Completata con ${body.model}. La cancellazione dell'audio è in verifica.`)
      uploadedBlobUrl = null
    } catch (requestError) {
      if (uploadedBlobUrl) {
        await fetch('/api/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blobUrl: uploadedBlobUrl, accessCode }),
        }).catch(() => {})
      }
      setError(requestError.message)
      setStatus('')
    } finally {
      setIsTranscribing(false)
    }
  }

  const download = () => {
    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${file?.name?.replace(/\.[^.]+$/, '') || 'trascrizione'}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main>
      <header>
        <span className="eyebrow">WHISPER · PRIVATO</span>
        <h1>Trascrivi in modo semplice e protetto.</h1>
        <p>L’audio viene elaborato da ElevenLabs Scribe e rimosso dallo storage temporaneo appena conclusa la trascrizione.</p>
      </header>

      <form onSubmit={transcribe}>
        <button
          className="dropzone"
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]) }}
          onDragOver={(event) => event.preventDefault()}
        >
          <strong>{file ? file.name : 'Scegli o trascina un audio/video'}</strong>
          <span>{file ? `${Math.ceil(file.size / 1024 / 1024)} MB · pronto` : 'mp3, m4a, wav, opus, mp4, mov, webm · massimo 100 MB'}</span>
        </button>
        <input ref={inputRef} type="file" accept="audio/*,video/*,.opus,.ogg,.m4a,.wav,.mp3,.mp4,.mov,.webm" onChange={(event) => chooseFile(event.target.files[0])} />

        <div className="options">
          <label>Lingua (codice)
            <input value={language} maxLength="3" onChange={(event) => setLanguage(event.target.value)} placeholder="it" />
          </label>
          <label>Codice di accesso
            <input type="password" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} placeholder="Richiesto" autoComplete="off" />
          </label>
        </div>

        <button className="submit" type="submit" disabled={isTranscribing}>
          {isTranscribing ? 'Elaborazione…' : 'Trascrivi'}
        </button>
      </form>

      {error && <p className="message error">{error}</p>}
      {status && <p className="message">{status}</p>}

      {transcript && (
        <section className="result">
          <div className="result-header"><h2>Trascrizione</h2><button type="button" onClick={download}>Scarica .txt</button></div>
          <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} aria-label="Trascrizione modificabile" />
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

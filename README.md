# Whisper Transcriber · AIEH

Una web app React installabile come PWA per trasformare audio e vocali WhatsApp in testo. Il browser carica il file in un Vercel Blob privato; una Vercel Function lo invia a ElevenLabs Scribe v2 e restituisce il testo. Il file temporaneo viene cancellato al termine del processo.

Demo live: [whisper.aiexcellencehub.com](https://whisper.aiexcellencehub.com)

## Perché questo esempio

Questo progetto mostra un percorso completo e leggibile per costruire un prodotto reale con Codex o Claude Code:

- frontend React + Vite, con installazione PWA;
- API backend in JavaScript tramite Vercel Functions;
- upload privato e temporaneo con Vercel Blob;
- trascrizione con ElevenLabs `scribe_v2`;
- supporto a MP3, M4A, WAV, WebM, AAC e vocali WhatsApp `.opus`; AAC viene normalizzato lato server in M4A prima dell'invio a ElevenLabs;
- cleanup automatico e sweeper giornaliero per upload abbandonati;
- diarizzazione: riconosce i diversi speaker (`diarize=true`, opzionale `num_speakers`), permette di rinominarli nell'app e scarica il `.txt` con i nomi scelti (`Marco: testo…`), con timestamp opzionali. I nomi restano nel browser e non vengono salvati sul server.

Il progetto è volutamente piccolo: ogni componente ha una responsabilità chiara e può essere sostituito senza riscrivere l’intera app.

## Avvio rapido

La procedura completa è in [docs/SETUP.md](docs/SETUP.md). In breve:

```bash
git clone https://github.com/MarcoAIEH/whisper-react-app.git
cd whisper-react-app
npm install
npm run dev:vercel
```

Per il primo avvio servono un progetto Vercel collegato, un Blob store privato e le variabili d’ambiente descritte nella guida. Non inserire mai una chiave ElevenLabs nel codice o nel repository.

## Comandi

```bash
npm run dev          # solo frontend Vite
npm run dev:vercel  # frontend + Vercel Functions in locale
npm run lint         # controllo statico
npm run test         # test unitari e dell'handler (node:test, senza rete)
npm run build        # build di produzione, inclusa PWA
```

## Flusso tecnico

1. L’utente seleziona un file.
2. `/api/upload` genera un token breve per un upload privato diretto a Blob.
3. `/api/transcribe` legge il Blob, normalizza `.opus` a Ogg e `.aac` a M4A in una directory temporanea della Function, chiama ElevenLabs Scribe v2 e restituisce la trascrizione con `segments[]` (speaker, tempi, testo) e `speakers[]`.
4. Il Blob viene cancellato prima della risposta di successo; in caso di errore intervengono cleanup client e sweeper giornaliero.

Limite applicativo: 100 MB per file. Il costo ElevenLabs dipende dalla durata dell’audio e dal piano scelto.

## Deploy su Vercel

Da una copia collegata al proprio progetto Vercel:

```bash
vercel link
vercel env add ELEVENLABS_API_KEY production
vercel --prod
```

Il Blob store deve essere **Private** e collegato al progetto. Vercel aggiunge `BLOB_READ_WRITE_TOKEN`; `CRON_SECRET` abilita il job di rimozione degli upload abbandonati.

## Licenza e uso

Esempio didattico AIEH per mostrare come passare da un’idea a una web app funzionante, governata e deployata. Prima di usarlo con dati cliente, definire policy di conservazione, accesso e trattamento dei dati audio.

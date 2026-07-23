# Whisper Transcriber · AIEH

Una web app React installabile come PWA per trasformare audio e vocali WhatsApp in testo. Il browser carica il file in un Vercel Blob privato; una Vercel Function lo invia all’endpoint OpenAI Audio Transcriptions e restituisce il testo. Il file temporaneo viene cancellato al termine del processo.

Demo live: [whisper.aiexcellencehub.com](https://whisper.aiexcellencehub.com)

## Perché questo esempio

Questo progetto mostra un percorso completo e leggibile per costruire un prodotto reale con Codex o Claude Code:

- frontend React + Vite, con installazione PWA;
- API backend in JavaScript tramite Vercel Functions;
- upload privato e temporaneo con Vercel Blob;
- trascrizione con OpenAI `whisper-1`;
- supporto a MP3, M4A, WAV, WebM e vocali WhatsApp `.opus`;
- protezione tramite codice d’accesso, senza chiavi nel browser;
- cleanup automatico e sweeper giornaliero per upload abbandonati.

Il progetto è volutamente piccolo: ogni componente ha una responsabilità chiara e può essere sostituito senza riscrivere l’intera app.

## Avvio rapido

La procedura completa è in [docs/SETUP.md](docs/SETUP.md). In breve:

```bash
git clone https://github.com/MarcoAIEH/whisper-react-app.git
cd whisper-react-app
npm install
npm run dev:vercel
```

Per il primo avvio servono un progetto Vercel collegato, un Blob store privato e le variabili d’ambiente descritte nella guida. Non inserire mai una chiave OpenAI nel codice o nel repository.

## Comandi

```bash
npm run dev          # solo frontend Vite
npm run dev:vercel  # frontend + Vercel Functions in locale
npm run lint         # controllo statico
npm run build        # build di produzione, inclusa PWA
```

## Flusso tecnico

1. L’utente seleziona un file e inserisce il codice d’accesso.
2. `/api/upload` genera un token breve per un upload privato diretto a Blob.
3. `/api/transcribe` legge il Blob, normalizza `.opus` a Ogg, chiama OpenAI e restituisce la trascrizione.
4. Il Blob viene cancellato prima della risposta di successo; in caso di errore intervengono cleanup client e sweeper giornaliero.

Limite applicativo: 25 MB per file. Il costo OpenAI dipende dalla durata dell’audio e dal modello scelto.

## Deploy su Vercel

Da una copia collegata al proprio progetto Vercel:

```bash
vercel link
vercel env add OPENAI_API_KEY production
vercel env add TRANSCRIBER_ACCESS_TOKEN production
vercel --prod
```

Il Blob store deve essere **Private** e collegato al progetto. Vercel aggiunge `BLOB_READ_WRITE_TOKEN`; `CRON_SECRET` abilita il job di rimozione degli upload abbandonati.

## Licenza e uso

Esempio didattico AIEH per mostrare come passare da un’idea a una web app funzionante, governata e deployata. Prima di usarlo con dati cliente, definire policy di conservazione, accesso e trattamento dei dati audio.

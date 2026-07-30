# Setup guidato · Whisper Transcriber

Questa guida accompagna una persona che ha appena clonato il repository fino a una web app React funzionante in locale e, se serve, pubblicata su Vercel.

## 1. Prerequisiti

Servono:

- Node.js 20 o superiore;
- npm;
- un account Vercel;
- un progetto Vercel;
- una API key ElevenLabs con credito disponibile (piano con accesso a Scribe v2).

Installa la CLI Vercel una sola volta:

```bash
npm install --global vercel
vercel login
```

## 2. Clona e installa

```bash
git clone https://github.com/MarcoAIEH/whisper-react-app.git
cd whisper-react-app
npm install
```

Il progetto è una Vite React app. Le route in `api/` sono Vercel Functions: non è necessario installare Python o avviare un server FastAPI per usare questa versione cloud.

## 3. Collega il progetto Vercel

Se il progetto Vercel esiste già:

```bash
vercel link
```

Se vuoi crearne uno nuovo, esegui lo stesso comando e scegli account/team e nome del progetto quando richiesto.

## 4. Crea il Blob privato

Il file audio non deve passare nel body di una Function. Crea uno store Vercel Blob **Private** dal tab Storage del progetto, oppure dalla CLI:

```bash
vercel blob create-store whisper-transcriber --access private
```

Collega lo store al progetto e agli environment che utilizzerai. Vercel aggiungerà `BLOB_READ_WRITE_TOKEN` come variabile sensibile.

Per dati audio o cliente non usare uno store pubblico.

## 5. Configura le variabili d’ambiente

### Locale

Crea `.env.local` copiando il template:

```bash
cp .env.example .env.local
```

Inserisci valori locali reali senza committare il file:

```dotenv
ELEVENLABS_API_KEY=<your-elevenlabs-api-key>
TRANSCRIBER_ACCESS_TOKEN=crea-un-codice-lungo-e-casuale
BLOB_READ_WRITE_TOKEN=token-generato-da-vercel
```

`CRON_SECRET` serve solo in produzione per il job di cleanup. Non usare mai una variabile `VITE_*` per la chiave ElevenLabs: le variabili con quel prefisso finiscono nel bundle browser.

### Produzione

Imposta i segreti dalla dashboard Vercel oppure con la CLI, che chiederà il valore senza inserirlo nei file:

```bash
vercel env add ELEVENLABS_API_KEY production
vercel env add TRANSCRIBER_ACCESS_TOKEN production
vercel env add CRON_SECRET production
```

Il valore di `TRANSCRIBER_ACCESS_TOKEN` è il codice che l’utente digita nella UI. Usa almeno 24 caratteri casuali. Non pubblicarlo nel README, nelle issue o nei log.

## 6. Avvia in locale

Per vedere solo il frontend:

```bash
npm run dev
```

Per provare il flusso completo con le Functions, Blob e variabili d’ambiente Vercel:

```bash
vercel dev
```

Apri l’URL mostrato dalla CLI. Se una chiamata `/api/*` fallisce, controlla prima `vercel env pull .env.local` e che il progetto sia quello corretto.

## 7. Verifica prima del deploy

```bash
npm run lint
npm run build
```

La build deve generare anche `dist/manifest.webmanifest` e `dist/sw.js`: sono gli asset che rendono l’app installabile dal browser.

## 8. Deploy

```bash
vercel --prod
```

Vercel pubblica il frontend statico, le Functions in `api/` e il service worker PWA. Per collegare un dominio:

```bash
vercel domains add whisper.example.com whisper-transcriber
```

Il DNS deve puntare ai nameserver o al record indicato dalla dashboard Vercel.

## 9. Installa la web app

- Chrome/Edge desktop: apri il dominio e scegli **Installa** nella barra degli indirizzi.
- Android Chrome: menu ⋮ → **Installa app**.
- iPhone Safari: Condividi → **Aggiungi alla schermata Home**.

Non serve pubblicare un’app nativa negli store: la PWA usa lo stesso frontend React e lo stesso backend Vercel.

## 10. Checklist sicurezza

- [ ] `ELEVENLABS_API_KEY` è presente solo in environment server-side.
- [ ] Blob store impostato su Private.
- [ ] `TRANSCRIBER_ACCESS_TOKEN` è casuale e non è nel repository.
- [ ] `.env.local` è ignorato da Git.
- [ ] Il test elimina il file dal Blob dopo una trascrizione riuscita.
- [ ] La policy cliente chiarisce invio a ElevenLabs e tempi di conservazione.

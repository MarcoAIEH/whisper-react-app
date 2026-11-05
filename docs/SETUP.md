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

I file `.aac` sono convertiti automaticamente in M4A dal backend prima della trascrizione. La conversione usa una binary FFmpeg inclusa tra le dipendenze del progetto: l'utente non deve convertire il file manualmente.

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
BLOB_READ_WRITE_TOKEN=token-generato-da-vercel
```

`AUTH_SECRET` e `AUTH_USERS` abilitano il login: `AUTH_USERS` è un JSON `{"utente":{"hash":"scrypt$…","name":"Nome","role":"admin"}}` (hash con `node scripts/hash-password.js`) ed è solo il seme: alla prima modifica dal pannello Utenti l'elenco passa a `config/users.json` su Blob e `AUTH_USERS` non conta più. `ANTHROPIC_API_KEY` (facoltativa, solo server-side) abilita i preset di trasformazione; senza chiave l'app funziona e i preset restano nascosti. `ANTHROPIC_MODEL` permette di cambiare modello. `CRON_SECRET` serve solo in produzione per il job di cleanup. Non usare mai una variabile `VITE_*` per la chiave ElevenLabs: le variabili con quel prefisso finiscono nel bundle browser.

### Produzione

Imposta i segreti dalla dashboard Vercel oppure con la CLI, che chiederà il valore senza inserirlo nei file:

```bash
vercel env add ELEVENLABS_API_KEY production
vercel env add CRON_SECRET production
vercel env add ANTHROPIC_API_KEY production   # facoltativa: abilita i preset
```

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
npm test
npm run build
```

La diarizzazione (speaker multipli) è attiva di default e usa lo stesso `ELEVENLABS_API_KEY`: nessuna configurazione aggiuntiva. Può essere disattivata dalla casella "Riconosci i diversi speaker". Dopo la trascrizione puoi rinominare gli speaker prima di scaricare il `.txt`.

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
- [ ] `.env.local` è ignorato da Git.
- [ ] Il test elimina il file dal Blob dopo una trascrizione riuscita.
- [ ] La policy cliente chiarisce invio a ElevenLabs e tempi di conservazione.

export const MAX_TEXT_CHARS = 200_000

// Aggiungere un preset = aggiungere una riga qui.
export const PRESETS = [
  { id: 'verbale', label: 'Verbale riunione', prompt: 'Scrivi un verbale della riunione: partecipanti (se deducibili), argomenti trattati, decisioni prese, e una lista di attività con responsabile e scadenza quando indicati. Non inventare nulla che non sia nel testo.' },
  { id: 'action-item', label: 'Action item', prompt: 'Estrai solo le azioni da svolgere come elenco puntato: azione, responsabile e scadenza se presenti. Se non ci sono azioni scrivi "Nessuna azione rilevata".' },
  { id: 'riassunto', label: 'Riassunto breve', prompt: 'Riassumi il contenuto in massimo 8 righe, con i punti chiave più importanti, in modo chiaro e fedele.' },
  { id: 'sbobinatura', label: 'Sbobinatura pulita', prompt: 'Riscrivi il testo rimuovendo intercalari, esitazioni e ripetizioni, correggendo punteggiatura e maiuscole, senza cambiare il senso, senza riassumere e mantenendo le etichette degli speaker.' },
  { id: 'linkedin', label: 'Post LinkedIn', prompt: 'Scrivi un post LinkedIn (max 200 parole) basato sul contenuto: una prima riga forte, paragrafi brevi, un insight pratico e una domanda finale. Niente hashtag eccessivi (max 3).' },
  { id: 'faq', label: 'FAQ / Q&A', prompt: 'Crea una lista di domande e risposte (FAQ) utili a chi non ha ascoltato l\'audio, basate solo sul contenuto.' },
]

export const findPreset = (id) => PRESETS.find((preset) => preset.id === id)

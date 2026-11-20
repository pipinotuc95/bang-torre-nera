# Bang! alla Torre Nera — statistiche tornei

Sito statico (GitHub Pages) con classifiche e statistiche dei tornei di BANG! organizzati dal Circolo Ludico La Torre Nera di Osimo.

- `index.html`: il sito pubblico (Saloon, Classifica, Tornei, Giocatori, Sfida, Statistiche di gioco, Regolamento)
- `admin.html`: l'Ufficio dello Sceriffo, dove si inseriscono i dati (serve il token GitHub, quindi può scrivere solo chi ce l'ha)
- `data/dati.json`: tutti i dati (tornei, classifiche, partite)
- `js/stats.js`: calcoli e regole del regolamento 2026-27 (vincite a tavolo, $ iniziali, bonus)

## Come funziona

- Il sito è su **GitHub Pages**, i dati su **Firebase Firestore** (progetto `bang-torre-nera`).
- Si entra in `admin.html` con **email e password** (Firebase Authentication). Le regole di Firestore permettono di scrivere solo al tuo account (UID); leggere è pubblico.
- `data/dati.json` contiene i dati iniziali: al primo accesso l'admin propone di trasferirli su Firebase. Se Firebase non è raggiungibile, il sito pubblico li usa come riserva.
- `js/firebase-config.js` contiene la configurazione dell'app web Firebase (valori non segreti).

## Uso quotidiano

- **Nuovo torneo**: incolla il testo della mail con l'esito; data, sede, codice e classifica vengono letti da soli.
- **Partite** (facoltativo): copia le Schede di gioco; i $ vinti si calcolano da soli e *Verifica punteggi* controlla che quadrino con la classifica ufficiale.
- Premi **Salva sul sito**: il sito è aggiornato subito.
- *Impostazioni → Backup* scarica o ricarica tutti i dati in un file `.json`.

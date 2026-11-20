# Bang! alla Torre Nera — statistiche tornei

Sito statico (GitHub Pages) con classifiche e statistiche dei tornei di BANG! organizzati dal Circolo Ludico La Torre Nera di Osimo.

- `index.html`: il sito pubblico (Saloon, Classifica, Tornei, Giocatori, Sfida, Statistiche di gioco, Regolamento)
- `admin.html`: l'Ufficio dello Sceriffo, dove si inseriscono i dati (serve il token GitHub, quindi può scrivere solo chi ce l'ha)
- `data/dati.json`: tutti i dati (tornei, classifiche, partite)
- `js/stats.js`: calcoli e regole del regolamento 2026-27 (vincite a tavolo, $ iniziali, bonus)

## Messa online (una volta sola)

1. **Crea il repository**: su github.com → **+** in alto a destra → *New repository*. Nome ad esempio `bang-torre-nera`, visibilità **Public**, poi *Create repository*.
2. **Carica i file**: nella pagina del repository clicca *uploading an existing file*, poi trascina **tutto il contenuto** della cartella estratta dallo zip (`index.html`, `admin.html`, `README.md`, `.nojekyll` e le cartelle `css`, `js`, `img`, `data`). Clicca *Commit changes*.
3. **Accendi GitHub Pages**: *Settings* → *Pages* → in *Build and deployment* scegli *Deploy from a branch*, branch `main`, cartella `/ (root)` → *Save*. Dopo 1-2 minuti il sito è su `https://TUO-UTENTE.github.io/bang-torre-nera/`.
4. **Crea il token per l'admin**: foto profilo → *Settings* → *Developer settings* → *Personal access tokens* → *Fine-grained tokens* → *Generate new token*.
   - *Repository access*: **Only select repositories** → `bang-torre-nera`
   - *Permissions* → *Repository permissions* → **Contents: Read and write**
   - Scadenza a piacere (alla scadenza ne crei uno nuovo). Copia il token: GitHub lo mostra una volta sola.
5. Apri `https://TUO-UTENTE.github.io/bang-torre-nera/admin.html`, incolla il token e premi **Collegati e carica i dati**. Utente e repository vengono riconosciuti da soli dall'indirizzo.

## Uso quotidiano

- **Nuovo torneo**: incolla il testo della mail con l'esito. Data, sede, codice e classifica vengono letti da soli; controlla l'anteprima e premi *Aggiungi torneo*.
- **Partite** (facoltativo): copia le Schede di gioco (tavolo, turno, chi ha vinto, smazzate, giocatori in ordine di posto con personaggio, ruolo e $ pagati all'asta). I $ vinti si calcolano da soli. Quando hai inserito tutte le partite di un torneo, la sezione *Verifica punteggi* controlla che i conti tornino con la classifica ufficiale.
- Alla fine premi **Pubblica sul sito**: il sito si aggiorna entro un paio di minuti.
- *Impostazioni → Unisci due nomi* serve se lo stesso giocatore compare scritto in due modi.
- *Impostazioni → Backup* scarica o ricarica `dati.json`.

## Sicurezza

Chiunque può aprire `admin.html`, ma senza un token con permesso di scrittura sul repository non può salvare nulla. Il token resta solo nel browser del tuo dispositivo (spunta *Ricorda*), e lo puoi revocare in qualsiasi momento da GitHub. I dati in `dati.json` sono pubblici come il sito.

/* Bang! alla Torre Nera — Ufficio dello Sceriffo (gestione dati) */
(function () {
  'use strict';
  const B = window.BANG;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let DATI = null, MODIFICATO = false, COLLEGATO = false, ID_CARICATI = [], MINI = {};
  let partitaInModifica = null; // indice della partita in modifica nel torneo selezionato
  let nGiocatori = 6;

  // ---------------- utilità ----------------
  let timerMsg;
  const msg = (box, testo, tipo = 'info') => {
    $(box).innerHTML = testo ? `<div class="avviso ${tipo}">${testo}</div>` : '';
    if (box === '#msg') { clearTimeout(timerMsg); if (tipo !== 'err') timerMsg = setTimeout(() => { $('#msg').innerHTML = ''; }, 6000); }
  };
  const idTorneo = t => `${t.data}-${B.slug(t.sede)}`;
  const ERRORI = {
    'auth/invalid-credential': 'Email o password non corretti.', 'auth/wrong-password': 'Password non corretta.',
    'auth/user-not-found': 'Nessun utente con questa email.', 'auth/invalid-email': 'Email non valida.',
    'auth/too-many-requests': 'Troppi tentativi: riprova tra qualche minuto.', 'auth/network-request-failed': 'Connessione a Firebase non riuscita (rete, antivirus o blocco pubblicità).',
    'auth/unauthorized-domain': 'Questo indirizzo non è tra i "Domini autorizzati" di Firebase Authentication.',
    'permission-denied': 'Permesso negato: questo account non è autorizzato a scrivere (controlla l\'UID nelle regole di Firestore).',
    'unavailable': 'Firebase non raggiungibile: controlla la connessione e riprova.'
  };
  const errore = e => esc(ERRORI[e && e.code] || ((e && e.message) || String(e)));

  function segnaModifica() {
    MODIFICATO = true;
    $('#btnPubblica').disabled = !COLLEGATO;
    aggiornaStato();
    try { localStorage.setItem('bangTorreNera.bozza', JSON.stringify(DATI)); } catch (e) { /* niente */ }
  }
  function aggiornaStato() {
    const p = MODIFICATO ? 'mod' : COLLEGATO ? 'on' : '';
    const t = COLLEGATO ? (MODIFICATO ? 'Modifiche da salvare' : 'Tutto salvato') : 'Non collegato';
    $('#stato').innerHTML = `<span class="pallino ${p}"></span>${t}`;
  }
  window.addEventListener('beforeunload', e => { if (MODIFICATO) { e.preventDefault(); e.returnValue = ''; } });

  // ---------------- accesso (Firebase) ----------------
  const conDB = fn => window.BANG_DB ? fn(window.BANG_DB) : window.addEventListener('bangdb', () => fn(window.BANG_DB), { once: true });
  setTimeout(() => { if (!window.BANG_DB) msg('#msgAccesso', 'Non riesco a caricare Firebase (www.gstatic.com bloccato?). Controlla la connessione e ricarica la pagina.', 'err'); }, 10000);

  conDB(DB => {
    if (!DB.attivo) { msg('#msgAccesso', 'Firebase non è ancora configurato: compila <code>js/firebase-config.js</code>.', 'err'); return; }
    DB.suCambioUtente(async utente => {
      if (!utente) {
        COLLEGATO = false; $('#secAccesso').style.display = ''; $('#pannello').style.display = 'none'; $('#btnEsci').style.display = 'none';
        aggiornaStato(); return;
      }
      $('#secAccesso').style.display = 'none'; $('#btnEsci').style.display = '';
      $('#stato').innerHTML = '<span class="pallino"></span>Carico i dati…';
      try {
        const d = await DB.carica();
        COLLEGATO = true; MODIFICATO = false;
        ID_CARICATI = d._origine === 'firestore' ? d.tornei.map(t => t.id) : [];
        DATI = { config: d.config || {}, tornei: d.tornei || [] }; MINI = d.miniature || {};
        const bozza = localStorage.getItem('bangTorreNera.bozza');
        if (d._origine !== 'firestore') {
          MODIFICATO = true;
          msg('#msg', 'Il database è ancora vuoto: ho preparato i tornei già presenti nel sito. Premi <b>Salva sul sito</b> per trasferirli su Firebase.', 'info');
        } else if (bozza && bozza !== JSON.stringify(DATI) && confirm('Su questo dispositivo ci sono modifiche non ancora salvate. Vuoi riprenderle?')) {
          DATI = JSON.parse(bozza); MODIFICATO = true;
        }
        $('#btnPubblica').disabled = !MODIFICATO;
        avvia();
      } catch (e) { msg('#msg', 'Errore nel caricamento dei dati: ' + errore(e), 'err'); aggiornaStato(); }
    });
  });

  $('#formAccesso').onsubmit = e => {
    e.preventDefault();
    const btn = $('#btnEntra'); btn.disabled = true; msg('#msgAccesso', 'Accesso in corso…');
    conDB(DB => DB.entra($('#email').value.trim(), $('#password').value)
      .then(() => { msg('#msgAccesso', ''); $('#password').value = ''; })
      .catch(err => msg('#msgAccesso', errore(err), 'err'))
      .finally(() => { btn.disabled = false; }));
  };
  $('#lnkRecupera').onclick = e => {
    e.preventDefault();
    const em = $('#email').value.trim();
    if (!em) return msg('#msgAccesso', 'Scrivi prima la tua email nel campo qui sopra.', 'err');
    conDB(DB => DB.recupera(em).then(() => msg('#msgAccesso', 'Ti ho inviato una mail per reimpostare la password.', 'ok')).catch(err => msg('#msgAccesso', errore(err), 'err')));
  };
  $('#btnEsci').onclick = () => {
    if (MODIFICATO && !confirm('Hai modifiche non salvate. Uscire comunque?')) return;
    MODIFICATO = false; conDB(DB => DB.esci());
  };

  $('#btnPubblica').onclick = async () => {
    if (!COLLEGATO) return;
    const btn = $('#btnPubblica'); btn.disabled = true; btn.textContent = 'Salvo…';
    try {
      await window.BANG_DB.salva(DATI, ID_CARICATI);
      ID_CARICATI = DATI.tornei.map(t => t.id); MODIFICATO = false;
      localStorage.removeItem('bangTorreNera.bozza');
      msg('#msg', '✔ Salvato! Il sito è già aggiornato.', 'ok');
    } catch (e) { msg('#msg', 'Salvataggio non riuscito: ' + errore(e), 'err'); btn.disabled = false; }
    btn.textContent = 'Salva sul sito'; aggiornaStato();
  };

  // ---------------- pannello ----------------
  const TABS = [['nuovo', 'Nuovo torneo'], ['tornei', 'Tornei'], ['partite', 'Partite'], ['carte', 'Carte giocatori'], ['impostazioni', 'Impostazioni']];
  function avvia() {
    DATI.config = DATI.config || {}; DATI.tornei = DATI.tornei || [];
    $('#pannello').style.display = '';
    $('#tabs').innerHTML = TABS.map(([k, l]) => `<button class="btn sec" data-t="${k}">${l}</button>`).join('');
    $$('#tabs button').forEach(b => b.onclick = () => mostraTab(b.dataset.t));
    mostraTab('nuovo'); aggiornaTutto(); aggiornaStato();
  }
  function mostraTab(k) {
    $$('[data-tab]').forEach(s => s.style.display = s.dataset.tab === k ? '' : 'none');
    $$('#tabs button').forEach(b => { b.classList.toggle('sec', b.dataset.t !== k); });
    if (k === 'partite') disegnaPartite();
    if (k === 'carte') disegnaCarte();
  }
  function aggiornaTutto() {
    DATI.tornei.sort((a, b) => a.data.localeCompare(b.data));
    const sedi = [...new Set(['La Torre Nera - Osimo', ...DATI.tornei.map(t => t.sede)])];
    $('#dlSedi').innerHTML = sedi.map(s => `<option value="${esc(s)}">`).join('');
    const nomi = [...new Set(DATI.tornei.flatMap(t => t.classifica.map(r => B.norm(r.nome))))].sort();
    $('#dlGiocatori').innerHTML = nomi.map(n => `<option value="${esc(n)}">`).join('');
    $('#dlPersonaggi').innerHTML = [...B.PERSONAGGI_BASE, ...B.PERSONAGGI_DODGE].map(n => `<option value="${esc(n)}">`).join('');
    disegnaTornei();
    const sel = $('#pTorneo'), v = sel.value;
    sel.innerHTML = DATI.tornei.slice().reverse().map(t => `<option value="${t.id}">${B.fmtData(t.data)} · ${esc(t.sede)}</option>`).join('');
    if (v && DATI.tornei.some(t => t.id === v)) sel.value = v;
    const c = DATI.config;
    $('#cTitolo').value = c.titolo || ''; $('#cSottotitolo').value = c.sottotitolo || '';
    $('#cMese').value = c.meseInizioStagione || 9; $('#cMin').value = c.minPresenzeMedia || 2;
  }

  // ---------------- nuovo torneo ----------------
  let parsato = null;
  function anteprima() {
    const txt = $('#incolla').value;
    parsato = B.parseRisultati(txt);
    if (parsato.data && !$('#nData').dataset.toccato) $('#nData').value = parsato.data;
    if (parsato.sede && !$('#nSede').dataset.toccato) $('#nSede').value = /torre nera/i.test(parsato.sede) ? 'La Torre Nera - Osimo' : parsato.sede;
    if (parsato.codice && !$('#nCodice').dataset.toccato) $('#nCodice').value = parsato.codice;
    const r = parsato.righe;
    if (!txt.trim()) { $('#anteprima').innerHTML = ''; $('#btnAggiungi').disabled = true; return; }
    const pos = r.map(x => x.pos), buchi = r.length && pos.some((p, i) => p !== i + 1);
    const dupl = r.length - new Set(r.map(x => x.nome)).size;
    const turniAuto = B.turniDi({ classifica: r }, B.regole(DATI.config));
    $('#anteprima').innerHTML = `
      <div class="avviso ${r.length ? 'ok' : 'err'}">${r.length ? `Riconosciuti <b>${r.length}</b> giocatori → <b>${turniAuto}</b> turni previsti dal regolamento.` : 'Nessuna riga riconosciuta. Formato atteso: <code>1° NOME COGNOME 5.260</code>'}</div>
      ${buchi ? '<div class="avviso err">Attenzione: le posizioni non sono consecutive da 1.</div>' : ''}
      ${dupl ? '<div class="avviso err">Attenzione: c\'è un nome ripetuto.</div>' : ''}
      ${parsato.scartate.length ? `<div class="avviso err">Righe non capite: ${parsato.scartate.map(esc).join(' · ')}</div>` : ''}
      ${r.length ? `<details open><summary>Anteprima classifica</summary><div class="tab-wrap"><table class="t mini"><thead><tr><th>Pos</th><th>Nome</th><th class="num">$</th><th></th></tr></thead><tbody>
        ${r.map(x => { const nuovo = !DATI.tornei.some(t => t.classifica.some(y => B.norm(y.nome) === x.nome)); return `<tr><td>${x.pos}°</td><td>${esc(x.nome)}</td><td class="num">${B.fmt$(x.dollari)}</td><td>${nuovo ? '<span class="pill ok">nuovo</span>' : ''}</td></tr>`; }).join('')}
      </tbody></table></div></details>` : ''}`;
    $('#btnAggiungi').disabled = !r.length;
  }
  $('#incolla').oninput = anteprima;
  ['#nData', '#nSede', '#nCodice'].forEach(s => $(s).addEventListener('input', () => { $(s).dataset.toccato = 1; }));
  $('#btnAggiungi').onclick = () => {
    if (!parsato || !parsato.righe.length) return;
    const t = { data: $('#nData').value, sede: $('#nSede').value.trim(), codice: $('#nCodice').value.trim(), note: $('#nNote').value.trim(), classifica: parsato.righe, partite: [] };
    if (!t.data || !t.sede) return msg('#msg', 'Servono almeno data e sede.', 'err');
    const tu = parseInt($('#nTurni').value, 10); if (tu) t.turni = tu;
    t.id = idTorneo(t);
    if (DATI.tornei.some(x => x.id === t.id)) return msg('#msg', 'Esiste già un torneo con questa data e sede.', 'err');
    DATI.tornei.push(t); segnaModifica(); aggiornaTutto();
    $('#incolla').value = ''; $('#nNote').value = ''; $('#nTurni').value = ''; ['#nData', '#nSede', '#nCodice'].forEach(s => delete $(s).dataset.toccato); anteprima();
    msg('#msg', `✔ Torneo del ${B.fmtData(t.data)} aggiunto. ${COLLEGATO ? 'Premi <b>Pubblica sul sito</b> quando hai finito.' : ''}`, 'ok');
  };

  // ---------------- elenco tornei ----------------
  function disegnaTornei() {
    $('#elencoTornei').innerHTML = DATI.tornei.length ? `<div class="tab-wrap"><table class="t"><thead><tr><th>Data</th><th>Sede</th><th class="num">Giocatori</th><th class="num">Partite</th><th></th></tr></thead><tbody>
      ${DATI.tornei.slice().reverse().map(t => `<tr><td>${B.fmtData(t.data)}</td><td>${esc(t.sede)}${t.codice ? ` <span class="dim mini">#${esc(t.codice)}</span>` : ''}</td><td class="num">${t.classifica.length}</td><td class="num">${(t.partite || []).length}</td>
        <td style="white-space:nowrap;text-align:right"><button class="btn sec pic" data-mod="${t.id}">Modifica</button> <button class="btn sec pic" data-del="${t.id}">Elimina</button></td></tr>
        <tr id="mod-${t.id}" style="display:none"><td colspan="5"></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="nota">Nessun torneo.</p>';
    $$('[data-del]').forEach(b => b.onclick = () => {
      const t = DATI.tornei.find(x => x.id === b.dataset.del);
      if (!confirm(`Eliminare il torneo del ${B.fmtData(t.data)} (${t.sede}) con tutte le sue partite?`)) return;
      DATI.tornei = DATI.tornei.filter(x => x !== t); segnaModifica(); aggiornaTutto();
    });
    $$('[data-mod]').forEach(b => b.onclick = () => {
      const t = DATI.tornei.find(x => x.id === b.dataset.mod), tr = $('#mod-' + t.id);
      if (tr.style.display === '') { tr.style.display = 'none'; return; }
      tr.style.display = '';
      tr.firstElementChild.innerHTML = `<div style="padding:10px 0">
        <div class="riga r4"><label class="campo"><span>Data</span><input class="in" type="date" data-k="data" value="${t.data}"></label>
        <label class="campo"><span>Sede</span><input class="in" data-k="sede" list="dlSedi" value="${esc(t.sede)}"></label>
        <label class="campo"><span>Codice</span><input class="in" data-k="codice" value="${esc(t.codice || '')}"></label>
        <label class="campo"><span>Turni (vuoto = auto)</span><input class="in" type="number" data-k="turni" value="${t.turni || ''}"></label></div>
        <label class="campo"><span>Note</span><input class="in" data-k="note" value="${esc(t.note || '')}"></label>
        <label class="campo"><span>Classifica (una riga per giocatore: posizione, nome, dollari)</span><textarea class="in" data-k="classifica">${t.classifica.map(r => `${r.pos}°\t${r.nome}\t${r.dollari}`).join('\n')}</textarea></label>
        <button class="btn" data-salva>Salva modifiche</button></div>`;
      tr.querySelector('[data-salva]').onclick = () => {
        const get = k => tr.querySelector(`[data-k="${k}"]`).value.trim();
        const p = B.parseRisultati(get('classifica'));
        if (!p.righe.length) return alert('La classifica non è leggibile.');
        if (p.scartate.length && !confirm('Alcune righe non sono state capite e verranno ignorate:\n' + p.scartate.join('\n') + '\n\nContinuare?')) return;
        const vecchioId = t.id;
        Object.assign(t, { data: get('data'), sede: get('sede'), codice: get('codice'), note: get('note'), classifica: p.righe });
        const tu = parseInt(get('turni'), 10); if (tu) t.turni = tu; else delete t.turni;
        t.id = idTorneo(t);
        if (t.id !== vecchioId && DATI.tornei.some(x => x !== t && x.id === t.id)) t.id += '-2';
        segnaModifica(); aggiornaTutto(); msg('#msg', '✔ Torneo aggiornato.', 'ok');
      };
    });
  }

  // ---------------- partite ----------------
  const torneoSel = () => DATI.tornei.find(t => t.id === $('#pTorneo').value);
  $('#pEsito').innerHTML = Object.entries(B.ESITI).map(([k, e]) => `<label><input type="radio" name="esito" value="${k}"><span>${esc(e.nome)}</span></label>`).join('');
  $('#pSmazzate').innerHTML = [0, 1, 2, 3].map(n => `<label><input type="radio" name="smz" value="${n}" ${n === 0 ? 'checked' : ''}><span>${n === 0 ? 'nessuna' : n}${n === 3 ? ' ☀' : ''}</span></label>`).join('');
  $$('#pNum button').forEach(b => b.onclick = () => { const vecchie = leggiRighe(); nGiocatori = +b.dataset.n; disegnaRighe(vecchie); });

  function disegnaRighe(val) {
    val = val || [];
    $$('#pNum button').forEach(b => b.classList.toggle('sec', +b.dataset.n !== nGiocatori));
    let h = '';
    for (let i = 0; i < nGiocatori; i++) {
      const v = val[i] || {};
      h += `<tr data-i="${i}"><td><b>${i + 1}</b></td>
        <td><input class="in" data-c="nome" list="dlTavolo" value="${esc(v.nome || '')}" placeholder="NOME COGNOME"></td>
        <td><input class="in" data-c="personaggio" list="dlPersonaggi" value="${esc(v.personaggio || '')}"></td>
        <td>${i === 0 ? '<span class="ruolo sceriffo">Sceriffo</span><input type="hidden" data-c="ruolo" value="sceriffo">' :
          `<select class="in" data-c="ruolo"><option value=""></option>${['vice', 'fuorilegge', 'rinnegato'].map(r => `<option value="${r}" ${v.ruolo === r ? 'selected' : ''}>${B.RUOLI[r].nome}</option>`).join('')}</select>`}</td>
        <td><input class="in" data-c="asta" type="number" min="0" step="10" value="${v.asta != null ? v.asta : ''}" style="width:96px;text-align:right"></td>
        <td class="num" data-c="vinti"></td></tr>`;
    }
    $('#pRighe').innerHTML = h;
    $$('#pRighe .in').forEach(el => el.addEventListener('input', controllaScheda));
    controllaScheda();
  }
  function leggiRighe() {
    return $$('#pRighe tr').map(tr => {
      const g = c => tr.querySelector(`[data-c="${c}"]`);
      return { nome: B.norm(g('nome').value), personaggio: g('personaggio').value.trim(), ruolo: g('ruolo').value, asta: g('asta').value === '' ? null : parseInt(g('asta').value, 10) };
    });
  }
  const esitoSel = () => (document.querySelector('input[name=esito]:checked') || {}).value || '';
  document.addEventListener('change', e => { if (e.target.name === 'esito') controllaScheda(); });

  function controllaScheda() {
    const righe = leggiRighe(), es = esitoSel(), R = B.regole(DATI.config), t = torneoSel();
    const n = righe.filter(r => r.nome).length;
    $$('#pRighe tr').forEach((tr, i) => { const r = righe[i]; const v = r.nome ? B.vincita(r.ruolo, es, n, R) : 0; tr.querySelector('[data-c="vinti"]').innerHTML = v ? `<b>${B.fmt$(v)}</b>` : '<span class="dim">–</span>'; });
    const av = [];
    const conta = r => righe.filter(x => x.nome && x.ruolo === r).length;
    const atteso = { 5: { vice: 1, fuorilegge: 2, rinnegato: 1 }, 6: { vice: 1, fuorilegge: 3, rinnegato: 1 }, 7: { vice: 2, fuorilegge: 3, rinnegato: 1 } }[n];
    if (atteso && righe.every(r => !r.nome || r.ruolo)) { const sb = Object.entries(atteso).filter(([r, q]) => conta(r) !== q); if (sb.length) av.push(`Con ${n} giocatori i ruoli dovrebbero essere: 1 Sceriffo, ${atteso.vice} Vice, ${atteso.fuorilegge} Fuorilegge, 1 Rinnegato.`); }
    if (n && n < 5) av.push('Il regolamento prevede tavoli da 5, 6 o 7 giocatori.');
    if (t) { const nomi = new Set(t.classifica.map(r => B.norm(r.nome))); const fuori = righe.filter(r => r.nome && !nomi.has(r.nome)); if (fuori.length) av.push('Non presenti nella classifica del torneo: ' + fuori.map(r => esc(r.nome)).join(', ') + ' (controlla come sono scritti).'); }
    const dup = righe.filter(r => r.nome).map(r => r.nome); if (dup.length !== new Set(dup).size) av.push('Un giocatore è inserito due volte.');
    if (righe.some(r => r.asta != null && r.asta % 10)) av.push('Le offerte all\'asta sono multipli di 10 $.');
    $('#pAvvisi').innerHTML = av.map(a => `<div class="avviso err">${a}</div>`).join('');
  }

  function disegnaPartite() {
    const t = torneoSel();
    // elenco nomi del torneo per l'autocompletamento
    let dl = $('#dlTavolo'); if (!dl) { dl = document.createElement('datalist'); dl.id = 'dlTavolo'; document.body.appendChild(dl); }
    dl.innerHTML = t ? t.classifica.map(r => `<option value="${esc(B.norm(r.nome))}">`).join('') : '';
    if (!$('#pRighe').children.length) disegnaRighe();
    if (!t) { $('#elencoPartite').innerHTML = '<p class="nota">Prima aggiungi un torneo.</p>'; $('#verifica').innerHTML = ''; return; }
    const S = B.calcola(DATI);
    const tt = S.tornei.find(x => x.id === t.id);
    const pts = S.partite.filter(p => p.torneo.id === t.id).sort((a, b) => (a.turno - b.turno) || (a.tavolo - b.tavolo));
    $('#elencoPartite').innerHTML = pts.length ? `<div class="tab-wrap"><table class="t mini"><thead><tr><th>Turno</th><th>Tavolo</th><th>Esito</th><th>Giocatori</th><th></th></tr></thead><tbody>
      ${pts.map(p => `<tr><td>${esc(p.turno)}</td><td>${esc(p.tavolo)}</td><td>${p.esito ? esc(B.ESITI[p.esito].nome) : '<span class="pill ko">manca</span>'}</td><td>${p.giocatori.map(x => esc(B.titolo(x.nome))).join(', ')}</td>
        <td style="white-space:nowrap;text-align:right"><button class="btn sec pic" data-pmod="${p.idx}">Modifica</button> <button class="x" data-pdel="${p.idx}" title="Elimina">✖</button></td></tr>`).join('')}
      </tbody></table></div><p class="nota">Previsti circa ${tt.nTurni} turni × ${Math.max(1, Math.round(t.classifica.length / 6))} tavoli.</p>` : '<p class="nota">Nessuna partita inserita per questo torneo.</p>';
    $$('[data-pdel]').forEach(b => b.onclick = () => { if (!confirm('Eliminare questa partita?')) return; t.partite.splice(+b.dataset.pdel, 1); partitaInModifica = null; segnaModifica(); disegnaPartite(); });
    $$('[data-pmod]').forEach(b => b.onclick = () => caricaPartita(+b.dataset.pmod));
    // verifica
    if (!pts.length) { $('#verifica').innerHTML = '<p class="nota">Appare quando inserisci le partite: confronta il punteggio calcolato dalle schede ($ iniziali + vinti − asta + bonus primi 4) con la classifica ufficiale.</p>'; return; }
    const ko = tt.verifica.filter(v => !v.ok);
    $('#verifica').innerHTML = `<div class="avviso ${ko.length ? 'info' : 'ok'}">${ko.length ? `${ko.length} giocatori su ${tt.verifica.length} non quadrano ancora (normale se mancano delle partite).` : '✔ Tutti i punteggi quadrano con la classifica ufficiale!'}</div>
      ${ko.length ? `<details><summary>Dettaglio</summary><div class="tab-wrap"><table class="t mini"><thead><tr><th>Pos</th><th>Giocatore</th><th class="num">Ufficiale</th><th class="num">Calcolato</th><th class="num">Differenza</th></tr></thead><tbody>
        ${tt.verifica.map(v => `<tr><td>${v.pos}°</td><td>${esc(B.titolo(v.nome))}</td><td class="num">${B.fmt$(v.ufficiale)}</td><td class="num">${B.fmt$(v.calcolato)}</td><td class="num">${v.ok ? '<span class="pill ok">ok</span>' : `<span class="pill ko">${B.fmt$(v.ufficiale - v.calcolato)}</span>`}</td></tr>`).join('')}
      </tbody></table></div></details>` : ''}`;
  }
  $('#pTorneo').onchange = () => { partitaInModifica = null; $('#pRighe').innerHTML = ''; disegnaRighe(); disegnaPartite(); };

  function caricaPartita(i) {
    const t = torneoSel(), p = t.partite[i];
    partitaInModifica = i;
    $('#pTurno').value = p.turno || ''; $('#pTavolo').value = p.tavolo || '';
    $$('input[name=esito]').forEach(r => r.checked = r.value === p.esito);
    $$('input[name=smz]').forEach(r => r.checked = +r.value === (+p.smazzate || 0));
    nGiocatori = Math.min(7, Math.max(5, p.giocatori.length));
    disegnaRighe(p.giocatori);
    $('#btnSalvaPartita').textContent = 'Aggiorna partita';
    $('[data-tab="partite"]').scrollIntoView({ behavior: 'smooth' });
  }
  function svuota() {
    partitaInModifica = null; $('#btnSalvaPartita').textContent = 'Salva partita';
    $$('input[name=esito]').forEach(r => r.checked = false); $$('input[name=smz]').forEach(r => r.checked = r.value === '0');
    $('#pRighe').innerHTML = ''; disegnaRighe();
  }
  $('#btnNuovaPartita').onclick = svuota;
  $('#btnSalvaPartita').onclick = () => {
    const t = torneoSel(); if (!t) return;
    const righe = leggiRighe().filter(r => r.nome);
    if (righe.length < 2) return msg('#msg', 'Inserisci i giocatori del tavolo.', 'err');
    if (!esitoSel() && !confirm('Non hai indicato chi ha vinto. Salvare comunque?')) return;
    const p = {
      turno: parseInt($('#pTurno').value, 10) || null, tavolo: parseInt($('#pTavolo').value, 10) || null,
      esito: esitoSel(), smazzate: +(document.querySelector('input[name=smz]:checked') || { value: 0 }).value,
      giocatori: righe.map(r => ({ nome: r.nome, personaggio: r.personaggio, ruolo: r.ruolo, asta: r.asta || 0 }))
    };
    t.partite = t.partite || [];
    if (partitaInModifica != null) t.partite[partitaInModifica] = p; else t.partite.push(p);
    segnaModifica();
    const prossimo = (p.tavolo || 0) + 1;
    svuota(); $('#pTurno').value = p.turno || 1; $('#pTavolo').value = prossimo;
    disegnaPartite();
    msg('#msg', `✔ Partita salvata (turno ${p.turno}, tavolo ${p.tavolo}).`, 'ok');
  };

  // ---------------- carte dei giocatori ----------------
  // ridimensiona l'immagine nel browser e la restituisce come JPEG (data URL)
  function ridimensiona(file, maxH, qualita) {
    return new Promise((ok, ko) => {
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, maxH / Math.max(img.width, img.height));
        const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(img.src); ok(c.toDataURL('image/jpeg', qualita));
      };
      img.onerror = () => ko(new Error('Immagine non leggibile'));
      img.src = URL.createObjectURL(file);
    });
  }
  function disegnaCarte() {
    const S = B.calcola(DATI);
    const f = B.norm($('#cercaCarte').value);
    const arr = S.giocatori.filter(p => !f || p.key.includes(f)).sort((a, b) => (!!MINI[b.slug] - !!MINI[a.slug]) || a.nome.localeCompare(b.nome));
    const con = S.giocatori.filter(p => MINI[p.slug]).length;
    $('#elencoCarte').innerHTML = `<p class="nota" style="grid-column:1/-1;margin:0">${con} giocatori su ${S.giocatori.length} hanno la carta.</p>` + arr.map(p => `
      <div class="gc"><div class="ant">${MINI[p.slug] ? `<img src="${MINI[p.slug]}" alt="">` : esc(p.nome.split(' ').map(w => w[0]).slice(0, 2).join(''))}</div>
        <div><div class="nm">${esc(p.nome)}</div><div class="az">
          <label class="btn sec pic">${MINI[p.slug] ? 'Cambia' : 'Carica carta'}<input type="file" accept="image/*" data-carica="${p.slug}" hidden></label>
          ${MINI[p.slug] ? `<button class="btn sec pic" data-togli="${p.slug}">Rimuovi</button>` : ''}
        </div></div></div>`).join('');
    $$('[data-carica]').forEach(inp => inp.onchange = async () => {
      const file = inp.files[0]; if (!file) return;
      const slug = inp.dataset.carica;
      msg('#msg', 'Carico la carta…');
      try {
        let img = await ridimensiona(file, 800, 0.85);
        if (img.length > 850000) img = await ridimensiona(file, 600, 0.75);
        const mini = await ridimensiona(file, 160, 0.8);
        await window.BANG_DB.salvaCarta(slug, img, mini);
        MINI[slug] = mini; disegnaCarte();
        msg('#msg', '✔ Carta salvata: è già visibile sul sito.', 'ok');
      } catch (e) { msg('#msg', 'Carta non salvata: ' + errore(e), 'err'); }
    });
    $$('[data-togli]').forEach(b => b.onclick = async () => {
      if (!confirm('Rimuovere la carta di questo giocatore?')) return;
      try { await window.BANG_DB.eliminaCarta(b.dataset.togli); delete MINI[b.dataset.togli]; disegnaCarte(); msg('#msg', '✔ Carta rimossa.', 'ok'); }
      catch (e) { msg('#msg', 'Errore: ' + errore(e), 'err'); }
    });
  }
  $('#cercaCarte').oninput = disegnaCarte;

  // ---------------- impostazioni ----------------
  $('#btnSalvaImp').onclick = () => {
    Object.assign(DATI.config, { titolo: $('#cTitolo').value.trim(), sottotitolo: $('#cSottotitolo').value.trim(), meseInizioStagione: parseInt($('#cMese').value, 10) || 9, minPresenzeMedia: parseInt($('#cMin').value, 10) || 2 });
    segnaModifica(); msg('#msg', '✔ Impostazioni applicate.', 'ok');
  };
  $('#btnAlias').onclick = () => {
    const da = B.norm($('#aliasDa').value), a = B.norm($('#aliasA').value);
    if (!da || !a || da === a) return;
    let n = 0;
    DATI.tornei.forEach(t => { t.classifica.forEach(r => { if (B.norm(r.nome) === da) { r.nome = a; n++; } }); (t.partite || []).forEach(p => p.giocatori.forEach(g => { if (B.norm(g.nome) === da) { g.nome = a; n++; } })); });
    if (!n) return msg('#msg', 'Nessun "' + esc(da) + '" trovato.', 'err');
    segnaModifica(); aggiornaTutto(); msg('#msg', `✔ Sostituito in ${n} punti.`, 'ok');
  };
  $('#btnScarica').onclick = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(DATI, null, 1) + '\n'], { type: 'application/json' }));
    a.download = 'dati.json'; a.click();
  };
  $('#fileBackup').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(txt => { const d = JSON.parse(txt); if (!d.tornei) throw new Error('File non valido'); if (!confirm('Sostituire tutti i dati con il backup?')) return; DATI = d; segnaModifica(); aggiornaTutto(); msg('#msg', '✔ Backup caricato.', 'ok'); })
      .catch(err => msg('#msg', 'Backup non valido: ' + esc(err.message), 'err'));
  };
})();

/* Bang! alla Torre Nera — calcolo statistiche (condiviso tra sito pubblico e admin) */
(function (g) {
  'use strict';

  const RUOLI = {
    sceriffo:   { nome: 'Sceriffo',   fazione: 'legge' },
    vice:       { nome: 'Vice',       fazione: 'legge' },
    fuorilegge: { nome: 'Fuorilegge', fazione: 'fuorilegge' },
    rinnegato:  { nome: 'Rinnegato',  fazione: 'rinnegato' }
  };
  const FAZIONI = {
    legge:      { nome: 'La Legge' },
    fuorilegge: { nome: 'I Fuorilegge' },
    rinnegato:  { nome: 'Il Rinnegato' }
  };
  // esiti possibili sulla Scheda di gioco ("Chi ha vinto?")
  const ESITI = {
    legge:        { nome: 'Vince la Legge', fazione: 'legge' },
    legge_duello: { nome: 'La Legge, al duello finale con il Rinnegato', fazione: 'legge' },
    fuorilegge:   { nome: 'Vincono i Fuorilegge', fazione: 'fuorilegge' },
    rinnegato:    { nome: 'Vince il Rinnegato', fazione: 'rinnegato' }
  };
  const PERSONAGGI_BASE = [
    'Bart Cassidy', 'Black Jack', 'Calamity Janet', 'El Gringo', 'Jesse Jones', 'Jourdonnais',
    'Kit Carlson', 'Lucky Duke', 'Paul Regret', 'Pedro Ramirez', 'Rose Doolan', 'Sid Ketchum',
    'Slab the Killer', 'Suzy Lafayette', 'Vulture Sam', 'Willy the Kid'
  ];
  const PERSONAGGI_DODGE = [
    'Apache Kid', 'Belle Star', 'Bill Noface', 'Chuck Wengam', 'Doc Holyday', 'Elena Fuente',
    'Greg Digger', 'Herb Hunter', 'José Delgado', 'Molly Stark', 'Pat Brennan', 'Pixie Pete',
    'Sean Mallory', 'Tequila Joe', 'Vera Custer'
  ];

  // Regolamento da torneo 2026-27 (fase a punteggio). Sovrascrivibile da dati.json → config.regole
  const REGOLE_DEFAULT = {
    vincite: { // $ per numero di giocatori al tavolo
      legge:            { 5: 1200, 6: 1600, 7: 1200 }, // Sceriffo e ciascun Vice
      rinnegatoDuello:  { 5: 300,  6: 350,  7: 400 },  // Rinnegato eliminato per ultimo dallo Sceriffo
      fuorilegge:       { 5: 1800, 6: 1500, 7: 1700 }, // ciascun Fuorilegge
      rinnegato:        { 5: 2400, 6: 2600, 7: 2800 }  // Rinnegato vincitore
    },
    turniPerPartecipanti: [ { min: 25, turni: 5 }, { min: 15, turni: 4 }, { min: 0, turni: 3 } ],
    dollariInizialiPerTurno: 100,   // 3 turni = 300$, 4 = 400$, 5 = 500$
    bonusSenzaDuelloPerTurno: 25,   // ai primi 4: 75$ / 100$ / 125$
    bonusConDuello: { 3: [600, 300, 150, 75], 4: [800, 400, 200, 100], 5: [1000, 500, 250, 125] }
  };
  const regole = cfg => Object.assign({}, REGOLE_DEFAULT, (cfg && cfg.regole) || {});
  const turniDi = (t, R) => t.turni || (R.turniPerPartecipanti.find(x => t.classifica.length >= x.min) || { turni: 3 }).turni;

  // $ vinti a tavolo da un giocatore (prima di togliere l'asta)
  function vincita(ruolo, esito, n, R) {
    const V = R.vincite, k = Math.min(7, Math.max(5, n));
    if (!esito || !ruolo) return 0;
    if (esito === 'legge' || esito === 'legge_duello') {
      if (ruolo === 'sceriffo' || ruolo === 'vice') return V.legge[k] || 0;
      if (ruolo === 'rinnegato' && esito === 'legge_duello') return V.rinnegatoDuello[k] || 0;
      return 0;
    }
    if (esito === 'fuorilegge') return ruolo === 'fuorilegge' ? (V.fuorilegge[k] || 0) : 0;
    if (esito === 'rinnegato') return ruolo === 'rinnegato' ? (V.rinnegato[k] || 0) : 0;
    return 0;
  }

  const norm = s => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
  const titolo = s => norm(s).toLowerCase().replace(/(^|[\s'\-])([a-zà-ù])/g, (m, a, b) => a + b.toUpperCase());
  const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // formattazione all'italiana (punto per le migliaia anche sotto 10.000, virgola per i decimali)
  const fmtN = (n, d = 0) => {
    if (n == null || isNaN(n)) return '–';
    const neg = n < 0, [i, f] = Math.abs(Number(n)).toFixed(d).split('.');
    return (neg ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (f ? ',' + f : '');
  };
  const fmt$ = n => '$ ' + fmtN(Math.round(n || 0));
  const fmtData = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  const fmtDataLunga = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return `${d} ${MESI[m - 1]} ${y}`; };

  function stagione(iso, meseInizio) {
    const [y, m] = iso.split('-').map(Number);
    const a = m >= (meseInizio || 9) ? y : y - 1;
    return `${a}-${String((a + 1) % 100).padStart(2, '0')}`;
  }

  // indice di piazzamento: 100 = primo, 0 = ultimo (confrontabile tra tornei di dimensioni diverse)
  const indice = (pos, n) => n <= 1 ? 100 : (n - pos) / (n - 1) * 100;

  function calcola(dati, filtro) {
    filtro = filtro || {};
    const cfg = dati.config || {};
    let tornei = (dati.tornei || []).slice().sort((a, b) => a.data.localeCompare(b.data));
    tornei.forEach(t => { t.stagione = stagione(t.data, cfg.meseInizioStagione); t.n = t.classifica.length; });
    const tutteStagioni = [...new Set(tornei.map(t => t.stagione))].sort().reverse();
    const tutteSedi = [...new Set(tornei.map(t => t.sede))].sort();
    if (filtro.stagione) tornei = tornei.filter(t => t.stagione === filtro.stagione);
    if (filtro.sede) tornei = tornei.filter(t => t.sede === filtro.sede);

    const giocatori = new Map();
    const G = nome => {
      const k = norm(nome);
      if (!giocatori.has(k)) giocatori.set(k, {
        key: k, slug: slug(k), nome: titolo(k), storico: [], partite: [],
        ruoli: {}, personaggi: {}
      });
      return giocatori.get(k);
    };

    tornei.forEach(t => {
      const tot = t.classifica.reduce((s, r) => s + r.dollari, 0);
      t.totale = tot; t.media = t.n ? tot / t.n : 0;
      t.vincitore = t.classifica.find(r => r.pos === 1) || t.classifica[0];
      t.classifica.forEach(r => {
        const p = G(r.nome);
        p.storico.push({ torneo: t, pos: r.pos, dollari: r.dollari, n: t.n, indice: indice(r.pos, t.n) });
      });
    });

    // partite (dalle Schede di gioco)
    const R = regole(cfg);
    const partite = [];
    tornei.forEach(t => {
      t.nTurni = turniDi(t, R);
      t.iniziali = t.nTurni * R.dollariInizialiPerTurno;
      t.bonus = t.nTurni * R.bonusSenzaDuelloPerTurno;
      (t.partite || []).forEach((pt, i) => {
        const n = (pt.giocatori || []).filter(x => x.nome).length;
        const gs = (pt.giocatori || []).map((x, posto) => Object.assign({}, x, { posto: posto + 1 })).filter(x => x.nome);
        const faz = pt.esito && ESITI[pt.esito] ? ESITI[pt.esito].fazione : null;
        gs.forEach(x => {
          x.vinta = !!(faz && RUOLI[x.ruolo] && RUOLI[x.ruolo].fazione === faz);
          x.vincita = vincita(x.ruolo, pt.esito, n, R);
          x.asta = +x.asta || 0;
          x.netto = x.vincita - x.asta;
        });
        const rec = Object.assign({}, pt, { torneo: t, idx: i, giocatori: gs, n, fazione: faz });
        partite.push(rec);
        gs.forEach(x => {
          const p = G(x.nome);
          p.partite.push(Object.assign({ partita: rec }, x));
          if (x.ruolo) { const r = p.ruoli[x.ruolo] = p.ruoli[x.ruolo] || { g: 0, v: 0, d: 0 }; r.g++; if (x.vinta) r.v++; r.d += x.vincita; }
          if (x.personaggio) { const c = p.personaggi[x.personaggio] = p.personaggi[x.personaggio] || { g: 0, v: 0, asta: 0 }; c.g++; if (x.vinta) c.v++; c.asta += x.asta; }
        });
      });
    });

    const lista = [...giocatori.values()].filter(p => p.storico.length || p.partite.length);
    lista.forEach(p => {
      const s = p.storico;
      p.presenze = s.length;
      p.totale = s.reduce((a, x) => a + x.dollari, 0);
      p.media = s.length ? p.totale / s.length : 0;
      p.vittorie = s.filter(x => x.pos === 1).length;
      p.podi = s.filter(x => x.pos <= 3).length;
      p.top10 = s.filter(x => x.pos <= 10).length;
      p.migliorPos = s.length ? Math.min(...s.map(x => x.pos)) : null;
      p.migliorDollari = s.length ? Math.max(...s.map(x => x.dollari)) : 0;
      p.indiceMedio = s.length ? s.reduce((a, x) => a + x.indice, 0) / s.length : 0;
      p.ultimo = s.length ? s[s.length - 1] : null;
      p.nPartite = p.partite.length;
      p.partiteVinte = p.partite.filter(x => x.vinta).length;
      p.vinteATavolo = p.partite.reduce((a, x) => a + x.vincita, 0);
      p.speseAsta = p.partite.reduce((a, x) => a + x.asta, 0);
      p.astaMedia = p.nPartite ? p.speseAsta / p.nPartite : 0;
      p.volteSceriffo = p.partite.filter(x => x.ruolo === 'sceriffo').length;
      const pers = Object.entries(p.personaggi).sort((a, b) => b[1].g - a[1].g);
      p.personaggioPreferito = pers.length ? pers[0][0] : null;
    });

    // classifica generale: dollari totali, poi media, poi miglior posizione
    lista.sort((a, b) => b.totale - a.totale || b.media - a.media || (a.migliorPos || 99) - (b.migliorPos || 99));
    lista.forEach((p, i) => p.rank = i + 1);

    // statistiche partite
    const perFazione = { legge: 0, fuorilegge: 0, rinnegato: 0 };
    const perEsito = { legge: 0, legge_duello: 0, fuorilegge: 0, rinnegato: 0 };
    const perNumero = {};
    const personaggi = {};
    const ruoli = {};
    const posti = {};
    const smazzate = { 0: 0, 1: 0, 2: 0, 3: 0 };
    partite.forEach(pt => {
      if (pt.fazione) perFazione[pt.fazione]++;
      if (pt.esito && perEsito[pt.esito] != null) perEsito[pt.esito]++;
      if (pt.smazzate != null && pt.smazzate !== '') smazzate[Math.min(3, +pt.smazzate)]++;
      const nn = perNumero[pt.n] = perNumero[pt.n] || { tot: 0, legge: 0, fuorilegge: 0, rinnegato: 0 };
      nn.tot++; if (pt.fazione) nn[pt.fazione]++;
      pt.giocatori.forEach(x => {
        if (x.personaggio) {
          const c = personaggi[x.personaggio] = personaggi[x.personaggio] || { nome: x.personaggio, g: 0, v: 0, asta: 0, astaMax: 0, vincita: 0 };
          c.g++; if (x.vinta) c.v++; c.asta += x.asta; c.astaMax = Math.max(c.astaMax, x.asta); c.vincita += x.vincita;
        }
        if (x.ruolo) { const r = ruoli[x.ruolo] = ruoli[x.ruolo] || { g: 0, v: 0, d: 0 }; r.g++; if (x.vinta) r.v++; r.d += x.vincita; }
        const s = posti[x.posto] = posti[x.posto] || { g: 0, v: 0 }; s.g++; if (x.vinta) s.v++;
      });
    });

    // verifica: se tutte le partite di un torneo sono inserite, il punteggio calcolato deve quadrare con la classifica
    tornei.forEach(t => {
      const pts = partite.filter(pt => pt.torneo === t);
      t.nPartite = pts.length;
      const calc = {};
      pts.forEach(pt => pt.giocatori.forEach(x => { const k = norm(x.nome); calc[k] = (calc[k] || 0) + x.netto; }));
      t.verifica = t.classifica.map(r => {
        const atteso = t.iniziali + (calc[norm(r.nome)] || 0) + (r.pos <= 4 ? t.bonus : 0);
        return { nome: r.nome, pos: r.pos, ufficiale: r.dollari, calcolato: atteso, ok: atteso === r.dollari };
      });
    });

    const tuttiDollari = [];
    tornei.forEach(t => t.classifica.forEach(r => tuttiDollari.push({ torneo: t, ...r })));
    tuttiDollari.sort((a, b) => b.dollari - a.dollari);

    return {
      cfg, R, tornei, giocatori: lista, partite, perFazione, perEsito, perNumero, posti, smazzate,
      personaggi: Object.values(personaggi).sort((a, b) => b.g - a.g || b.v - a.v),
      ruoli, tuttiDollari, tutteStagioni, tutteSedi,
      totDollari: tornei.reduce((a, t) => a + t.totale, 0),
      iscrizioni: tornei.reduce((a, t) => a + t.n, 0),
      trova: s => lista.find(p => p.slug === s)
    };
  }

  // scontri diretti tra due giocatori (tornei in comune + partite allo stesso tavolo)
  function confronto(S, a, b) {
    const mapB = new Map(b.storico.map(x => [x.torneo.id, x]));
    const comuni = a.storico.filter(x => mapB.has(x.torneo.id)).map(x => ({ torneo: x.torneo, a: x, b: mapB.get(x.torneo.id) }));
    const tavoli = S.partite.filter(pt => pt.giocatori.some(x => norm(x.nome) === a.key) && pt.giocatori.some(x => norm(x.nome) === b.key));
    return {
      comuni,
      aDavanti: comuni.filter(c => c.a.pos < c.b.pos).length,
      bDavanti: comuni.filter(c => c.b.pos < c.a.pos).length,
      tavoli
    };
  }

  function rivali(S, p) {
    return S.giocatori.filter(q => q !== p).map(q => ({ q, c: confronto(S, p, q) }))
      .filter(x => x.c.comuni.length).sort((x, y) => y.c.comuni.length - x.c.comuni.length || (y.c.aDavanti - y.c.bDavanti) - (x.c.aDavanti - x.c.bDavanti));
  }

  // parser del testo della mail con i risultati
  function parseRisultati(testo) {
    const righe = [];
    const out = { righe, data: '', sede: '', codice: '', scartate: [] };
    const mD = testo.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
    if (mD) out.data = `${mD[3]}-${mD[2].padStart(2, '0')}-${mD[1].padStart(2, '0')}`;
    const mS = testo.match(/presso\s+(.+?)\s*[.\n]/i);
    if (mS) out.sede = titolo(mS[1]);
    const mC = testo.match(/codice\s+(\d+)/i);
    if (mC) out.codice = mC[1];
    testo.split(/\r?\n/).forEach(l => {
      const m = l.match(/^\s*(\d+)\s*[°º^.)]?\s*[\t ]+(.+?)[\t ]+\$?\s*(-?[\d.,]+)\s*\$?\s*$/);
      if (m) righe.push({ pos: +m[1], nome: norm(m[2]), dollari: parseInt(m[3].replace(/[.,]/g, ''), 10) || 0 });
      else if (l.trim() && /\d/.test(l) && !/presso|codice|data/i.test(l)) out.scartate.push(l.trim());
    });
    return out;
  }

  g.BANG = { RUOLI, FAZIONI, ESITI, PERSONAGGI_BASE, PERSONAGGI_DODGE, REGOLE_DEFAULT, regole, vincita, turniDi, norm, titolo, slug, fmt$, fmtN, fmtData, fmtDataLunga, stagione, indice, calcola, confronto, rivali, parseRisultati };
})(window);

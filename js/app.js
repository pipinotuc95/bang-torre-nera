/* Bang! alla Torre Nera — sito pubblico */
(function () {
  'use strict';
  const B = window.BANG;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '–';
  const iniziali = nome => nome.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('');
  const lnkG = p => `<a href="#/giocatore/${p.slug}">${esc(p.nome)}</a>`;
  const lnkT = t => `<a href="#/torneo/${t.id}">${esc(t.sede)}</a>`;
  const posCls = p => p === 1 ? 'oro' : p === 2 ? 'arg' : p === 3 ? 'bro' : '';
  const COL = { legge: 'var(--legge)', fuorilegge: 'var(--fuorilegge)', rinnegato: 'var(--rinnegato)', sceriffo: 'var(--legge)', vice: '#9a7a3a' };

  const STELLA = (col = '#c8962a') => `<svg class="stella" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="47" fill="none" stroke="${col}" stroke-width="4"/>
    <path d="M50 8 L61 36 L92 36 L67 55 L77 86 L50 67 L23 86 L33 55 L8 36 L39 36 Z" fill="${col}" stroke="#4a3210" stroke-width="2.5"/>
    <circle cx="50" cy="52" r="9" fill="#f4e6c6" stroke="#4a3210" stroke-width="2"/></svg>`;

  let DATI = null, S = null, MINI = {};
  // avatar: miniatura della carta se c'è, altrimenti le iniziali
  const avatar = (p, cls = 'avatar', stile = '') => MINI[p.slug]
    ? `<span class="${cls} con-carta" style="${stile}"><img src="${MINI[p.slug]}" alt="Carta di ${esc(p.nome)}" loading="lazy"></span>`
    : `<span class="${cls}" style="${stile}">${iniziali(p.nome)}</span>`;
  const filtro = { stagione: '', sede: '' };

  // ---------------- tooltip ----------------
  const tip = document.createElement('div'); tip.className = 'tooltip'; document.body.appendChild(tip);
  document.addEventListener('mousemove', e => {
    const el = e.target.closest('[data-tip]');
    if (!el) { tip.style.display = 'none'; return; }
    tip.innerHTML = el.getAttribute('data-tip'); tip.style.display = 'block';
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY - h - 12;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y < 8) y = e.clientY + 16;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });

  // ---------------- grafici SVG ----------------
  function graficoLinea(punti, o = {}) {
    if (!punti.length) return '';
    const W = 640, H = o.h || 220, m = { l: 52, r: 16, t: 14, b: 34 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const yMin = o.yMin != null ? o.yMin : 0;
    let yMax = o.yMax, autoTicks = null;
    if (yMax == null) { // scala "tonda": passi da 1, 2 o 5 × 10^n
      const grezzo = Math.max(...punti.map(p => p.y)) / 4 || 1, e = Math.pow(10, Math.floor(Math.log10(grezzo)));
      const passo = [1, 2, 5, 10].map(k => k * e).find(k => k >= grezzo);
      yMax = Math.ceil(Math.max(...punti.map(p => p.y)) / passo) * passo || passo;
      autoTicks = []; for (let v = 0; v <= yMax + 1e-9; v += passo) autoTicks.push(v);
    }
    const X = i => m.l + (punti.length === 1 ? iw / 2 : i * iw / (punti.length - 1));
    const Y = v => o.inverti ? m.t + (v - yMin) / (yMax - yMin) * ih : m.t + ih - (v - yMin) / (yMax - yMin) * ih;
    const ticks = o.ticks || autoTicks || [0, .25, .5, .75, 1].map(f => yMin + (yMax - yMin) * f);
    let s = `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || '')}">`;
    ticks.forEach(v => { s += `<line class="griglia-l" x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${m.l - 8}" y="${Y(v) + 4}" text-anchor="end">${o.fy ? o.fy(v) : B.fmtN(v)}</text>`; });
    s += `<line class="asse" x1="${m.l}" x2="${W - m.r}" y1="${m.t + ih}" y2="${m.t + ih}"/>`;
    const passo = Math.ceil(punti.length / 8);
    punti.forEach((p, i) => { if (i % passo === 0 || i === punti.length - 1) s += `<text x="${X(i)}" y="${H - 10}" text-anchor="middle">${esc(p.x)}</text>`; });
    if (punti.length > 1) s += `<polyline class="linea" points="${punti.map((p, i) => X(i) + ',' + Y(p.y)).join(' ')}"/>`;
    punti.forEach((p, i) => { s += `<circle class="hit" cx="${X(i)}" cy="${Y(p.y)}" r="14" data-tip="${esc(p.tip || '')}"/><circle class="punto" cx="${X(i)}" cy="${Y(p.y)}" r="5" pointer-events="none"/>`; });
    return s + '</svg>';
  }

  // barre orizzontali (html) — valore, etichetta, colore
  function barre(righe, o = {}) {
    if (!righe.length) return '<p class="nota">Nessun dato.</p>';
    const max = o.max || Math.max(...righe.map(r => r.v)) || 1;
    return `<div class="hbar">${righe.map(r => `
      <div>${r.l}</div>
      <div class="tr" data-tip="${esc(r.tip || '')}"><i style="width:${Math.max(1.5, r.v / max * 100)}%;background:${r.c || 'var(--red)'}"></i></div>
      <div class="val">${r.t != null ? r.t : B.fmtN(r.v)}</div>`).join('')}</div>`;
  }

  // barra impilata per fazioni
  function impilata(cont, tot) {
    if (!tot) return '<div class="tr"></div>';
    return `<div style="display:flex;gap:2px;height:16px">${['legge', 'fuorilegge', 'rinnegato'].map(f => cont[f] ? `<i data-tip="${B.FAZIONI[f].nome}: ${cont[f]} (${pct(cont[f], tot)})" style="flex:${cont[f]};background:${COL[f]};border-radius:2px"></i>` : '').join('')}</div>`;
  }

  // ---------------- componenti ----------------
  const kpi = arr => `<div class="kpi">${arr.map(k => `<div class="k"><div class="v">${k.v}</div><div class="l">${k.l}</div>${k.s ? `<div class="s">${k.s}</div>` : ''}</div>`).join('')}</div>`;

  function podio(t) {
    const r = n => t.classifica.find(x => x.pos === n);
    const cella = (n, cls) => { const x = r(n); if (!x) return '<div></div>'; const p = S.giocatori.find(g => g.key === B.norm(x.nome));
      return `<div class="p ${cls}">${STELLA(n === 1 ? '#c8962a' : n === 2 ? '#9aa0a6' : '#a0612c')}
        <div class="nome">${p ? lnkG(p) : esc(B.titolo(x.nome))}</div><div class="soldi">${B.fmt$(x.dollari)}</div><div class="gradino">${n}</div></div>`; };
    return `<div class="podio">${cella(2, 'p2')}${cella(1, 'p1')}${cella(3, 'p3')}</div>`;
  }

  const vuoto = (msg) => `<div class="vuoto"><span class="cactus">🌵</span>${msg}</div>`;

  function filtriHtml() {
    if (S.tutteStagioni.length < 2 && S.tutteSedi.length < 2) return '';
    return `<div class="filtri">
      ${S.tutteStagioni.length > 1 ? `<label>Stagione</label><select data-f="stagione"><option value="">Tutte</option>${S.tutteStagioni.map(s => `<option ${filtro.stagione === s ? 'selected' : ''}>${s}</option>`).join('')}</select>` : ''}
      ${S.tutteSedi.length > 1 ? `<label>Sede</label><select data-f="sede"><option value="">Tutte</option>${S.tutteSedi.map(s => `<option ${filtro.sede === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>` : ''}
    </div>`;
  }

  // ---------------- pagine ----------------
  const PAGINE = {};

  PAGINE.home = () => {
    const ult = S.tornei[S.tornei.length - 1];
    const top = S.giocatori.slice(0, 10);
    const piuPresenze = S.giocatori.slice().sort((a, b) => b.presenze - a.presenze || b.totale - a.totale)[0];
    const record = S.tuttiDollari[0];
    const recP = record && S.giocatori.find(g => g.key === B.norm(record.nome));
    const mediaMin = S.cfg.minPresenzeMedia || 2;
    const migliorMedia = S.giocatori.filter(p => p.presenze >= mediaMin).sort((a, b) => b.media - a.media)[0];
    const piuVittorie = S.giocatori.filter(p => p.vittorie).sort((a, b) => b.vittorie - a.vittorie || b.totale - a.totale)[0];
    return `
      ${filtriHtml()}
      ${kpi([
        { v: S.tornei.length, l: 'Tornei' },
        { v: S.giocatori.length, l: 'Pistoleri' },
        { v: S.iscrizioni, l: 'Iscrizioni', s: S.tornei.length ? `media ${B.fmtN(S.iscrizioni / S.tornei.length, 1)} a torneo` : '' },
        { v: B.fmt$(S.totDollari), l: 'Taglie distribuite' },
        { v: S.partite.length, l: 'Partite registrate' }
      ])}
      <div class="griglia g-12">
        <section class="carta chiodi">
          <h2><span class="kicker">Ultimo torneo</span>${ult ? esc(ult.sede) : '—'}</h2>
          ${ult ? `<p class="dim" style="margin-top:-8px">${B.fmtDataLunga(ult.data)} · ${ult.n} giocatori${ult.codice ? ` · cod. ${esc(ult.codice)}` : ''}</p>${podio(ult)}
          <p style="text-align:center;margin:14px 0 0"><a class="btn sec pic" href="#/torneo/${ult.id}">Classifica completa →</a></p>` : vuoto('Nessun torneo ancora.')}
        </section>
        <section class="carta chiodi">
          <h2><span class="kicker">Classifica generale</span>I più ricercati</h2>
          <div class="tab-wrap"><table class="t"><thead><tr><th>#</th><th>Giocatore</th><th class="num">Tornei</th><th class="num">Totale</th></tr></thead><tbody>
          ${top.map(p => `<tr><td class="pos ${posCls(p.rank)}">${p.rank}</td><td>${lnkG(p)}</td><td class="num">${p.presenze}</td><td class="num"><b>${B.fmt$(p.totale)}</b></td></tr>`).join('')}
          </tbody></table></div>
          <p style="text-align:right;margin:12px 0 0"><a class="btn sec pic" href="#/classifica">Tutta la classifica →</a></p>
        </section>
      </div>
      <h2 class="titolo-sezione">Albo dei record</h2>
      <div class="griglia g3" style="gap:16px">
        ${[
          record && { t: 'Taglia più alta in un torneo', v: B.fmt$(record.dollari), n: recP ? lnkG(recP) : esc(B.titolo(record.nome)), s: `${esc(record.torneo.sede)}, ${B.fmtData(record.torneo.data)}` },
          piuVittorie && { t: 'Più tornei vinti', v: piuVittorie.vittorie, n: lnkG(piuVittorie), s: `${piuVittorie.podi} ${piuVittorie.podi === 1 ? 'podio' : 'podi'} in ${piuVittorie.presenze} ${piuVittorie.presenze === 1 ? 'torneo' : 'tornei'}` },
          piuPresenze && { t: 'Più presenze', v: piuPresenze.presenze, n: lnkG(piuPresenze), s: `${B.fmt$(piuPresenze.totale)} totali` },
          migliorMedia && { t: `Miglior media (min. ${mediaMin} tornei)`, v: B.fmt$(migliorMedia.media), n: lnkG(migliorMedia), s: `su ${migliorMedia.presenze} tornei` },
          S.tornei.length && (() => { const t = S.tornei.slice().sort((a, b) => b.n - a.n)[0]; return { t: 'Torneo più partecipato', v: t.n, n: lnkT(t), s: B.fmtData(t.data) }; })(),
          S.tornei.length && (() => { const t = S.tornei.map(t => { const c = t.classifica.slice().sort((a, b) => a.pos - b.pos); return { t, d: c.length > 1 ? c[0].dollari - c[1].dollari : 0 }; }).sort((a, b) => a.d - b.d)[0]; return { t: 'Volata più tirata (1° vs 2°)', v: B.fmt$(t.d), n: lnkT(t.t), s: B.fmtData(t.t.data) }; })()
        ].filter(Boolean).map(r => `<div class="carta" style="text-align:center;padding:18px 14px"><div class="mini" style="font-family:var(--f-mono);letter-spacing:1px;text-transform:uppercase;color:var(--ink-2)">${r.t}</div>
          <div class="cifra-grande" style="margin:6px 0">${r.v}</div><div style="font-family:var(--f-titolo)">${r.n}</div><div class="mini dim">${r.s}</div></div>`).join('')}
      </div>
      ${S.partite.length ? `<h2 class="titolo-sezione">Chi vince a tavolo</h2><section class="carta">${statFazioni()}</section>` : ''}`;
  };

  function statFazioni() {
    const tot = S.partite.length;
    return `<div class="griglia g2"><div><h3>Vittorie per fazione</h3>${barre(['legge', 'fuorilegge', 'rinnegato'].map(f => ({ l: B.FAZIONI[f].nome, v: S.perFazione[f], t: `${S.perFazione[f]} · ${pct(S.perFazione[f], tot)}`, c: COL[f], tip: `${S.perFazione[f]} partite su ${tot}` })), { max: tot })}
      <p class="nota">Su ${tot} partite registrate. ${S.perEsito.legge_duello ? `${S.perEsito.legge_duello} volte la Legge ha vinto al duello finale contro il Rinnegato.` : ''}</p></div>
      <div><h3>Per numero di giocatori al tavolo</h3>
      <div class="hbar">${Object.keys(S.perNumero).sort().map(n => `<div>${n} giocatori</div>${impilata(S.perNumero[n], S.perNumero[n].tot)}<div class="val">${S.perNumero[n].tot} partite</div>`).join('')}</div>
      <div class="legenda">${['legge', 'fuorilegge', 'rinnegato'].map(f => `<span><i style="background:${COL[f]}"></i>${B.FAZIONI[f].nome}</span>`).join('')}</div></div></div>`;
  }

  PAGINE.classifica = () => {
    const mediaMin = S.cfg.minPresenzeMedia || 2;
    const cols = [
      { k: 'rank', l: '#', num: false }, { k: 'nome', l: 'Giocatore' }, { k: 'presenze', l: 'Tornei', num: true },
      { k: 'totale', l: 'Totale $', num: true }, { k: 'media', l: 'Media $', num: true }, { k: 'migliorDollari', l: 'Record $', num: true },
      { k: 'vittorie', l: 'Vittorie', num: true }, { k: 'podi', l: 'Podi', num: true }, { k: 'top10', l: 'Top 10', num: true },
      { k: 'migliorPos', l: 'Miglior pos.', num: true }, { k: 'indiceMedio', l: 'Indice piazz.', num: true }
    ];
    return `${filtriHtml()}
      <section class="carta">
        <h2><span class="kicker">Somma dei $ in tutti i tornei</span>Classifica generale</h2>
        <p class="nota" style="margin-top:-6px">Clicca sulle intestazioni per ordinare. <b>Indice di piazzamento</b>: 100 = primo, 0 = ultimo, così tornei di dimensioni diverse sono confrontabili.</p>
        <input class="cerca" id="cercaClass" placeholder="Cerca un pistolero…" style="margin:6px 0 12px">
        <div class="tab-wrap"><table class="t" id="tabClass"><thead><tr>${cols.map(c => `<th data-k="${c.k}" class="${c.num ? 'num' : ''}">${c.l}</th>`).join('')}</tr></thead><tbody></tbody></table></div>
      </section>`;
  };
  PAGINE.classifica.dopo = () => {
    let k = 'rank', asc = true;
    const tb = $('#tabClass tbody'), q = $('#cercaClass');
    const disegna = () => {
      const f = B.norm(q.value);
      const arr = S.giocatori.filter(p => !f || p.key.includes(f)).sort((a, b) => {
        const va = a[k], vb = b[k];
        const r = typeof va === 'string' ? va.localeCompare(vb) : (va ?? 1e9) - (vb ?? 1e9);
        return asc ? r : -r;
      });
      tb.innerHTML = arr.map(p => `<tr><td class="pos ${posCls(p.rank)}">${p.rank}</td><td>${lnkG(p)}</td><td class="num">${p.presenze}</td>
        <td class="num"><b>${B.fmt$(p.totale)}</b></td><td class="num">${B.fmt$(p.media)}</td><td class="num">${B.fmt$(p.migliorDollari)}</td>
        <td class="num">${p.vittorie || '<span class="dim">0</span>'}</td><td class="num">${p.podi || '<span class="dim">0</span>'}</td><td class="num">${p.top10}</td>
        <td class="num">${p.migliorPos ?? '–'}°</td><td class="num">${B.fmtN(p.indiceMedio)}<span class="barretta"><i style="width:${p.indiceMedio}%"></i></span></td></tr>`).join('') || `<tr><td colspan="11">${vuoto('Nessuno con questo nome.')}</td></tr>`;
      document.querySelectorAll('#tabClass th').forEach(th => th.classList.toggle('ord', th.dataset.k === k));
      document.querySelectorAll('#tabClass th').forEach(th => th.classList.toggle('asc', th.dataset.k === k && asc));
    };
    document.querySelectorAll('#tabClass th[data-k]').forEach(th => th.onclick = () => {
      const nk = th.dataset.k;
      if (nk === k) asc = !asc; else { k = nk; asc = ['rank', 'nome', 'migliorPos'].includes(nk); }
      disegna();
    });
    q.oninput = disegna; disegna();
  };

  PAGINE.tornei = () => `${filtriHtml()}
    <div class="manifesti">${S.tornei.slice().reverse().map((t, i) => `
      <a class="carta manifesto chiodi" href="#/torneo/${t.id}" style="--rot:${[-1.2, .8, -.5, 1.1][i % 4]}deg">
        <div class="wanted">TORNEO</div>
        <div class="quando">${B.fmtDataLunga(t.data).toUpperCase()}</div>
        <div class="dove">${esc(t.sede)}</div>
        <div class="vinc"><span class="mini dim">VINCITORE</span><b>${esc(B.titolo(t.vincitore.nome))}</b></div>
        <div class="reward">${B.fmt$(t.vincitore.dollari)}</div>
        <div class="meta">${t.n} giocatori · ${t.nTurni} turni${t.nPartite ? ` · ${t.nPartite} partite` : ''}</div>
      </a>`).join('') || vuoto('Nessun torneo.')}</div>`;

  PAGINE.torneo = id => {
    const t = S.tornei.find(x => x.id === id);
    if (!t) return vuoto('Torneo non trovato.');
    const c = t.classifica.slice().sort((a, b) => a.pos - b.pos);
    const pts = S.partite.filter(p => p.torneo === t);
    const perTurno = {};
    pts.forEach(p => (perTurno[p.turno || '?'] = perTurno[p.turno || '?'] || []).push(p));
    const conPartite = pts.length > 0;
    const nTot = t.verifica.filter(v => v.ok).length;
    return `
      <p><a href="#/tornei" style="color:var(--gold-l)">← Tutti i tornei</a></p>
      <section class="carta chiodi">
        <h2><span class="kicker">${B.fmtDataLunga(t.data)}${t.codice ? ` · codice ${esc(t.codice)}` : ''}</span>${esc(t.sede)}</h2>
        ${kpi([{ v: t.n, l: 'Giocatori' }, { v: t.nTurni, l: 'Turni', s: `${B.fmt$(t.iniziali)} iniziali a testa` }, { v: B.fmt$(t.totale), l: 'Taglie totali' }, { v: B.fmt$(t.media), l: 'Media a giocatore' }, { v: B.fmt$(c[0].dollari - (c[1] ? c[1].dollari : 0)), l: 'Distacco 1°–2°' }])}
        ${podio(t)}
        ${t.note ? `<p class="nota">${esc(t.note)}</p>` : ''}
      </section>
      <div class="griglia ${conPartite ? 'g2' : ''}" style="margin-top:22px">
      <section class="carta">
        <h2>Classifica finale</h2>
        <div class="tab-wrap"><table class="t"><thead><tr><th>Pos</th><th>Giocatore</th><th class="num">$</th>${conPartite ? '<th class="num">Vinte</th>' : ''}</tr></thead><tbody>
        ${c.map(r => { const p = S.giocatori.find(g => g.key === B.norm(r.nome)); const vin = pts.reduce((a, pt) => a + pt.giocatori.filter(x => B.norm(x.nome) === B.norm(r.nome) && x.vinta).length, 0);
          return `<tr><td class="pos ${posCls(r.pos)}">${r.pos}°</td><td>${p ? lnkG(p) : esc(B.titolo(r.nome))}</td><td class="num"><b>${B.fmt$(r.dollari)}</b></td>${conPartite ? `<td class="num">${vin}</td>` : ''}</tr>`; }).join('')}
        </tbody></table></div>
        ${conPartite && nTot === t.n ? '<p class="nota">✔ I punteggi calcolati dalle schede di gioco quadrano con la classifica ufficiale.</p>' : ''}
      </section>
      ${conPartite ? `<section class="carta"><h2>Partite</h2>${Object.keys(perTurno).sort().map(tu => `<h3>Turno ${esc(tu)}</h3>${perTurno[tu].sort((a, b) => (a.tavolo || 0) - (b.tavolo || 0)).map(schedaPartita).join('')}`).join('')}</section>` : ''}
      </div>`;
  };

  function schedaPartita(pt) {
    const es = B.ESITI[pt.esito];
    return `<div style="border:1px dashed var(--ink-2);border-radius:4px;padding:10px 12px;margin-bottom:12px;background:rgba(255,255,255,.25)">
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px"><b style="font-family:var(--f-titolo);font-weight:400">Tavolo ${esc(pt.tavolo || '?')}</b>
      <span>${es ? `<span class="chip" style="border-color:${COL[es.fazione]};color:${COL[es.fazione]}">${esc(es.nome)}</span>` : ''} ${pt.smazzate >= 3 ? '<span class="chip" title="Mezzogiorno di fuoco">☀ Mezzogiorno di fuoco</span>' : ''}</span></div>
      <div class="tab-wrap"><table class="t mini"><thead><tr><th>#</th><th>Giocatore</th><th>Personaggio</th><th>Ruolo</th><th class="num">Asta</th><th class="num">Vinti</th></tr></thead><tbody>
      ${pt.giocatori.map(x => { const p = S.giocatori.find(g => g.key === B.norm(x.nome));
        return `<tr style="${x.vinta ? 'font-weight:600' : ''}"><td>${x.posto}</td><td>${p ? lnkG(p) : esc(x.nome)}</td><td>${esc(x.personaggio || '')}</td><td>${x.ruolo ? `<span class="ruolo ${x.ruolo}">${B.RUOLI[x.ruolo].nome}</span>` : ''}</td><td class="num">${x.asta ? B.fmt$(x.asta) : ''}</td><td class="num">${x.vincita ? B.fmt$(x.vincita) : '<span class="dim">–</span>'}</td></tr>`; }).join('')}
      </tbody></table></div></div>`;
  }

  PAGINE.giocatori = () => `${filtriHtml()}
    <section class="carta"><h2>I pistoleri</h2>
    <input class="cerca" id="cercaG" placeholder="Cerca per nome o cognome…">
    <div class="schede-g" id="listaG"></div></section>`;
  PAGINE.giocatori.dopo = () => {
    const q = $('#cercaG'), box = $('#listaG');
    const d = () => { const f = B.norm(q.value);
      const arr = S.giocatori.filter(p => !f || p.key.includes(f)).sort((a, b) => a.nome.localeCompare(b.nome));
      box.innerHTML = arr.map(p => `<a class="carta scheda-g" href="#/giocatore/${p.slug}">${avatar(p)}<span><span class="n">${esc(p.nome)}</span><br><span class="d">${p.rank}° · ${p.presenze} ${p.presenze === 1 ? 'torneo' : 'tornei'} · ${B.fmt$(p.totale)}</span></span></a>`).join('') || vuoto('Nessuno trovato.'); };
    q.oninput = d; d();
  };

  PAGINE.giocatore = slug => {
    const p = S.trova(slug);
    if (!p) return vuoto('Giocatore non trovato (forse escluso dai filtri).');
    const s = p.storico;
    const punti = s.map(x => ({ x: B.fmtData(x.torneo.data).slice(0, 5), y: x.dollari, tip: `<b>${esc(x.torneo.sede)}</b><br>${B.fmtData(x.torneo.data)} · ${x.pos}° su ${x.n}<br>${B.fmt$(x.dollari)}` }));
    const puntiPos = s.map(x => ({ x: B.fmtData(x.torneo.data).slice(0, 5), y: x.indice, tip: `${x.pos}° su ${x.n} → indice ${B.fmtN(x.indice)}` }));
    const riv = B.rivali(S, p).slice(0, 8);
    const ruoliRighe = Object.keys(B.RUOLI).filter(r => p.ruoli[r]).map(r => ({ l: `<span class="ruolo ${r}">${B.RUOLI[r].nome}</span>`, v: p.ruoli[r].v / p.ruoli[r].g * 100, t: `${p.ruoli[r].v}/${p.ruoli[r].g} · ${pct(p.ruoli[r].v, p.ruoli[r].g)}`, c: COL[r] || COL[B.RUOLI[r].fazione] }));
    const pers = Object.entries(p.personaggi).sort((a, b) => b[1].g - a[1].g);
    return `
      <section class="carta chiodi"><div class="profilo-testa">${MINI[p.slug] ? `<button class="carta-gioc" id="cartaGioc" title="Ingrandisci la carta"><img src="${MINI[p.slug]}" alt="Carta di ${esc(p.nome)}"></button>` : `<span class="avatar">${iniziali(p.nome)}</span>`}<div>
        <div class="mini" style="font-family:var(--f-mono);letter-spacing:2px;color:var(--red)">WANTED · ${p.rank}° NELLA CLASSIFICA GENERALE</div>
        <h1>${esc(p.nome)}</h1>
        <div class="chips">${p.vittorie ? `<span class="chip">🏆 ${p.vittorie} ${p.vittorie === 1 ? 'torneo vinto' : 'tornei vinti'}</span>` : ''}${p.podi ? `<span class="chip">⭐ ${p.podi} ${p.podi === 1 ? 'podio' : 'podi'}</span>` : ''}${p.personaggioPreferito ? `<span class="chip">🤠 ${esc(p.personaggioPreferito)}</span>` : ''}</div>
      </div></div></section>
      <div style="margin-top:22px">${kpi([
        { v: B.fmt$(p.totale), l: 'Taglia totale' }, { v: p.presenze, l: 'Tornei' }, { v: B.fmt$(p.media), l: 'Media a torneo' },
        { v: p.migliorPos ? p.migliorPos + '°' : '–', l: 'Miglior piazzamento' }, { v: B.fmtN(p.indiceMedio), l: 'Indice piazz. medio', s: '100 = sempre primo' },
        ...(p.nPartite ? [{ v: pct(p.partiteVinte, p.nPartite), l: 'Partite vinte', s: `${p.partiteVinte} su ${p.nPartite}` }, { v: B.fmt$(p.astaMedia), l: 'Spesa media all\'asta' }] : [])
      ])}</div>
      ${s.length > 1 ? `<div class="griglia g2"><section class="carta"><h3>$ per torneo</h3>${graficoLinea(punti, { label: 'Dollari per torneo', fy: v => '$' + B.fmtN(v) })}</section>
        <section class="carta"><h3>Indice di piazzamento</h3>${graficoLinea(puntiPos, { yMin: 0, yMax: 100, ticks: [0, 25, 50, 75, 100], label: 'Indice di piazzamento' })}</section></div>` : ''}
      <div class="griglia g2" style="margin-top:22px">
        <section class="carta"><h2>Storico tornei</h2><div class="tab-wrap"><table class="t"><thead><tr><th>Data</th><th>Torneo</th><th class="num">Pos.</th><th class="num">$</th></tr></thead><tbody>
          ${s.slice().reverse().map(x => `<tr><td>${B.fmtData(x.torneo.data)}</td><td>${lnkT(x.torneo)}</td><td class="num"><span class="pos ${posCls(x.pos)}" style="font-size:15px">${x.pos}°</span><span class="dim mini">/${x.n}</span></td><td class="num">${B.fmt$(x.dollari)}</td></tr>`).join('')}
        </tbody></table></div></section>
        <section class="carta"><h2>Rivali</h2>${riv.length ? `<p class="nota" style="margin-top:-6px">Chi ha incontrato più spesso nei tornei e chi è arrivato davanti.</p><div class="tab-wrap"><table class="t"><thead><tr><th>Avversario</th><th class="num">Tornei insieme</th><th class="num">Bilancio</th></tr></thead><tbody>
          ${riv.map(r => `<tr><td>${lnkG(r.q)}</td><td class="num">${r.c.comuni.length}</td><td class="num"><a href="#/sfida/${p.slug}/${r.q.slug}" title="Confronto">${r.c.aDavanti}–${r.c.bDavanti}</a></td></tr>`).join('')}
          </tbody></table></div>` : '<p class="nota">Ancora nessun avversario in comune.</p>'}
          <p style="margin:12px 0 0"><a class="btn sec pic" href="#/sfida/${p.slug}">Sfida a duello un altro giocatore →</a></p></section>
      </div>
      ${p.nPartite ? `<div class="griglia g2" style="margin-top:22px">
        <section class="carta"><h2>Vittorie per ruolo</h2>${barre(ruoliRighe, { max: 100 })}<p class="nota">Sceriffo ${p.volteSceriffo} ${p.volteSceriffo === 1 ? 'volta' : 'volte'} · ${B.fmt$(p.vinteATavolo)} vinti a tavolo · ${B.fmt$(p.speseAsta)} spesi alle aste</p></section>
        <section class="carta"><h2>Personaggi</h2><div class="tab-wrap"><table class="t"><thead><tr><th>Personaggio</th><th class="num">Partite</th><th class="num">Vinte</th><th class="num">Asta media</th></tr></thead><tbody>
          ${pers.map(([n, c]) => `<tr><td>${esc(n)}</td><td class="num">${c.g}</td><td class="num">${c.v}</td><td class="num">${B.fmt$(c.asta / c.g)}</td></tr>`).join('')}</tbody></table></div></section>
      </div>
      <section class="carta" style="margin-top:22px"><h2>Partite giocate</h2><div class="tab-wrap"><table class="t"><thead><tr><th>Torneo</th><th>Turno</th><th>Ruolo</th><th>Personaggio</th><th>Esito</th><th class="num">Asta</th><th class="num">Vinti</th></tr></thead><tbody>
        ${p.partite.slice().reverse().map(x => `<tr><td>${B.fmtData(x.partita.torneo.data)}</td><td>${esc(x.partita.turno || '')}</td><td>${x.ruolo ? `<span class="ruolo ${x.ruolo}">${B.RUOLI[x.ruolo].nome}</span>` : ''}</td><td>${esc(x.personaggio || '')}</td><td>${x.vinta ? '✔ vinta' : '<span class="dim">persa</span>'}</td><td class="num">${B.fmt$(x.asta)}</td><td class="num">${B.fmt$(x.vincita)}</td></tr>`).join('')}
      </tbody></table></div></section>` : ''}`;
  };

  PAGINE.giocatore.dopo = slug => {
    const btn = $('#cartaGioc'); if (!btn) return;
    let grande = null;
    window.BANG_DB && window.BANG_DB.caricaCarta && window.BANG_DB.caricaCarta(slug).then(img => { if (img) { grande = img; btn.querySelector('img').src = img; } }).catch(() => {});
    btn.onclick = () => {
      const ov = document.createElement('div'); ov.className = 'lightbox';
      ov.innerHTML = `<img src="${grande || btn.querySelector('img').src}" alt=""><span>✕</span>`;
      ov.onclick = () => ov.remove(); document.body.appendChild(ov);
    };
  };

  PAGINE.sfida = (a, b) => {
    const opz = sel => `<option value="">— scegli —</option>${S.giocatori.slice().sort((x, y) => x.nome.localeCompare(y.nome)).map(p => `<option value="${p.slug}" ${p.slug === sel ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}`;
    const A = a && S.trova(a), Bb = b && S.trova(b);
    let corpo = '<p class="nota">Scegli due giocatori per vedere il confronto.</p>';
    if (A && Bb && A !== Bb) {
      const c = B.confronto(S, A, Bb);
      const riga = (l, va, vb, fmt = x => x, piuAlto = true) => { const wa = piuAlto ? va > vb : va < vb, wb = piuAlto ? vb > va : vb < va;
        return `<tr><td class="num" style="${wa ? 'font-weight:700;color:var(--red-d)' : ''}">${fmt(va)}</td><td style="text-align:center;font-family:var(--f-mono);font-size:12.5px;text-transform:uppercase;color:var(--ink-2)">${l}</td><td style="${wb ? 'font-weight:700;color:var(--red-d)' : ''}">${fmt(vb)}</td></tr>`; };
      corpo = `<div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;text-align:center;margin:10px 0 18px">
          <div>${avatar(A, 'avatar-sfida')}<div style="font-family:var(--f-titolo);margin-top:6px">${lnkG(A)}</div></div>
          <div class="cifra-grande">${c.aDavanti} – ${c.bDavanti}</div>
          <div>${avatar(Bb, 'avatar-sfida', 'background:var(--red-d)')}<div style="font-family:var(--f-titolo);margin-top:6px">${lnkG(Bb)}</div></div></div>
        <p class="nota" style="text-align:center;margin-top:-8px">${c.comuni.length ? `Tornei giocati insieme: ${c.comuni.length}. Il punteggio indica quante volte ciascuno è arrivato davanti all'altro.` : 'Non hanno mai giocato lo stesso torneo.'}${c.tavoli.length ? ` Si sono sfidati allo stesso tavolo ${c.tavoli.length} ${c.tavoli.length === 1 ? 'volta' : 'volte'}.` : ''}</p>
        <table class="t" style="max-width:560px;margin:0 auto"><tbody>
          ${riga('Posizione generale', A.rank, Bb.rank, x => x + '°', false)}${riga('Tornei', A.presenze, Bb.presenze)}${riga('Totale', A.totale, Bb.totale, B.fmt$)}
          ${riga('Media', A.media, Bb.media, B.fmt$)}${riga('Vittorie', A.vittorie, Bb.vittorie)}${riga('Podi', A.podi, Bb.podi)}
          ${riga('Miglior pos.', A.migliorPos, Bb.migliorPos, x => x + '°', false)}${riga('Indice piazz.', A.indiceMedio, Bb.indiceMedio, x => B.fmtN(x))}
        </tbody></table>
        ${c.comuni.length ? `<h3 style="margin-top:22px">Testa a testa</h3><div class="tab-wrap"><table class="t"><thead><tr><th>Torneo</th><th class="num">${esc(A.nome)}</th><th class="num">${esc(Bb.nome)}</th></tr></thead><tbody>
          ${c.comuni.map(x => `<tr><td>${B.fmtData(x.torneo.data)} · ${lnkT(x.torneo)}</td><td class="num" style="${x.a.pos < x.b.pos ? 'font-weight:700' : ''}">${x.a.pos}° · ${B.fmt$(x.a.dollari)}</td><td class="num" style="${x.b.pos < x.a.pos ? 'font-weight:700' : ''}">${x.b.pos}° · ${B.fmt$(x.b.dollari)}</td></tr>`).join('')}
        </tbody></table></div>` : ''}`;
    }
    return `<section class="carta chiodi"><h2><span class="kicker">Mezzogiorno di fuoco</span>Sfida a duello</h2>
      <div class="filtri"><select class="sel" id="sfA">${opz(a)}</select><b style="font-family:var(--f-wanted);color:var(--red);font-size:22px">VS</b><select class="sel" id="sfB">${opz(b)}</select></div>${corpo}</section>`;
  };
  PAGINE.sfida.dopo = () => { const go = () => { location.hash = `#/sfida/${$('#sfA').value}/${$('#sfB').value}`; }; $('#sfA').onchange = go; $('#sfB').onchange = go; };

  PAGINE.partite = () => {
    if (!S.partite.length) return `${filtriHtml()}<section class="carta">${vuoto('Le statistiche di gioco compariranno quando saranno inserite le schede delle partite.<br><span class="nota">Ruoli, personaggi, aste, fazioni vincenti, posti a tavolo…</span>')}</section>`;
    const tot = S.partite.length;
    const pers = S.personaggi;
    const caro = pers.slice().sort((a, b) => b.asta / b.g - a.asta / a.g)[0];
    const mezz = S.smazzate[3];
    const conSm = Object.values(S.smazzate).reduce((a, b) => a + b, 0);
    return `${filtriHtml()}
      ${kpi([{ v: tot, l: 'Partite' }, { v: pct(S.perFazione.legge, tot), l: 'Vittorie Legge' }, { v: pct(S.perFazione.fuorilegge, tot), l: 'Vittorie Fuorilegge' }, { v: pct(S.perFazione.rinnegato, tot), l: 'Vittorie Rinnegato' },
        { v: conSm ? pct(mezz, conSm) : '–', l: 'Mezzogiorno di fuoco', s: 'partite arrivate alla 4ª smazzata' }])}
      <section class="carta">${statFazioni()}</section>
      <div class="griglia g2" style="margin-top:22px">
        <section class="carta"><h2>Ruoli</h2>${barre(Object.keys(B.RUOLI).filter(r => S.ruoli[r]).map(r => ({ l: `<span class="ruolo ${r}">${B.RUOLI[r].nome}</span>`, v: S.ruoli[r].v / S.ruoli[r].g * 100, t: `${pct(S.ruoli[r].v, S.ruoli[r].g)} · media ${B.fmt$(S.ruoli[r].d / S.ruoli[r].g)}`, c: COL[r] || COL[B.RUOLI[r].fazione], tip: `${S.ruoli[r].v} vittorie su ${S.ruoli[r].g}` })), { max: 100 })}
          <p class="nota">% di vittoria e $ medi vinti a tavolo per ruolo.</p></section>
        <section class="carta"><h2>Posto a tavolo</h2>${barre(Object.keys(S.posti).sort((a, b) => a - b).map(n => ({ l: `Posto ${n}${n === '1' ? ' (Sceriffo)' : ''}`, v: S.posti[n].v / S.posti[n].g * 100, t: `${pct(S.posti[n].v, S.posti[n].g)} su ${S.posti[n].g}` })), { max: 100 })}
          <p class="nota">Conta qualcosa sedersi subito a sinistra dello Sceriffo?</p></section>
      </div>
      <section class="carta" style="margin-top:22px"><h2>Personaggi</h2>
        ${caro ? `<p class="nota" style="margin-top:-6px">Il più conteso all'asta: <b>${esc(caro.nome)}</b>, pagato in media ${B.fmt$(caro.asta / caro.g)} (record ${B.fmt$(caro.astaMax)}).</p>` : ''}
        <div class="tab-wrap"><table class="t"><thead><tr><th>Personaggio</th><th class="num">Partite</th><th class="num">Vinte</th><th class="num">% vittoria</th><th class="num">Asta media</th><th class="num">Asta max</th><th class="num">$ medi vinti</th></tr></thead><tbody>
        ${pers.map(c => `<tr><td><b>${esc(c.nome)}</b></td><td class="num">${c.g}</td><td class="num">${c.v}</td><td class="num">${pct(c.v, c.g)}<span class="barretta"><i style="width:${c.v / c.g * 100}%"></i></span></td><td class="num">${B.fmt$(c.asta / c.g)}</td><td class="num">${B.fmt$(c.astaMax)}</td><td class="num">${B.fmt$(c.vincita / c.g)}</td></tr>`).join('')}
        </tbody></table></div></section>`;
  };

  PAGINE.regolamento = () => {
    const R = S.R, V = R.vincite;
    const tab = (titolo, righe) => `<div><h3>${titolo}</h3><table class="t"><thead><tr><th>Giocatori al tavolo</th><th class="num">5</th><th class="num">6</th><th class="num">7</th></tr></thead><tbody>
      ${righe.map(([l, o]) => `<tr><td>${l}</td>${[5, 6, 7].map(n => `<td class="num">${o ? B.fmt$(o[n]) : '<span class="dim">$ 0</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    return `<section class="carta chiodi"><h2><span class="kicker">Regolamento da torneo 2026-27 · fase a punteggio</span>Quanto si vince a tavolo</h2>
      <p>Alla Torre Nera il torneo è solo a <b>fase a punteggio</b> (niente finale a duello): la classifica dopo l'ultimo turno è definitiva.</p>
      <div class="griglia g3" style="gap:18px">
        ${tab('Vince la Legge', [['<span class="ruolo sceriffo">Sceriffo</span>', V.legge], ['<span class="ruolo vice">Vice</span>', V.legge], ['<span class="ruolo rinnegato">Rinnegato</span> eliminato per ultimo dallo Sceriffo', V.rinnegatoDuello], ['<span class="ruolo rinnegato">Rinnegato</span> eliminato non per ultimo', null], ['<span class="ruolo fuorilegge">Fuorilegge</span>', null]])}
        ${tab('Vincono i Fuorilegge', [['<span class="ruolo fuorilegge">Fuorilegge</span>', V.fuorilegge], ['Tutti gli altri', null]])}
        ${tab('Vince il Rinnegato', [['<span class="ruolo rinnegato">Rinnegato</span>', V.rinnegato], ['Tutti gli altri', null]])}
      </div></section>
      <div class="griglia g2" style="margin-top:22px">
        <section class="carta"><h2>Turni, dollari iniziali, bonus</h2><table class="t"><thead><tr><th>Partecipanti</th><th class="num">Turni</th><th class="num">$ iniziali</th><th class="num">Bonus primi 4</th></tr></thead><tbody>
          <tr><td>12–14</td><td class="num">3</td><td class="num">$ 300</td><td class="num">$ 75</td></tr><tr><td>15–24</td><td class="num">4</td><td class="num">$ 400</td><td class="num">$ 100</td></tr><tr><td>25 o più</td><td class="num">5</td><td class="num">$ 500</td><td class="num">$ 125</td></tr></tbody></table>
          <p class="nota">Bonus per tornei senza fase a duello: uguale per 1°, 2°, 3° e 4° classificato.</p></section>
        <section class="carta"><h2>Come si calcola il punteggio</h2>
          <p><b>$ iniziali</b> + <b>$ vinti a tavolo</b> − <b>$ spesi alle aste</b> + <b>bonus</b> (se tra i primi 4).</p>
          <p>Ogni turno si apre con l'<b>asta dei personaggi</b>: offerta minima $ 10, rilanci di $ 10; l'ultimo giocatore prende uno dei due rimasti per $ 10.</p>
          <p><b>Mezzogiorno di fuoco</b>: dalla quarta smazzata ogni giocatore perde un punto vita all'inizio del proprio turno.</p>
          <p>A parità di punti vale il <b>sistema Marogi</b> (media dei punteggi degli avversari incontrati), poi il numero di vittorie.</p>
          <p class="nota">Fonte: Regolamento da torneo 2026-27, dV Games. <a href="${esc(S.cfg.linkRegolamento || '#')}" target="_blank" rel="noopener">PDF ufficiale</a> · <a href="${esc(S.cfg.linkScheda || '#')}" target="_blank" rel="noopener">Scheda di gioco</a></p></section>
      </div>`;
  };

  // ---------------- router ----------------
  const NAV = [['home', 'Saloon'], ['classifica', 'Classifica'], ['tornei', 'Tornei'], ['giocatori', 'Giocatori'], ['sfida', 'Sfida'], ['partite', 'Statistiche di gioco'], ['regolamento', 'Regolamento']];
  function render() {
    const parti = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    const pag = PAGINE[parti[0]] ? parti[0] : 'home';
    const att = { torneo: 'tornei', giocatore: 'giocatori' }[pag] || pag;
    $('#nav').innerHTML = NAV.map(([k, l]) => `<a href="#/${k === 'home' ? '' : k}" class="${k === att ? 'on' : ''}">${l}</a>`).join('');
    $('#app').innerHTML = PAGINE[pag](...parti.slice(1));
    if (PAGINE[pag].dopo) PAGINE[pag].dopo(...parti.slice(1));
    document.querySelectorAll('[data-f]').forEach(sel => sel.onchange = () => { filtro[sel.dataset.f] = sel.value; S = B.calcola(DATI, filtro); render(); });
    document.title = (DATI.config.titolo || 'Bang!') + ' · ' + (NAV.find(n => n[0] === att) || ['', ''])[1];
  }
  window.addEventListener('hashchange', () => { render(); scrollTo(0, 0); });

  // dati da Firebase (js/db.js); se Firebase non si carica entro 8 s, ripiego su data/dati.json
  const daJson = () => fetch('data/dati.json?v=' + Date.now()).then(r => r.json());
  const pronto = window.BANG_DB ? Promise.resolve(true) : new Promise(r => { window.addEventListener('bangdb', () => r(true), { once: true }); setTimeout(() => r(false), 8000); });
  pronto.then(ok => ok ? window.BANG_DB.carica().catch(daJson) : daJson()).then(d => {
    DATI = d; MINI = d.miniature || {}; S = B.calcola(DATI, filtro);
    if (d.config && d.config.sottotitolo) $('#tag').textContent = d.config.sottotitolo;
    render();
  }).catch(e => { $('#app').innerHTML = `<section class="carta">${vuoto('Impossibile caricare i dati: ' + esc(e.message))}</section>`; });
})();

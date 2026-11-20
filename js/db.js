/* Bang! alla Torre Nera — accesso ai dati (Firebase Firestore, con ripiego su data/dati.json) */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { initializeFirestore, collection, doc, getDocs, getDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

const CFG = window.FIREBASE_CONFIG;
const attivo = !!(CFG && CFG.apiKey && !/INCOLLA/.test(CFG.apiKey));
let app = null, db = null, auth = null;
if (attivo) {
  app = initializeApp(CFG);
  db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  auth = getAuth(app);
}
const pulito = o => JSON.parse(JSON.stringify(o)); // Firestore non accetta "undefined"

async function caricaJson() {
  const r = await fetch('data/dati.json?v=' + Date.now());
  return r.json();
}

// legge tutto: { config, tornei: [...] }. Se Firestore è vuoto o non configurato usa data/dati.json
async function carica() {
  if (!attivo) return Object.assign(await caricaJson(), { _origine: 'json' });
  const [cfgSnap, tSnap] = await Promise.all([getDoc(doc(db, 'sito', 'config')), getDocs(collection(db, 'tornei'))]);
  if (!cfgSnap.exists() && tSnap.empty) return Object.assign(await caricaJson(), { _origine: 'json', _vuoto: true });
  const tornei = tSnap.docs.map(d => Object.assign({ id: d.id }, d.data()));
  tornei.forEach(t => { t.classifica = t.classifica || []; t.partite = t.partite || []; });
  return { config: cfgSnap.exists() ? cfgSnap.data() : {}, tornei, _origine: 'firestore' };
}

// salva lo stato completo: scrive config e tornei, elimina i tornei tolti
async function salva(dati, idPrecedenti) {
  const b = writeBatch(db);
  b.set(doc(db, 'sito', 'config'), pulito(Object.assign({}, dati.config, { aggiornato: new Date().toISOString() })));
  const ora = new Set();
  dati.tornei.forEach(t => {
    const { id, ...resto } = pulito(t);
    ['stagione', 'n', 'totale', 'media', 'vincitore', 'nTurni', 'iniziali', 'bonus', 'nPartite', 'verifica'].forEach(k => delete resto[k]);
    ora.add(id); b.set(doc(db, 'tornei', id), resto);
  });
  (idPrecedenti || []).filter(id => !ora.has(id)).forEach(id => b.delete(doc(db, 'tornei', id)));
  await b.commit();
}

window.BANG_DB = {
  attivo, carica, salva,
  entra: (email, pw) => signInWithEmailAndPassword(auth, email, pw),
  esci: () => signOut(auth),
  recupera: email => sendPasswordResetEmail(auth, email),
  suCambioUtente: cb => attivo ? onAuthStateChanged(auth, cb) : cb(null)
};
window.dispatchEvent(new Event('bangdb'));

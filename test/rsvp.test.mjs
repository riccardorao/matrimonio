import { leggiRisposta, gestisciRichiesta, costruisciReport, MAX_PERSONE } from '../lib/rsvp.js';

function fakeDb({ fallisci = false } = {}) {
  const risposte = new Map(); const ospiti = [];
  const lazy = (run) => ({ run, then(a, b) { return run().then(a, b); } });
  const sql = (strings, ...v) => {
    const q = strings.join('?').replace(/\s+/g, ' ');
    return lazy(async () => {
      if (fallisci) throw new Error('db giù');
      if (q.startsWith('CREATE')) return [];
      if (q.startsWith('INSERT INTO rsvp_risposte')) {
        const [id, presenza, rispondente, persone] = v;
        const esisteva = risposte.has(id);
        risposte.set(id, { id, presenza, rispondente, persone, creata: risposte.get(id)?.creata ?? new Date(), aggiornata: new Date() });
        return [{ nuova: !esisteva }];
      }
      if (q.startsWith('DELETE FROM rsvp_ospiti')) {
        for (let i = ospiti.length - 1; i >= 0; i--) if (ospiti[i].risposta_id === v[0]) ospiti.splice(i, 1);
        return [];
      }
      if (q.startsWith('INSERT INTO rsvp_ospiti')) {
        const [risposta_id, posizione, nome, eta, allergie] = v;
        ospiti.push({ risposta_id, posizione, nome, eta, allergie });
        return [];
      }
      if (q.startsWith('SELECT id, presenza')) return [...risposte.values()];
      if (q.startsWith('SELECT risposta_id')) return [...ospiti];
      throw new Error('query non prevista: ' + q);
    });
  };
  sql.transaction = async (qs) => { const out = []; for (const q of qs) out.push(await q); return out; };
  return { sql, risposte, ospiti };
}

let fallimenti = 0;
const ok = (cond, msg) => { console.log((cond ? 'OK   ' : 'FAIL ') + msg); if (!cond) fallimenti++; };

ok(leggiRisposta(null).errore, 'corpo vuoto respinto');
ok(leggiRisposta({ presenza: 'no', rispondente: 'A' }).errore, 'no con nome troppo corto respinto');
ok(leggiRisposta({ presenza: 'si', ospiti: [] }).errore, 'sì senza ospiti respinto');
ok(leggiRisposta({ presenza: 'si', ospiti: Array(MAX_PERSONE + 1).fill({ nome: 'Ab', eta: '12+' }) }).errore, 'più di 10 persone respinto');
ok(leggiRisposta({ presenza: 'si', ospiti: [{ nome: 'Ab', eta: '18+' }] }).errore, 'fascia d\'età fuori elenco respinta');
ok(leggiRisposta({ presenza: 'si', ospiti: [{ nome: 'Ab' }] }).errore, 'età mancante respinta');
ok(leggiRisposta({ presenza: 'si', web: 'spam', ospiti: [{ nome: 'Ab', eta: '12+' }] }).trappola, 'trappola compilata riconosciuta');
const v = leggiRisposta({ presenza: 'si', ospiti: [{ nome: '  Anna Rossi ', eta: '4-11', allergie: ' noci ' }, { nome: 'Luca Rossi', eta: '12+' }] });
ok(v.dati && v.dati.ospiti[0].nome === 'Anna Rossi' && v.dati.ospiti[0].allergie === 'noci' && v.dati.rispondente === 'Anna Rossi', 'nomi e allergie puliti, rispondente = primo ospite');
ok(leggiRisposta({ presenza: 'si', id: 'non-un-uuid', ospiti: [{ nome: 'Ab', eta: '12+' }] }).dati.id === null, 'id non valido scartato');

const db = fakeDb();
const inviate = [];
const finto = async (url, opt) => { inviate.push({ url, body: JSON.parse(opt.body) }); return { ok: true, status: 200, text: async () => '' }; };
const env = { RESEND_API_KEY: 'k', RSVP_FROM: 'RSVP <rsvp@ambrogioefrancesca.it>' };
const r1 = await gestisciRichiesta({ metodo: 'POST', sql: db.sql, fetch: finto, env, corpo: {
  presenza: 'si', ospiti: [{ nome: 'Anna <b>Rossi</b>', eta: '4-11', allergie: 'noci' }, { nome: 'Luca Rossi', eta: '12+', allergie: '' }] } });
ok(r1.status === 200 && r1.corpo.ok && r1.corpo.id && r1.corpo.nuova === true && r1.corpo.mail === 'inviata', 'prima risposta salvata e mail inviata');
ok(db.risposte.size === 1 && db.ospiti.length === 2, 'una risposta e due ospiti nel database');
const mail1 = inviate[0].body;
ok(inviate[0].url === 'https://api.resend.com/emails' && mail1.to.length === 2, 'mail a Ambrogio e Francesca');
ok(mail1.subject.includes('ha risposto') && mail1.subject.includes('totale 2'), 'oggetto: nuova risposta, totale 2');
ok(!mail1.html.includes('<b>Rossi</b>') && mail1.html.includes('&lt;b&gt;Rossi&lt;/b&gt;'), 'nomi escapati nell\'HTML della mail');

const id = r1.corpo.id;
const r2 = await gestisciRichiesta({ metodo: 'POST', sql: db.sql, fetch: finto, env, corpo: {
  id, presenza: 'si', ospiti: [{ nome: 'Anna Rossi', eta: '4-11' }, { nome: 'Luca Rossi', eta: '12+' }, { nome: 'Marta Rossi', eta: '0-3', allergie: 'latte' }] } });
ok(r2.corpo.id === id && r2.corpo.nuova === false, 'con lo stesso id si aggiorna, non si crea');
ok(db.risposte.size === 1 && db.ospiti.length === 3, 'dopo la modifica: 1 risposta, 3 ospiti (nessun doppione)');
ok(inviate[1].body.subject.includes('ha modificato') && inviate[1].body.subject.includes('totale 3'), 'mail di modifica: ha modificato, totale 3');
ok(inviate[1].body.text.includes('0–3: 1') && inviate[1].body.text.includes('4–11: 1') && inviate[1].body.text.includes('12+: 1'), 'conteggio per fasce nel testo');
ok(inviate[1].body.html.includes('latte'), 'allergie nel report');

const r3 = await gestisciRichiesta({ metodo: 'POST', sql: db.sql, fetch: finto, env, corpo: { presenza: 'no', rispondente: 'Paolo Bianchi' } });
ok(r3.corpo.ok && db.risposte.size === 2, 'un no crea una seconda risposta');
ok(inviate[2].body.subject.includes('non viene'), 'oggetto del no');
ok(inviate[2].body.text.includes('Paolo Bianchi: non viene'), 'report: il no compare');

const senzaMail = await gestisciRichiesta({ metodo: 'POST', sql: db.sql, fetch: finto, env: {}, corpo: { presenza: 'no', rispondente: 'Carla Verdi' } });
ok(senzaMail.corpo.ok && senzaMail.corpo.mail === 'non configurata' && db.risposte.size === 3, 'senza chiavi: salvato, mail non configurata');
const mailKo = async () => ({ ok: false, status: 500, text: async () => 'errore' });
const conErrore = await gestisciRichiesta({ metodo: 'POST', sql: db.sql, fetch: mailKo, env, corpo: { presenza: 'no', rispondente: 'Dario Neri' } });
ok(conErrore.corpo.ok && conErrore.corpo.mail === 'errore', 'mail in errore: risposta comunque salvata e ok');

const trap = await gestisciRichiesta({ metodo: 'POST', sql: db.sql, fetch: finto, env, corpo: { presenza: 'no', rispondente: 'Bot Bot', web: 'x' } });
ok(trap.status === 200 && db.risposte.size === 4, 'trappola: finge ok, non salva');
const giu = fakeDb({ fallisci: true });
const dbKo = await gestisciRichiesta({ metodo: 'POST', sql: giu.sql, fetch: finto, env, corpo: { presenza: 'no', rispondente: 'Eva Gialli' } });
ok(dbKo.status === 500 && !dbKo.corpo.ok, 'database giù: 500 con messaggio');
const get = await gestisciRichiesta({ metodo: 'GET', sql: db.sql, corpo: {} });
ok(get.status === 405, 'GET respinto');

const rep = costruisciReport([
  { rispondente: 'A', presenza: 'si', persone: 2, creata: new Date(), ospiti: [{ nome: 'A1', eta: '0-3', allergie: '' }, { nome: 'A2', eta: '4-11', allergie: 'uova' }] },
  { rispondente: 'B', presenza: 'no', persone: 0, creata: new Date(), ospiti: [] }
], { rispondente: 'A', presenza: 'si', persone: 2, nuova: true });
ok(rep.testo.includes('Persone confermate: 2 (0–3: 1, 4–11: 1, 12+: 0)'), 'totali: 2 persone, fasce corrette');
ok(rep.testo.includes('Risposte: 1 sì, 1 no'), 'totali: risposte sì/no');

console.log(fallimenti ? `\n${fallimenti} FALLITI` : '\nTUTTI I TEST PASSANO');
process.exit(fallimenti ? 1 : 0);

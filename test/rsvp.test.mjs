import { leggiRisposta, gestisciRichiesta, costruisciReport, creaDb, MAX_PERSONE } from '../lib/rsvp.js';

// Un finto database che si comporta come le funzioni SQL rsvp_salva / rsvp_report.
function fakeDb({ fallisci = false } = {}) {
  const risposte = new Map();
  const db = {
    async salva(d) {
      if (fallisci) throw new Error('db giù');
      const id = d.id || crypto.randomUUID();
      const prima = risposte.get(id);
      risposte.set(id, {
        id, presenza: d.presenza, rispondente: d.rispondente, ospiti: d.ospiti,
        persone: d.ospiti.length, versione: (prima?.versione ?? 0) + 1,
        creata: prima?.creata ?? new Date(), aggiornata: new Date()
      });
      return { id, nuova: !prima, persone: d.ospiti.length, versione: risposte.get(id).versione };
    },
    async report() {
      const tutte = [...risposte.values()];
      const ospiti = tutte.flatMap((r) => r.ospiti);
      const n = (eta) => ospiti.filter((o) => o.eta === eta).length;
      return {
        totali: {
          risposte: tutte.length,
          risposte_si: tutte.filter((r) => r.presenza === 'si').length,
          risposte_no: tutte.filter((r) => r.presenza === 'no').length,
          persone: ospiti.length, fascia_0_3: n('0-3'), fascia_4_11: n('4-11'), fascia_12_piu: n('12+'),
          con_allergie: ospiti.filter((o) => o.allergie).length
        },
        risposte: tutte, duplicati: [], storico: []
      };
    }
  };
  return { db, risposte };
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
const r1 = await gestisciRichiesta({ metodo: 'POST', db: db.db, fetch: finto, env, corpo: {
  presenza: 'si', ospiti: [{ nome: 'Anna <b>Rossi</b>', eta: '4-11', allergie: 'noci' }, { nome: 'Luca Rossi', eta: '12+', allergie: '' }] } });
ok(r1.status === 200 && r1.corpo.ok && r1.corpo.id && r1.corpo.nuova === true && r1.corpo.mail === 'inviata', 'prima risposta salvata e mail inviata');
ok(db.risposte.size === 1 && [...db.risposte.values()][0].ospiti.length === 2, 'una risposta e due ospiti nel database');
const mail1 = inviate[0].body;
ok(inviate[0].url === 'https://api.resend.com/emails' && mail1.to.length === 2, 'mail a Ambrogio e Francesca');
ok(mail1.subject.includes('ha risposto') && mail1.subject.includes('totale 2'), 'oggetto: nuova risposta, totale 2');
ok(!mail1.html.includes('<b>Rossi</b>') && mail1.html.includes('&lt;b&gt;Rossi&lt;/b&gt;'), 'nomi escapati nell\'HTML della mail');

const id = r1.corpo.id;
const r2 = await gestisciRichiesta({ metodo: 'POST', db: db.db, fetch: finto, env, corpo: {
  id, presenza: 'si', ospiti: [{ nome: 'Anna Rossi', eta: '4-11' }, { nome: 'Luca Rossi', eta: '12+' }, { nome: 'Marta Rossi', eta: '0-3', allergie: 'latte' }] } });
ok(r2.corpo.id === id && r2.corpo.nuova === false, 'con lo stesso id si aggiorna, non si crea');
ok(db.risposte.size === 1 && [...db.risposte.values()][0].ospiti.length === 3 && r2.corpo.versione === 2, 'dopo la modifica: 1 risposta, 3 ospiti, versione 2');
ok(inviate[1].body.subject.includes('ha modificato') && inviate[1].body.subject.includes('totale 3'), 'mail di modifica: ha modificato, totale 3');
ok(inviate[1].body.text.includes('0–3: 1') && inviate[1].body.text.includes('4–11: 1') && inviate[1].body.text.includes('12+: 1'), 'conteggio per fasce nel testo');
ok(inviate[1].body.html.includes('latte'), 'allergie nel report');

const r3 = await gestisciRichiesta({ metodo: 'POST', db: db.db, fetch: finto, env, corpo: { presenza: 'no', rispondente: 'Paolo Bianchi' } });
ok(r3.corpo.ok && db.risposte.size === 2, 'un no crea una seconda risposta');
ok(inviate[2].body.subject.includes('non viene'), 'oggetto del no');
ok(inviate[2].body.text.includes('Paolo Bianchi: non viene'), 'report: il no compare');

const senzaMail = await gestisciRichiesta({ metodo: 'POST', db: db.db, fetch: finto, env: {}, corpo: { presenza: 'no', rispondente: 'Carla Verdi' } });
ok(senzaMail.corpo.ok && senzaMail.corpo.mail === 'non configurata' && db.risposte.size === 3, 'senza chiavi: salvato, mail non configurata');
const mailKo = async () => ({ ok: false, status: 500, text: async () => 'errore' });
const conErrore = await gestisciRichiesta({ metodo: 'POST', db: db.db, fetch: mailKo, env, corpo: { presenza: 'no', rispondente: 'Dario Neri' } });
ok(conErrore.corpo.ok && conErrore.corpo.mail === 'errore', 'mail in errore: risposta comunque salvata e ok');

const trap = await gestisciRichiesta({ metodo: 'POST', db: db.db, fetch: finto, env, corpo: { presenza: 'no', rispondente: 'Bot Bot', web: 'x' } });
ok(trap.status === 200 && db.risposte.size === 4, 'trappola: finge ok, non salva');
const giu = fakeDb({ fallisci: true });
const dbKo = await gestisciRichiesta({ metodo: 'POST', db: giu.db, fetch: finto, env, corpo: { presenza: 'no', rispondente: 'Eva Gialli' } });
ok(dbKo.status === 500 && !dbKo.corpo.ok, 'database giù: 500 con messaggio');
const get = await gestisciRichiesta({ metodo: 'GET', db: db.db, corpo: {} });
ok(get.status === 405, 'GET respinto');

const rep = costruisciReport({
  totali: { risposte: 2, risposte_si: 1, risposte_no: 1, persone: 2, fascia_0_3: 1, fascia_4_11: 1, fascia_12_piu: 0, con_allergie: 1 },
  risposte: [
    { rispondente: 'A', presenza: 'si', persone: 2, ospiti: [{ nome: 'A1', eta: '0-3', allergie: '' }, { nome: 'A2', eta: '4-11', allergie: 'uova' }] },
    { rispondente: 'B', presenza: 'no', persone: 0, ospiti: [] }
  ],
  duplicati: [{ nome: 'a', risposte: 2 }]
}, { rispondente: 'A', presenza: 'si', persone: 2, nuova: true });
ok(rep.testo.includes('Persone confermate: 2 (0–3: 1, 4–11: 1, 12+: 0)'), 'totali: 2 persone, fasce corrette');
ok(rep.testo.includes('Risposte: 1 sì, 1 no'), 'totali: risposte sì/no');
ok(rep.testo.includes('stesso nome in più risposte') && rep.html.includes('Attenzione'), 'duplicati segnalati nel report');

// creaDb: parla con le funzioni SQL di Supabase come previsto
const chiamate = [];
const finta = (esito) => async (url, opt) => { chiamate.push({ url, opt, body: JSON.parse(opt.body) }); return esito; };
const bene = { ok: true, status: 200, json: async () => ({ id: 'x', nuova: true, persone: 1, versione: 1 }), text: async () => '' };
const dbVero = creaDb({ fetch: finta(bene), url: 'https://prog.supabase.co/', chiave: 'sb_publishable_x', token: 'segreto' });
await dbVero.salva({ id: null, presenza: 'si', rispondente: 'Ab', ospiti: [{ nome: 'Ab', eta: '12+', allergie: '' }] });
ok(chiamate[0].url === 'https://prog.supabase.co/rest/v1/rpc/rsvp_salva', 'salva chiama /rest/v1/rpc/rsvp_salva');
ok(chiamate[0].opt.headers.apikey === 'sb_publishable_x' && !chiamate[0].opt.headers.Authorization, 'solo apikey, nessun Authorization');
ok(chiamate[0].body.p_token === 'segreto' && chiamate[0].body.p_presenza === 'si' && chiamate[0].body.p_id === null, 'parametri: token, presenza, id');
await dbVero.report();
ok(chiamate[1].url.endsWith('/rpc/rsvp_report') && chiamate[1].body.p_token === 'segreto', 'report chiama rsvp_report con il token');
const male = creaDb({ fetch: finta({ ok: false, status: 400, text: async () => '{"code":"28000","message":"non autorizzato"}' }), url: 'https://p.supabase.co', chiave: 'k', token: 'no' });
let errore = null; try { await male.report(); } catch (e) { errore = e; }
ok(errore && /28000/.test(errore.message), 'errore di Supabase propagato');

// api/report: 401 con chiave sbagliata, 200 con chiave giusta, niente chiave = 401
process.env.SUPABASE_URL = 'https://p.supabase.co'; process.env.SUPABASE_PUBLISHABLE_KEY = 'k';
const risposta = () => { const r = { headers: {} }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.status = (c) => { r.code = c; return r; }; r.json = (o) => { r.corpo = o; return r; }; return r; };
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opt) => JSON.parse(opt.body).p_token === 'giusta'
  ? { ok: true, status: 200, json: async () => ({ totali: { persone: 0 }, risposte: [], duplicati: [], storico: [] }), text: async () => '' }
  : { ok: false, status: 400, text: async () => '{"code":"28000","message":"non autorizzato"}' };
const { default: apiReport } = await import('../api/report.js');
let q = risposta(); await apiReport({ method: 'GET', headers: {} }, q);
ok(q.code === 401, 'report senza chiave: 401');
q = risposta(); await apiReport({ method: 'GET', headers: { authorization: 'Bearer sbagliata' } }, q);
ok(q.code === 401, 'report con chiave sbagliata: 401');
q = risposta(); await apiReport({ method: 'GET', headers: { authorization: 'Bearer giusta' } }, q);
ok(q.code === 200 && q.corpo.ok && q.headers['Cache-Control'] === 'no-store', 'report con chiave giusta: 200, no-store');
q = risposta(); await apiReport({ method: 'POST', headers: {} }, q);
ok(q.code === 405, 'report: POST respinto');
globalThis.fetch = realFetch;

console.log(fallimenti ? `\n${fallimenti} FALLITI` : '\nTUTTI I TEST PASSANO');
process.exit(fallimenti ? 1 : 0);

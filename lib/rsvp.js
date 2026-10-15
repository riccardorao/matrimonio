/* ============================================================
   RSVP — controllo dei dati, database (Supabase), report via mail.

   Non sa nulla di Vercel: riceve dall'esterno il database (`db`), la funzione
   `fetch` e le variabili d'ambiente. Così si prova anche in locale.
   ============================================================ */

export const FASCE = ['0-3', '4-11', '12+'];
export const MAX_PERSONE = 10;

const DESTINATARI = ['ambrogiosilecchia@gmail.com', 'm.francesca18@gmail.com'];

const testo = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Controlla il corpo della richiesta. Restituisce { dati } oppure { errore }.
// Il campo "web" è una trappola per i robot: se è pieno, { trappola: true }.
export function leggiRisposta(corpo) {
  if (!corpo || typeof corpo !== 'object') return { errore: 'Dati non validi.' };
  if (testo(corpo.web, 200)) return { trappola: true };
  const id = typeof corpo.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(corpo.id)
    ? corpo.id.toLowerCase()
    : null;

  if (corpo.presenza === 'no') {
    const nome = testo(corpo.rispondente, 120);
    if (nome.length < 2) return { errore: 'Scrivete nome e cognome.' };
    return { dati: { id, presenza: 'no', rispondente: nome, ospiti: [] } };
  }
  if (corpo.presenza !== 'si') return { errore: 'Indicate se venite.' };

  const ospiti = Array.isArray(corpo.ospiti) ? corpo.ospiti : [];
  if (ospiti.length < 1 || ospiti.length > MAX_PERSONE) {
    return { errore: `Indicate da 1 a ${MAX_PERSONE} persone.` };
  }
  const puliti = [];
  for (let i = 0; i < ospiti.length; i++) {
    const o = ospiti[i] || {};
    const nome = testo(o.nome, 120);
    if (nome.length < 2) return { errore: `Manca il nome della persona ${i + 1}.` };
    if (!FASCE.includes(o.eta)) return { errore: `Manca la fascia d'età della persona ${i + 1}.` };
    puliti.push({ nome, eta: o.eta, allergie: testo(o.allergie, 500) });
  }
  return { dati: { id, presenza: 'si', rispondente: puliti[0].nome, ospiti: puliti } };
}

// Il database è Supabase (Postgres). Si parla con due funzioni SQL protette da
// una chiave segreta (vedi supabase/schema.sql): rsvp_salva e rsvp_report.
// Le tabelle non sono raggiungibili da fuori; la chiave "publishable" serve solo
// a farsi aprire la porta da Supabase, non dà nessun permesso sui dati.
export function creaDb({ fetch: f = fetch, url, chiave, token }) {
  const chiama = async (funzione, argomenti) => {
    const r = await f(`${url.replace(/\/$/, '')}/rest/v1/rpc/${funzione}`, {
      method: 'POST',
      headers: { apikey: chiave, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, ...argomenti })
    });
    if (!r.ok) {
      const errore = new Error(`Supabase ${funzione}: ${r.status} ${(await r.text()).slice(0, 200)}`);
      errore.status = r.status;
      throw errore;
    }
    return r.json();
  };
  return {
    // Salva o aggiorna una risposta. Restituisce { id, nuova, persone, versione }.
    salva: (d) => chiama('rsvp_salva', {
      p_id: d.id,
      p_presenza: d.presenza,
      p_rispondente: d.rispondente,
      p_ospiti: d.ospiti
    }),
    // Totali, risposte, duplicati e ultime modifiche, calcolati sui dati veri.
    report: () => chiama('rsvp_report', {})
  };
}

const scappa = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const fasciaNome = { '0-3': '0–3 anni', '4-11': '4–11 anni', '12+': '12 anni o più' };

// Il report: totali in cima, poi una riga per risposta. Parte dal report del
// database (rsvp_report), quindi i numeri sono sempre quelli delle righe vere.
// `ultima` dice cosa è appena cambiato, per l'oggetto della mail.
export function costruisciReport(dati, ultima, adesso = new Date()) {
  const { totali, risposte, duplicati = [] } = dati;
  const quando = adesso.toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' });
  const allergie = risposte.flatMap((r) => r.ospiti.filter((o) => o.allergie).map((o) => ({ nome: o.nome, allergie: o.allergie })));

  const oggetto = ultima.presenza === 'si'
    ? `RSVP: ${ultima.rispondente} ${ultima.nuova ? 'ha risposto' : 'ha modificato'}, ${ultima.persone} ${ultima.persone === 1 ? 'persona' : 'persone'} · totale ${totali.persone}`
    : `RSVP: ${ultima.rispondente} ${ultima.nuova ? 'ha risposto' : 'ha modificato'}: non viene · totale ${totali.persone} confermati`;

  const righe = risposte.map((r) => {
    const dettaglio = r.presenza === 'no'
      ? '<em>non viene</em>'
      : r.ospiti.map((o) => `${scappa(o.nome)} (${fasciaNome[o.eta] || scappa(o.eta)}${o.allergie ? ', allergie: ' + scappa(o.allergie) : ''})`).join('<br>');
    return `<tr><td>${scappa(r.rispondente)}</td><td>${r.presenza === 'si' ? 'sì' : 'no'}</td><td style="text-align:center">${r.persone}</td><td>${dettaglio}</td></tr>`;
  }).join('');

  const avvisoDuplicati = duplicati.length
    ? `<p style="color:#9A4A12"><strong>Attenzione:</strong> stesso nome in più risposte: ${duplicati.map((d) => `${scappa(d.nome)} (${d.risposte})`).join(', ')}.</p>`
    : '';

  const html = `<!doctype html><html lang="it"><body style="font-family:Arial,sans-serif;color:#2F2A23;line-height:1.5">
<h2 style="font-family:Georgia,serif;font-weight:normal">Report RSVP · matrimonio 24 aprile 2027</h2>
<p style="color:#6B6255">Aggiornato alle ${scappa(quando)}. Ultima modifica: <strong>${scappa(ultima.rispondente)}</strong>.</p>
<ul>
<li>Risposte: <strong>${totali.risposte_si}</strong> sì, <strong>${totali.risposte_no}</strong> no</li>
<li>Persone confermate: <strong>${totali.persone}</strong> (0–3 anni: ${totali.fascia_0_3}, 4–11 anni: ${totali.fascia_4_11}, 12 anni o più: ${totali.fascia_12_piu})</li>
<li>Allergie o intolleranze: ${allergie.length ? allergie.map((o) => `${scappa(o.nome)}: ${scappa(o.allergie)}`).join('; ') : 'nessuna segnalata'}</li>
</ul>
${avvisoDuplicati}
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;border:1px solid #D9CDB9">
<tr style="background:#EAE1D2;text-align:left"><th>Chi risponde</th><th>Viene</th><th>Persone</th><th>Ospiti</th></tr>
${righe || '<tr><td colspan="4">Ancora nessuna risposta.</td></tr>'}
</table>
</body></html>`;

  const testoSemplice = [
    `Report RSVP · matrimonio 24 aprile 2027 (aggiornato alle ${quando})`,
    `Ultima modifica: ${ultima.rispondente}`,
    `Risposte: ${totali.risposte_si} sì, ${totali.risposte_no} no`,
    `Persone confermate: ${totali.persone} (0–3: ${totali.fascia_0_3}, 4–11: ${totali.fascia_4_11}, 12+: ${totali.fascia_12_piu})`,
    ...(duplicati.length ? [`Attenzione, stesso nome in più risposte: ${duplicati.map((d) => `${d.nome} (${d.risposte})`).join(', ')}`] : []),
    '',
    ...risposte.map((r) => r.presenza === 'no'
      ? `- ${r.rispondente}: non viene`
      : `- ${r.rispondente} (${r.persone}): ` + r.ospiti.map((o) => `${o.nome} [${fasciaNome[o.eta] || o.eta}]${o.allergie ? ' allergie: ' + o.allergie : ''}`).join('; '))
  ].join('\n');

  return { oggetto, html, testo: testoSemplice };
}

// Manda il report con Resend (https://resend.com). Lancia un errore se non va.
export async function inviaReport({ fetch: f, apiKey, da, a = DESTINATARI, oggetto, html, testo }) {
  const r = await f('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: da, to: a, subject: oggetto, html, text: testo })
  });
  if (!r.ok) throw new Error(`Invio mail: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

// Il cuore della funzione: controlla, salva, manda il report.
// Restituisce { status, corpo } da mandare al browser.
export async function gestisciRichiesta({ metodo, corpo, db, fetch: f = fetch, env = {}, adesso }) {
  if (metodo !== 'POST') return { status: 405, corpo: { ok: false, errore: 'Metodo non consentito.' } };
  const letta = leggiRisposta(corpo);
  if (letta.trappola) return { status: 200, corpo: { ok: true } };
  if (letta.errore) return { status: 400, corpo: { ok: false, errore: letta.errore } };

  let salvata;
  try {
    salvata = await db.salva(letta.dati);
  } catch (e) {
    console.error('RSVP: salvataggio non riuscito', e);
    return { status: 500, corpo: { ok: false, errore: 'Non siamo riusciti a salvare la risposta. Riprovate tra poco, oppure scriveteci.' } };
  }

  let mail = 'non configurata';
  if (env.RESEND_API_KEY && env.RSVP_FROM) {
    try {
      const ultima = {
        rispondente: letta.dati.rispondente,
        presenza: letta.dati.presenza,
        persone: salvata.persone,
        nuova: salvata.nuova
      };
      const report = costruisciReport(await db.report(), ultima, adesso);
      await inviaReport({
        fetch: f,
        apiKey: env.RESEND_API_KEY,
        da: env.RSVP_FROM,
        a: env.RSVP_TO ? env.RSVP_TO.split(',').map((s) => s.trim()).filter(Boolean) : DESTINATARI,
        ...report
      });
      mail = 'inviata';
    } catch (e) {
      console.error('RSVP: report non inviato', e);
      mail = 'errore';
    }
  } else {
    console.warn('RSVP: RESEND_API_KEY o RSVP_FROM non impostate: nessuna mail inviata (il report resta consultabile su /admin)');
  }

  return { status: 200, corpo: { ok: true, id: salvata.id, nuova: salvata.nuova, versione: salvata.versione, mail } };
}

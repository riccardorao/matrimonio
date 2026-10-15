/* ============================================================
   RSVP — controllo dei dati, database, report via mail.

   Non sa nulla di Vercel: riceve dall'esterno il client del database (`sql`),
   la funzione `fetch` e le variabili d'ambiente. Così si prova anche in locale.

   Tabelle:
     rsvp_risposte  una riga per famiglia/persona che risponde
     rsvp_ospiti    una riga per ospite (solo per chi viene)
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

// Crea le tabelle se non ci sono. Una volta per avvio della funzione.
export function creaTabelle(sql) {
  return sql.transaction([
    sql`CREATE TABLE IF NOT EXISTS rsvp_risposte (
      id uuid PRIMARY KEY,
      presenza text NOT NULL CHECK (presenza IN ('si', 'no')),
      rispondente text NOT NULL,
      persone integer NOT NULL DEFAULT 0,
      creata timestamptz NOT NULL DEFAULT now(),
      aggiornata timestamptz NOT NULL DEFAULT now()
    )`,
    sql`CREATE TABLE IF NOT EXISTS rsvp_ospiti (
      id bigserial PRIMARY KEY,
      risposta_id uuid NOT NULL REFERENCES rsvp_risposte(id) ON DELETE CASCADE,
      posizione integer NOT NULL,
      nome text NOT NULL,
      eta text NOT NULL CHECK (eta IN ('0-3', '4-11', '12+')),
      allergie text NOT NULL DEFAULT ''
    )`
  ]);
}

// Salva o aggiorna una risposta in un'unica transazione.
// Restituisce { id, nuova }: nuova è false se si è modificata una risposta esistente.
export async function salvaRisposta(sql, dati) {
  const id = dati.id || crypto.randomUUID();
  const persone = dati.presenza === 'si' ? dati.ospiti.length : 0;
  const [[esito]] = await sql.transaction([
    sql`INSERT INTO rsvp_risposte (id, presenza, rispondente, persone)
        VALUES (${id}, ${dati.presenza}, ${dati.rispondente}, ${persone})
        ON CONFLICT (id) DO UPDATE SET
          presenza = EXCLUDED.presenza,
          rispondente = EXCLUDED.rispondente,
          persone = EXCLUDED.persone,
          aggiornata = now()
        RETURNING (xmax = 0) AS nuova`,
    sql`DELETE FROM rsvp_ospiti WHERE risposta_id = ${id}`,
    ...dati.ospiti.map((o, i) => sql`INSERT INTO rsvp_ospiti (risposta_id, posizione, nome, eta, allergie)
        VALUES (${id}, ${i + 1}, ${o.nome}, ${o.eta}, ${o.allergie})`)
  ]);
  return { id, nuova: Boolean(esito && esito.nuova) };
}

// Tutte le risposte, con i loro ospiti.
export async function leggiTutte(sql) {
  const risposte = await sql`SELECT id, presenza, rispondente, persone, creata, aggiornata
                             FROM rsvp_risposte ORDER BY creata`;
  const ospiti = await sql`SELECT risposta_id, posizione, nome, eta, allergie
                           FROM rsvp_ospiti ORDER BY risposta_id, posizione`;
  return risposte.map((r) => ({
    ...r,
    ospiti: ospiti.filter((o) => o.risposta_id === r.id)
  }));
}

const scappa = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const fasciaNome = { '0-3': '0–3 anni', '4-11': '4–11 anni', '12+': '12 anni o più' };

// Il report: totali in cima, poi una riga per risposta.
// `ultima` dice cosa è appena cambiato, per l'oggetto della mail.
export function costruisciReport(risposte, ultima, adesso = new Date()) {
  const vengono = risposte.filter((r) => r.presenza === 'si');
  const nonVengono = risposte.filter((r) => r.presenza === 'no');
  const ospiti = vengono.flatMap((r) => r.ospiti);
  const fasce = { '0-3': 0, '4-11': 0, '12+': 0 };
  ospiti.forEach((o) => { fasce[o.eta] = (fasce[o.eta] || 0) + 1; });
  const conAllergie = ospiti.filter((o) => o.allergie);
  const quando = adesso.toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' });

  const oggetto = ultima.presenza === 'si'
    ? `RSVP: ${ultima.rispondente} ${ultima.nuova ? 'ha risposto' : 'ha modificato'}, ${ultima.persone} ${ultima.persone === 1 ? 'persona' : 'persone'} · totale ${ospiti.length}`
    : `RSVP: ${ultima.rispondente} ${ultima.nuova ? 'ha risposto' : 'ha modificato'}: non viene · totale ${ospiti.length} confermati`;

  const righe = risposte.map((r) => {
    const dettaglio = r.presenza === 'no'
      ? '<em>non viene</em>'
      : r.ospiti.map((o) => `${scappa(o.nome)} (${fasciaNome[o.eta] || scappa(o.eta)}${o.allergie ? ', allergie: ' + scappa(o.allergie) : ''})`).join('<br>');
    return `<tr><td>${scappa(r.rispondente)}</td><td>${r.presenza === 'si' ? 'sì' : 'no'}</td><td style="text-align:center">${r.presenza === 'si' ? r.persone : 0}</td><td>${dettaglio}</td></tr>`;
  }).join('');

  const html = `<!doctype html><html lang="it"><body style="font-family:Arial,sans-serif;color:#2F2A23;line-height:1.5">
<h2 style="font-family:Georgia,serif;font-weight:normal">Report RSVP · matrimonio 24 aprile 2027</h2>
<p style="color:#6B6255">Aggiornato alle ${scappa(quando)}. Ultima modifica: <strong>${scappa(ultima.rispondente)}</strong>.</p>
<ul>
<li>Risposte: <strong>${vengono.length}</strong> sì, <strong>${nonVengono.length}</strong> no</li>
<li>Persone confermate: <strong>${ospiti.length}</strong> (0–3 anni: ${fasce['0-3']}, 4–11 anni: ${fasce['4-11']}, 12 anni o più: ${fasce['12+']})</li>
<li>Allergie o intolleranze: ${conAllergie.length ? conAllergie.map((o) => `${scappa(o.nome)}: ${scappa(o.allergie)}`).join('; ') : 'nessuna segnalata'}</li>
</ul>
<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;border:1px solid #D9CDB9">
<tr style="background:#EAE1D2;text-align:left"><th>Chi risponde</th><th>Viene</th><th>Persone</th><th>Ospiti</th></tr>
${righe || '<tr><td colspan="4">Ancora nessuna risposta.</td></tr>'}
</table>
</body></html>`;

  const testoSemplice = [
    `Report RSVP · matrimonio 24 aprile 2027 (aggiornato alle ${quando})`,
    `Ultima modifica: ${ultima.rispondente}`,
    `Risposte: ${vengono.length} sì, ${nonVengono.length} no`,
    `Persone confermate: ${ospiti.length} (0–3: ${fasce['0-3']}, 4–11: ${fasce['4-11']}, 12+: ${fasce['12+']})`,
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

let tabelleCreate = null;

// Il cuore della funzione: controlla, salva, manda il report.
// Restituisce { status, corpo } da mandare al browser.
export async function gestisciRichiesta({ metodo, corpo, sql, fetch: f = fetch, env = {}, adesso }) {
  if (metodo !== 'POST') return { status: 405, corpo: { ok: false, errore: 'Metodo non consentito.' } };
  const letta = leggiRisposta(corpo);
  if (letta.trappola) return { status: 200, corpo: { ok: true } };
  if (letta.errore) return { status: 400, corpo: { ok: false, errore: letta.errore } };

  let salvata;
  try {
    // Se la creazione fallisce, la prossima richiesta ci riprova.
    if (!tabelleCreate) tabelleCreate = creaTabelle(sql).catch((e) => { tabelleCreate = null; throw e; });
    await tabelleCreate;
    salvata = await salvaRisposta(sql, letta.dati);
  } catch (e) {
    console.error('RSVP: salvataggio non riuscito', e);
    return { status: 500, corpo: { ok: false, errore: 'Non siamo riusciti a salvare la risposta. Riprovate tra poco, oppure scriveteci.' } };
  }

  let mail = 'non configurata';
  if (env.RESEND_API_KEY && env.RSVP_FROM) {
    try {
      const tutte = await leggiTutte(sql);
      const ultima = {
        rispondente: letta.dati.rispondente,
        presenza: letta.dati.presenza,
        persone: letta.dati.ospiti.length,
        nuova: salvata.nuova
      };
      const report = costruisciReport(tutte, ultima, adesso);
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
    console.warn('RSVP: RESEND_API_KEY o RSVP_FROM non impostate: nessuna mail inviata');
  }

  return { status: 200, corpo: { ok: true, id: salvata.id, nuova: salvata.nuova, mail } };
}

/* La funzione che riceve le risposte dell'RSVP (POST /api/rsvp).
   Salva su Supabase tramite la funzione SQL rsvp_salva (vedi supabase/schema.sql).
   Variabili d'ambiente: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, RSVP_TOKEN.
   Tutta la logica è in lib/rsvp.js. */
import { creaDb, gestisciRichiesta } from '../lib/rsvp.js';

export default async function handler(req, res) {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, RSVP_TOKEN } = process.env;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !RSVP_TOKEN) {
    console.error('RSVP: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY o RSVP_TOKEN non impostate');
    return res.status(503).json({ ok: false, errore: 'Le risposte non sono ancora attive: scriveteci, grazie.' });
  }

  let corpo = req.body;
  if (typeof corpo === 'string') {
    try { corpo = JSON.parse(corpo); } catch (e) { corpo = null; }
  }
  const esito = await gestisciRichiesta({
    metodo: req.method,
    corpo,
    db: creaDb({ fetch, url: SUPABASE_URL, chiave: SUPABASE_PUBLISHABLE_KEY, token: RSVP_TOKEN }),
    fetch,
    env: process.env
  });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(esito.status).json(esito.corpo);
}

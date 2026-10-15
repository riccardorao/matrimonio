/* La funzione che riceve le risposte dell'RSVP (POST /api/rsvp).
   Il database arriva da DATABASE_URL, che Vercel imposta quando si collega
   un Postgres dal Marketplace (Neon). Tutta la logica è in lib/rsvp.js. */
import { neon } from '@neondatabase/serverless';
import { gestisciRichiesta } from '../lib/rsvp.js';

let sql = null;

export default async function handler(req, res) {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    console.error('RSVP: DATABASE_URL non impostata');
    return res.status(503).json({ ok: false, errore: 'Le risposte non sono ancora attive: scriveteci, grazie.' });
  }
  sql ??= neon(url);

  let corpo = req.body;
  if (typeof corpo === 'string') {
    try { corpo = JSON.parse(corpo); } catch (e) { corpo = null; }
  }
  const esito = await gestisciRichiesta({
    metodo: req.method,
    corpo,
    sql,
    fetch,
    env: process.env
  });
  return res.status(esito.status).json(esito.corpo);
}

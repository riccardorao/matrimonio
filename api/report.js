/* Il report per gli sposi (GET /api/report), letto dalla pagina /admin.
   Serve la chiave segreta nell'intestazione "Authorization: Bearer …":
   la controlla il database stesso, qui non c'è nessun confronto da sbagliare. */
import { creaDb } from '../lib/rsvp.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, errore: 'Metodo non consentito.' });

  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return res.status(503).json({ ok: false, errore: 'Database non configurato.' });
  }
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ ok: false, errore: 'Chiave mancante.' });

  try {
    const report = await creaDb({ fetch, url: SUPABASE_URL, chiave: SUPABASE_PUBLISHABLE_KEY, token }).report();
    return res.status(200).json({ ok: true, ...report });
  } catch (e) {
    // Con una chiave sbagliata il database risponde con un errore di autorizzazione (28000, HTTP 400).
    if (/28000|non autorizzato/.test(String(e.message))) {
      return res.status(401).json({ ok: false, errore: 'Chiave non valida.' });
    }
    console.error('RSVP: lettura report non riuscita', e);
    return res.status(502).json({ ok: false, errore: 'Impossibile leggere i dati.' });
  }
}

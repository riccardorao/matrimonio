/* «Nessuna», «no», «niente», «non ho allergie»… non sono allergie: si scartano.
   Lo usano sia la funzione che salva le risposte (lib/rsvp.js) sia la pagina /admin,
   così il testo dichiarato "assente" non compare né nel report né nella mail. */

const NEGAZIONI = new Set(['nessuna', 'nessun', 'nessuno', 'nessune', 'nessuni', 'niente', 'nulla', 'no', 'non', 'assente', 'assenti', 'zero', 'n', 'na', 'nd', 'nn']);
const RIEMPITIVI = new Set([
  'allergia', 'allergie', 'allergico', 'allergici', 'intolleranza', 'intolleranze', 'alimentare', 'alimentari',
  'o', 'e', 'ne', 'ni', 'ho', 'ha', 'hanno', 'abbiamo', 'ci', 'sono', 'presente', 'presenti', 'particolare', 'particolari',
  'da', 'segnalare', 'tutto', 'ok', 'bene', 'grazie', 'per', 'fortuna', 'di', 'a', 'il', 'la', 'le', 'lo', 'gli', 'cibo', 'cibi'
]);

// true se il testo dice soltanto che non ci sono allergie (o non dice nulla)
export function nessunaAllergia(testo) {
  const parole = String(testo ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!parole.length) return true;
  return parole.every((p) => NEGAZIONI.has(p) || RIEMPITIVI.has(p)) && parole.some((p) => NEGAZIONI.has(p));
}

// il testo delle allergie com'è da conservare: vuoto se non ce ne sono
export function pulisciAllergie(testo) {
  const t = typeof testo === 'string' ? testo.trim() : '';
  return nessunaAllergia(t) ? '' : t;
}

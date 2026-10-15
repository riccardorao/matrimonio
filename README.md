# Matrimonio di Ambrogio e Francesca · 24.04.2027

Sito statico, una sola pagina: HTML, CSS e un po' di JavaScript, senza framework,
senza build e senza dipendenze. Si pubblica così com'è.

## Pubblicazione su Vercel

1. Vercel → **Add New → Project** → importa questo repository.
2. *Framework Preset*: **Other**. Lascia vuoti *Build Command* e *Output Directory*.
3. **Deploy**. Ogni push su `main` ripubblica il sito in pochi secondi.

Il dominio è `www.ambrogioefrancesca.it` (Vercel → Project → Settings → Domains). Gli indirizzi assoluti da tenere allineati:

- in `index.html`, la riga `og:image`: è l'anteprima che compare quando si condivide il link;
- in `download/matrimonio-ambrogio-francesca.ics`: `URL` e la riga di `DESCRIPTION`.

Vanno scritti con l'indirizzo assoluto, e ora contengono `https://www.ambrogioefrancesca.it`: da cambiare solo se cambia dominio.

## Come si cambia qualcosa

La pagina segue l'ordine in cui un invitato cerca le cose: **testata con la data
→ conto alla rovescia e calendario → foto → messa (con parcheggi) → ricevimento
→ regalo → RSVP**. Il bottone RSVP resta sempre in alto; il menu ha solo Cerimonia,
Ricevimento e Regalo.
Il bottone RSVP resta sempre in alto; il menu ha solo Cerimonia, Ricevimento, Regalo.

| Cosa | Dove |
|---|---|
| Testi, orari, indirizzi, link alle mappe | `index.html` |
| Colori, spaziature, caratteri | `css/style.css`: in cima, in `:root`, ci sono i token condivisi (misura delle etichette, dei titoli, dei bottoni, ombre). Cambiando un token cambia tutte le sezioni che lo usano. |
| **Mosaico di foto** sotto l'apertura | `index.html`, sezione `data-mosaico`: una riga `<li>` per foto. Classe `v` = verticale (WebP 280×400), `o` = orizzontale (280×200), `g` = grande (560×400). Le miniature stanno in `img/mosaico/`, già ritagliate. La copia per il giro continuo la crea `js/main.js`, che lo fa scorrere e lo rende trascinabile (velocità e ritorno all'andatura in cima al blocco del mosaico). |
| **Micromappa dei parcheggi** | Le vie sono in `img/luoghi/mappa-chiesa.svg` (da OpenStreetMap). I pallini sono in `index.html`, nella `.micromappa`: ogni `<a class="mm-p">` ha la posizione (`cx`/`cy`, in metri dall'angolo in alto a sinistra), il link Google Maps, `data-tempo` (il minuto mostrato) e `data-percorso` (il numero). Il tratteggio dal parcheggio alla chiesa è un `<path class="mm-percorso">` con lo stesso `data-percorso`: è calcolato a piedi sulla rete stradale OpenStreetMap; se si sposta un parcheggio, va ricalcolato. |
| Conto alla rovescia e calendario | Un'unica pill verde (`.pill-calendario`, sezione `#quando`) sotto la testata: «Mancano N giorni» con l'icona del calendario. Un tocco aggiunge l'evento: scarica `download/matrimonio-ambrogio-francesca.ics` (evento di tutto il giorno); su Android `js/main.js` punta a Google Calendar, usando l'indirizzo nell'attributo `data-android`. |
| IBAN, intestatari, causale | `index.html`, sezione `#regalo`: il testo copiato è nell'attributo `data-copia` di ogni bottone. |
| Negozi della lista nozze | `index.html`, sezione regalo: una `<div class="negozio">` per negozio. Sito e mappa sono `<a class="link-esterno">`, tutti con lo stesso stile. |
| Foto grandi (apertura, chiesa, cascina, Islanda, casa) | `img/apertura/`, `img/luoghi/`, `img/regalo/` |

## L'RSVP

Il modulo chiede prima se si viene. **No**: solo nome e cognome. **Sì**: quante persone
(da 1 a 10) e, per ognuna, Nome e Cognome, fascia d'età (0-3, 4-11, 12+) e allergie.
L'invio va a `POST /api/rsvp` (`api/rsvp.js`, con la logica in `lib/rsvp.js`), che:

1. controlla i dati;
2. li salva su **Supabase** (progetto `matrimonio-rsvp`): una riga per risposta in
   `rsvp_risposte` (con gli ospiti, il contatore delle modifiche e le date) e una riga per ogni
   invio in `rsvp_storico`, così nulla si perde. Lo schema è in `supabase/schema.sql`;
3. se la mail è configurata, manda il **report** con tutte le risposte a
   `ambrogiosilecchia@gmail.com` e `m.francesca18@gmail.com`, a ogni invio o modifica.

La risposta si ricorda su ogni dispositivo: «Modifica la risposta» la riapre, e il nuovo
invio aggiorna la stessa riga (non ne crea una seconda). Il campo «web», nascosto, è una
trappola per i robot.

### Dove gli sposi vedono le risposte

- **`/admin`** (pagina privata, non indicizzata): si entra con la chiave segreta (`RSVP_TOKEN`).
  Mostra persone confermate, sì/no, fasce d'età, allergie, nomi doppi, tutte le risposte con
  ricerca e filtro e le ultime modifiche; si aggiorna da sola ogni minuto e ha il pulsante
  «Scarica CSV». I numeri sono sempre calcolati dalle righe vere, non salvati a parte.
- **Mail**: appena configurato Resend (sotto), a ogni invio arriva il report completo.
- **Supabase**: *Table Editor* del progetto, se serve guardare i dati grezzi.

### Come è collegato (già fatto)

- Su Supabase le tabelle hanno RLS attivo e nessuna policy: dall'esterno non si legge e non si
  scrive nulla. Si passa solo dalle funzioni `rsvp_salva` e `rsvp_report`, che funzionano solo
  con la chiave segreta (nel database c'è solo la sua impronta SHA-256).
- Variabili del progetto Vercel: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (il lasciapassare
  pubblico di Supabase, da solo non dà accesso ai dati) e `RSVP_TOKEN` (la chiave segreta,
  «sensitive»: Vercel non la mostra più dopo il salvataggio).
- Per cambiare la chiave: generarne una nuova, aggiornare `RSVP_TOKEN` su Vercel e l'impronta
  nella tabella `rsvp_config` (`token_sha256`, vedi `supabase/schema.sql`), poi rifare il deploy.

### Attivare la mail (da fare una volta)

Senza queste variabili le risposte si salvano comunque e si leggono su `/admin`; manca solo la mail.

1. Creare un account su [Resend](https://resend.com), verificare il dominio
   `ambrogioefrancesca.it` (Resend mostra i record DNS da aggiungere) e creare una chiave API.
2. Variabili del progetto Vercel (*Settings → Environment Variables*):
   - `RESEND_API_KEY`: la chiave API di Resend;
   - `RSVP_FROM`: il mittente, per esempio `RSVP Matrimonio <rsvp@ambrogioefrancesca.it>`;
   - `RSVP_TO` (facoltativo): gli indirizzi a cui mandare il report, separati da virgola.
     Se manca, sono quelli di Ambrogio e Francesca.
3. Rilanciare il deploy. Poi inviare una risposta di prova: il report deve arrivare via mail.

Il Google Form precedente non riceve più risposte: quelle già arrivate restano nel suo foglio.

### Dati personali

Le risposte contengono nomi, fasce d'età dei bambini e allergie. Sono dati di persone
identificabili: vanno tenuti solo per l'organizzazione del matrimonio e cancellati dopo
(dal *Table Editor* o dall'*SQL Editor* di Supabase).

## Sicurezza

`vercel.json` imposta una politica molto stretta (CSP): niente script o stili inline,
niente risorse esterne, e le chiamate solo verso il proprio dominio (`/api/rsvp`, `/api/report`). Per questo
`index.html` non ha `<script>` o `style=` inline: se se ne aggiungono, il browser li blocca.
Il sito è anche escluso dai motori di ricerca (`robots.txt` e intestazione
`X-Robots-Tag`), perché contiene un IBAN.

## In locale

```bash
npx serve .
```

La pagina si vede così. Le risposte RSVP e `/admin` richiedono le funzioni e le variabili
d'ambiente: con `vercel dev`. La logica dell'RSVP si prova con `npm test`, senza database né mail.

## Struttura delle cartelle

```
index.html            la pagina
css/style.css         stili (prima per il telefono, poi per schermi grandi)
js/main.js            JavaScript: menu, mosaico, calendario, copia, RSVP
admin/index.html      pagina privata degli sposi (css/admin.css, js/admin.js)
api/rsvp.js           funzione che riceve le risposte (Vercel → Supabase)
api/report.js         funzione che dà il report a /admin (serve la chiave)
lib/rsvp.js           logica dell'RSVP: controllo, database, report via mail
supabase/schema.sql   tabelle e funzioni del database
package.json          solo gli script (nessuna dipendenza)
fonts/                Cormorant Garamond e Karla, serviti dal sito (licenza OFL)
img/apertura/         foto a tutta pagina in testa
img/mosaico/          miniature del mosaico
img/luoghi/           chiesa, cascina e micromappa
img/regalo/           Islanda e casa di Up
img/og.jpg            anteprima per la condivisione del link
download/             file scaricabili (calendario .ics)
originali/            JPEG originali, non pubblicati (.vercelignore)
```

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
| Conto alla rovescia e calendario | Sezione `#quando`, subito sotto la testata. Il bottone «Aggiungi al calendario» punta a `download/matrimonio-ambrogio-francesca.ics` (evento di tutto il giorno). Su Android, `js/main.js` lo fa puntare a Google Calendar, usando l'indirizzo nell'attributo `data-android`. |
| IBAN, intestatari, causale | `index.html`, sezione `#regalo`: il testo copiato è nell'attributo `data-copia` di ogni bottone. |
| Negozi della lista nozze | `index.html`, sezione regalo: una `<div class="negozio">` per negozio. Sito e mappa sono `<a class="link-esterno">`, tutti con lo stesso stile. |
| Foto grandi (apertura, chiesa, cascina, Islanda, casa) | `img/apertura/`, `img/luoghi/`, `img/regalo/` |

## L'RSVP

Il modulo chiede prima se si viene. **No**: solo nome e cognome. **Sì**: quante persone
(da 1 a 10) e, per ognuna, nome e cognome, fascia d'età (0–3, 4–11, 12 o più) e allergie.
L'invio va a `POST /api/rsvp` (`api/rsvp.js`, con la logica in `lib/rsvp.js`), che:

1. controlla i dati;
2. salva o aggiorna la risposta in due tabelle: `rsvp_risposte` (una riga per risposta) e
   `rsvp_ospiti` (una riga per ospite). Le tabelle si creano da sole al primo invio;
3. manda il **report** con tutte le risposte a `ambrogiosilecchia@gmail.com` e
   `m.francesca18@gmail.com`, a ogni invio o modifica.

La risposta si ricorda su ogni dispositivo: «Modifica la risposta» la riapre, e il nuovo
invio aggiorna la stessa riga (non ne crea una seconda). Il campo «web», nascosto, è una
trappola per i robot.

### Collegare il database e la mail (da fare una volta)

Senza queste variabili il modulo mostra un messaggio di errore: il sito funziona lo stesso.

1. **Database**: nella dashboard Vercel del progetto `matrimonio` → *Storage* → *Create
   Database* → **Postgres (Neon)**, e collegarlo al progetto. Vercel imposta da solo
   `DATABASE_URL`.
2. **Mail**: creare un account su [Resend](https://resend.com), verificare il dominio
   `ambrogioefrancesca.it` (Resend mostra i record DNS da aggiungere) e creare una chiave API.
3. **Variabili** del progetto Vercel (*Settings → Environment Variables*):
   - `RESEND_API_KEY`: la chiave API di Resend;
   - `RSVP_FROM`: il mittente, per esempio `RSVP Matrimonio <rsvp@ambrogioefrancesca.it>`;
   - `RSVP_TO` (facoltativo): gli indirizzi a cui mandare il report, separati da virgola.
     Se manca, sono quelli di Ambrogio e Francesca.
4. Rilanciare il deploy. Poi inviare una risposta di prova: il report deve arrivare via mail
   e la riga deve comparire nel database (*Storage* → *Query*).

Il Google Form precedente non riceve più risposte: quelle già arrivate restano nel suo foglio.

### Dati personali

Le risposte contengono nomi, fasce d'età dei bambini e allergie. Sono dati di persone
identificabili: vanno tenuti solo per l'organizzazione del matrimonio e cancellati dopo.
Il database si svuota con `DELETE FROM rsvp_ospiti; DELETE FROM rsvp_risposte;`.

## Sicurezza

`vercel.json` imposta una politica molto stretta (CSP): niente script o stili inline,
niente risorse esterne, e le chiamate solo verso il proprio dominio (`/api/rsvp`). Per questo
`index.html` non ha `<script>` o `style=` inline: se se ne aggiungono, il browser li blocca.
Il sito è anche escluso dai motori di ricerca (`robots.txt` e intestazione
`X-Robots-Tag`), perché contiene un IBAN.

## In locale

```bash
npx serve .
```

La pagina si vede così. Le risposte RSVP richiedono la funzione: con `vercel dev`, dopo
`npm install`. La logica dell'RSVP si prova con `npm test`, senza database né mail.

## Struttura delle cartelle

```
index.html            la pagina
css/style.css         stili (prima per il telefono, poi per schermi grandi)
js/main.js            JavaScript: menu, mosaico, calendario, copia, RSVP
api/rsvp.js           la funzione che riceve le risposte (Vercel)
lib/rsvp.js           logica dell'RSVP: controllo, database, report via mail
package.json          dipendenza del driver Postgres (solo per la funzione)
fonts/                Cormorant Garamond e Karla, serviti dal sito (licenza OFL)
img/apertura/         foto a tutta pagina in testa
img/mosaico/          miniature del mosaico
img/luoghi/           chiesa, cascina e micromappa
img/regalo/           Islanda e casa di Up
img/og.jpg            anteprima per la condivisione del link
download/             file scaricabili (calendario .ics)
originali/            JPEG originali, non pubblicati (.vercelignore)
```

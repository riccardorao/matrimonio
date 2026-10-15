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

È un modulo nella pagina che invia le risposte al **modulo Google** già in uso: stesse
domande, stesso foglio delle risposte. Funziona anche senza JavaScript (in quel caso
si apre la pagina di conferma di Google).

I nomi dei campi (`entry.877086558`, `entry.1498135098`, `entry.1525822404`,
`entry.636293364`) e i due valori della scelta («Sì, parteciperò» / «No, non posso
partecipare») **devono restare identici a quelli del modulo Google**. Se si cambiano o
si aggiungono domande nel modulo, vanno aggiornati qui, altrimenti Google rifiuta la
risposta. I nomi si leggono in Google Forms → ⋮ → *Ottieni link precompilato*.

## Sicurezza

`vercel.json` imposta una politica molto stretta (CSP): niente script o stili inline,
niente risorse esterne tranne l'invio a `docs.google.com`. Per questo `index.html` non
ha `<script>` o `style=` inline: se se ne aggiungono, il browser li blocca.
Il sito è anche escluso dai motori di ricerca (`robots.txt` e intestazione
`X-Robots-Tag`), perché contiene un IBAN.

## In locale

```bash
npx serve .
```

## Struttura delle cartelle

```
index.html            la pagina
css/style.css         stili (prima per il telefono, poi per schermi grandi)
js/main.js            JavaScript: menu, mosaico, calendario, copia, RSVP
fonts/                Cormorant Garamond e Karla, serviti dal sito (licenza OFL)
img/apertura/         foto a tutta pagina in testa
img/mosaico/          miniature del mosaico
img/luoghi/           chiesa, cascina e micromappa
img/regalo/           Islanda e casa di Up
img/og.jpg            anteprima per la condivisione del link
download/             file scaricabili (calendario .ics)
originali/            JPEG originali, non pubblicati (.vercelignore)
```

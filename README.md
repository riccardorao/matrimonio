# Matrimonio di Ambrogio e Francesca · 24.04.2027

Sito statico, una sola pagina: HTML, CSS e un po' di JavaScript, senza framework,
senza build e senza dipendenze. Si pubblica così com'è.

## Pubblicazione su Vercel

1. Vercel → **Add New → Project** → importa questo repository.
2. *Framework Preset*: **Other**. Lascia vuoti *Build Command* e *Output Directory*.
3. **Deploy**. Ogni push su `main` ripubblica il sito in pochi secondi.

Il dominio è `www.ambrogioefrancesca.it` (Vercel → Project → Settings → Domains). Gli indirizzi assoluti da tenere allineati:

- in `index.html`, la riga `og:image`: è l'anteprima che compare quando si condivide il link;
- in `matrimonio-ambrogio-francesca.ics`: `URL` e la riga di `DESCRIPTION`.

Vanno scritti con l'indirizzo assoluto, e ora contengono `https://www.ambrogioefrancesca.it`: da cambiare solo se cambia dominio.

## Come si cambia qualcosa

| Cosa | Dove |
|---|---|
| Testi, orari, indirizzi, link alle mappe | `index.html` |
| Colori, spaziature, tondezza degli angoli | `style.css` (in cima, le variabili in `:root`) |
| **Foto che scorrono** | `index.html`, sezione `data-nastro`: una riga `<li><img …></li>` per foto. Le copie per il giro continuo le crea `main.js`. Le foto vanno messe in `img/`, alte 560 px, in formato WebP. |
| Foto grandi (apertura, Islanda, casa) | `img/` e i relativi `<img>` in `index.html` |
| Orari nel calendario | `matrimonio-ambrogio-francesca.ics` |

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

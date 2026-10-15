/* ============================================================
   AMBROGIO & FRANCESCA — il poco di JavaScript che serve.

   Tutto è un di più: senza script la pagina si legge per intero, il menu
   si apre lo stesso (è un <details>), il mosaico si scorre col dito,
   l'IBAN si seleziona a mano e il calendario si scarica dal link.
   È un file esterno perché la CSP del sito non accetta script inline.
============================================================ */
(function () {
  'use strict';

  var MATRIMONIO = new Date('2027-04-24T14:30:00+02:00');
  var pocoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var avviso = document.querySelector('[data-avviso]');
  var timerAvviso;

  function mostraAvviso(testo) {
    if (!avviso) return;
    avviso.textContent = testo;
    avviso.classList.add('visibile');
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(function () { avviso.classList.remove('visibile'); }, 2200);
  }

  /* ---------- menu a comparsa ----------
     Si chiude toccando una voce, toccando fuori o con Esc. */
  var menu = document.querySelector('[data-menu]');
  if (menu) {
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { menu.open = false; });
    });
    document.addEventListener('click', function (e) {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });
  }

  /* ---------- conto alla rovescia ---------- */
  var conto = document.querySelector('[data-conto]');
  if (conto) {
    var giorni = Math.ceil((MATRIMONIO - new Date()) / 86400000);
    if (giorni > 1) {
      conto.innerHTML = 'Mancano <strong>' + giorni.toLocaleString('it-IT') + '</strong> giorni';
    } else if (giorni === 1) {
      conto.innerHTML = 'Manca <strong>un</strong> giorno';
    } else if (giorni === 0) {
      conto.innerHTML = '<strong>Oggi</strong> è il giorno';
    } else {
      conto.innerHTML = 'Grazie per aver festeggiato con noi';
    }
    conto.hidden = false;
  }

  /* ---------- aggiungi al calendario ----------
     Il file .ics è la via migliore su iPhone e Mac (si apre Calendario con
     l'evento pronto) e su Outlook. Su Android il file finisce spesso nei
     download senza aprirsi: lì il bottone principale va a Google Calendar,
     che apre l'app con l'evento già compilato. */
  var bottoneCal = document.querySelector('[data-calendario]');
  var linkGoogle = document.querySelector('[data-cal-google]');
  if (bottoneCal && linkGoogle && /Android/i.test(navigator.userAgent)) {
    bottoneCal.href = linkGoogle.href;
    bottoneCal.target = '_blank';
    bottoneCal.rel = 'noopener';
    var testoCal = bottoneCal.querySelector('[data-calendario-testo]');
    if (testoCal) testoCal.textContent = 'Aggiungi a Google Calendar';
  }

  /* ---------- copia (IBAN, intestatari, causale) ----------
     Con gli appunti moderni dove ci sono; altrimenti con il vecchio metodo
     della casella di testo nascosta, che funziona anche su browser datati
     e fuori da HTTPS. */
  function copiaTesto(testo) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(testo).catch(function () { return copiaVecchioStile(testo); });
    }
    return copiaVecchioStile(testo);
  }
  function copiaVecchioStile(testo) {
    return new Promise(function (ok, ko) {
      var t = document.createElement('textarea');
      t.value = testo;
      t.setAttribute('readonly', '');
      t.className = 'copia-temp';
      document.body.appendChild(t);
      t.select();
      t.setSelectionRange(0, testo.length);
      var riuscito = false;
      try { riuscito = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(t);
      if (riuscito) ok(); else ko();
    });
  }
  document.querySelectorAll('[data-copia]').forEach(function (b) {
    var etichetta = b.querySelector('span');
    var testoOriginale = etichetta ? etichetta.textContent : '';
    var timer;
    b.hidden = false;
    b.addEventListener('click', function () {
      copiaTesto(b.getAttribute('data-copia')).then(function () {
        b.classList.add('fatto');
        if (etichetta) etichetta.textContent = 'Copiato ✓';
        mostraAvviso(b.getAttribute('data-copia-avviso') || 'Copiato');
        if (navigator.vibrate) navigator.vibrate(15);
        clearTimeout(timer);
        timer = setTimeout(function () {
          b.classList.remove('fatto');
          if (etichetta) etichetta.textContent = testoOriginale;
        }, 2400);
      }, function () {
        mostraAvviso('Non è stato possibile copiare: tenete premuto il testo');
      });
    });
  });

  /* ---------- mosaico che scorre ----------
     Si raddoppia la serie (la copia è nascosta agli screen reader) e la si
     fa scorrere di metà: il giro non ha cuciture. La durata dipende dalla
     lunghezza, così la velocità resta la stessa su ogni schermo. Chi ha
     chiesto meno movimento lo scorre col dito. */
  var mosaico = document.querySelector('[data-mosaico]');
  if (mosaico && !pocoMovimento) {
    var serie = mosaico.querySelector('.mosaico-serie');
    var copia = serie.cloneNode(true);
    copia.setAttribute('aria-hidden', 'true');
    mosaico.appendChild(copia);
    var VELOCITA = 22; // pixel al secondo
    function regolaDurata() {
      var larghezza = serie.getBoundingClientRect().width;
      if (larghezza) mosaico.style.setProperty('--durata', Math.round(larghezza / VELOCITA) + 's');
    }
    regolaDurata();
    window.addEventListener('resize', regolaDurata);
    mosaico.parentNode.classList.add('in-moto');
  }

  /* ---------- RSVP ----------
     Il modulo è un normale form che invia al modulo Google della coppia:
     senza JavaScript funziona così com'è. Qui lo si invia restando nella
     pagina. Google non permette di leggere la risposta (no-cors), quindi
     "inviato" vuol dire che la richiesta è partita senza errori di rete. */
  var modulo = document.querySelector('[data-rsvp]');
  if (modulo && window.fetch && window.FormData && window.URLSearchParams) {
    var presenti = modulo.querySelector('[data-se-presenti]');
    var etichettaNomi = modulo.querySelector('[data-etichetta-nomi]');
    var campoNomi = modulo.querySelector('textarea[name="entry.1498135098"]');
    var invia = modulo.querySelector('[data-invia]');
    var stato = modulo.querySelector('[data-stato]');
    var grazie = document.querySelector('[data-grazie]');
    var grazieTitolo = document.querySelector('[data-grazie-titolo]');
    var grazieTesto = document.querySelector('[data-grazie-testo]');
    var CHIAVE = 'rsvp-ambrogio-francesca';

    function ciSaranno() {
      var scelta = modulo.querySelector('input[name="entry.877086558"]:checked');
      return !scelta || scelta.value.indexOf('Sì') === 0;
    }

    // Chi non viene non ha bisogno delle domande su bambini e allergie:
    // le nascondiamo e le disattiviamo, così non vengono nemmeno inviate.
    function aggiornaDomande() {
      var si = ciSaranno();
      presenti.hidden = !si;
      presenti.querySelectorAll('textarea').forEach(function (t) { t.disabled = !si; });
      etichettaNomi.textContent = si ? 'Nome e cognome di chi verrà' : 'Il vostro nome e cognome';
      campoNomi.placeholder = si ? 'Per esempio: Mario Rossi, Anna Bianchi' : 'Per esempio: Mario Rossi';
    }
    modulo.addEventListener('change', aggiornaDomande);
    aggiornaDomande();

    function mostraGrazie(si) {
      grazieTitolo.textContent = si ? 'Grazie, a presto!' : 'Grazie per avercelo detto';
      grazieTesto.textContent = si
        ? 'Abbiamo ricevuto la vostra risposta. Non vediamo l\'ora di festeggiare con voi il 24 aprile.'
        : 'Abbiamo ricevuto la vostra risposta. Ci mancherete, e vi penseremo quel giorno.';
      modulo.hidden = true;
      grazie.hidden = false;
    }

    // Chi ha già risposto da questo dispositivo ritrova il ringraziamento.
    try {
      var precedente = localStorage.getItem(CHIAVE);
      if (precedente) mostraGrazie(precedente === 'si');
    } catch (e) {}

    document.querySelector('[data-di-nuovo]').addEventListener('click', function () {
      modulo.reset();
      aggiornaDomande();
      stato.textContent = '';
      grazie.hidden = true;
      modulo.hidden = false;
      try { localStorage.removeItem(CHIAVE); } catch (e) {}
      modulo.querySelector('input[type="radio"]').focus();
    });

    modulo.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!modulo.reportValidity()) return;
      var si = ciSaranno();
      var dati = new URLSearchParams();
      new FormData(modulo).forEach(function (valore, nome) {
        if (String(valore).trim() !== '') dati.append(nome, valore);
      });
      invia.disabled = true;
      invia.textContent = 'Invio in corso…';
      stato.textContent = '';
      fetch(modulo.action, { method: 'POST', mode: 'no-cors', body: dati })
        .then(function () {
          try { localStorage.setItem(CHIAVE, si ? 'si' : 'no'); } catch (e) {}
          mostraGrazie(si);
          grazie.focus();
        }, function () {
          stato.textContent = 'Non siamo riusciti a inviare la risposta. Controllate la connessione e riprovate, oppure scriveteci.';
        })
        .then(function () {
          invia.disabled = false;
          invia.textContent = 'Invia la risposta';
        });
    });
  }

  /* ---------- barra: bordo dopo lo scorrimento ---------- */
  var barra = document.querySelector('.barra');
  function aggiornaBarra() {
    if (barra) barra.classList.toggle('scrollata', window.scrollY > 8);
  }
  aggiornaBarra();
  window.addEventListener('scroll', aggiornaBarra, { passive: true });

  /* ---------- comparsa dolce allo scorrimento ----------
     Solo per ciò che è ancora fuori dallo schermo: quello che si vede
     subito non deve lampeggiare. */
  if ('IntersectionObserver' in window && !pocoMovimento) {
    var osservaComparse = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('visto');
          osservaComparse.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    var altezza = window.innerHeight;
    document.querySelectorAll('.rivela').forEach(function (el) {
      if (el.getBoundingClientRect().top < altezza) return;
      el.classList.add('rivela-pronta');
      osservaComparse.observe(el);
    });
  }
})();

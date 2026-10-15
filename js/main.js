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
      conto.innerHTML = '<span>Mancano</span><strong>' + giorni.toLocaleString('it-IT') + ' giorni</strong>';
    } else if (giorni === 1) {
      conto.innerHTML = '<span>Manca</span><strong>un giorno</strong>';
    } else if (giorni === 0) {
      conto.innerHTML = '<span>Oggi è</span><strong>il giorno</strong>';
    } else {
      conto.innerHTML = '<span>Grazie</span><strong>di aver festeggiato</strong>';
    }
    conto.hidden = false;
  }

  /* ---------- aggiungi al calendario ----------
     Un solo bottone per tutti: il file .ics va bene su iPhone, Mac, Outlook
     e Windows. Su Android il file spesso non si apre da solo: lì il bottone
     punta a Google Calendar, che apre l'app con l'evento già compilato. */
  var bottoneCal = document.querySelector('[data-calendario]');
  if (bottoneCal && /Android/i.test(navigator.userAgent)) {
    bottoneCal.href = bottoneCal.getAttribute('data-android');
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
    var timer;
    b.hidden = false;
    b.addEventListener('click', function () {
      copiaTesto(b.getAttribute('data-copia')).then(function () {
        b.classList.add('fatto');
        mostraAvviso(b.getAttribute('data-copia-avviso') || 'Copiato');
        if (navigator.vibrate) navigator.vibrate(15);
        clearTimeout(timer);
        timer = setTimeout(function () { b.classList.remove('fatto'); }, 2400);
      }, function () {
        mostraAvviso('Non è stato possibile copiare: tenete premuto il testo');
      });
    });
  });

  /* ---------- mosaico che scorre (e si trascina) ----------
     Si raddoppia la serie (la copia è nascosta agli screen reader) e la si
     sposta con un transform, tenendo la posizione nel giro di una serie:
     così il nastro non finisce mai, in nessuna delle due direzioni.
     Va da solo a VELOCITA px/s. Col dito o col mouse lo si trascina; al
     rilascio parte con la velocità del gesto (un colpo veloce lo accelera,
     uno all'indietro lo fa tornare indietro) e poi torna piano alla sua
     andatura. Chi ha chiesto meno movimento lo vede fermo, ma può trascinarlo. */
  var mosaico = document.querySelector('[data-mosaico]');
  if (mosaico && window.requestAnimationFrame) {
    var nastro = mosaico.parentNode;
    var serie = mosaico.querySelector('.mosaico-serie');
    var copiaSerie = serie.cloneNode(true);
    copiaSerie.setAttribute('aria-hidden', 'true');
    mosaico.appendChild(copiaSerie);
    nastro.classList.add('in-moto');

    var VELOCITA = pocoMovimento ? 0 : 24; // px al secondo, verso sinistra
    var MASSIMA = 3500;                    // tetto alla velocità di un lancio
    var RITORNO = 1.3;                     // secondi per tornare all'andatura
    var x = 0, v = VELOCITA, larghezza = 0, ultimo = 0, inVista = true;
    var trascinando = false, idPuntatore = null, xPrec = 0, tPrec = 0, vGesto = 0;

    function misura() { larghezza = serie.getBoundingClientRect().width; }
    function disegna() {
      if (!larghezza) return;
      x = ((x % larghezza) + larghezza) % larghezza;
      mosaico.style.transform = 'translate3d(' + (-x).toFixed(1) + 'px, 0, 0)';
    }
    function passo(t) {
      var dt = ultimo ? Math.min(t - ultimo, 64) / 1000 : 0;
      ultimo = t;
      if (!trascinando && inVista && !document.hidden && dt) {
        v += (VELOCITA - v) * (1 - Math.exp(-dt / RITORNO));
        x += v * dt;
        disegna();
      }
      requestAnimationFrame(passo);
    }
    misura();
    window.addEventListener('resize', function () { misura(); disegna(); });
    window.addEventListener('load', misura);
    requestAnimationFrame(passo);

    nastro.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      trascinando = true; idPuntatore = e.pointerId;
      xPrec = e.clientX; tPrec = e.timeStamp; vGesto = 0;
      try { nastro.setPointerCapture(e.pointerId); } catch (err) {}
      nastro.classList.add('trascina');
    });
    nastro.addEventListener('pointermove', function (e) {
      if (!trascinando || e.pointerId !== idPuntatore) return;
      var dx = e.clientX - xPrec, dt = (e.timeStamp - tPrec) / 1000;
      x -= dx;
      disegna();
      if (dt > 0) vGesto = vGesto * 0.5 + (-dx / dt) * 0.5;
      xPrec = e.clientX; tPrec = e.timeStamp;
    });
    function fineGesto(e, lancia) {
      if (!trascinando || e.pointerId !== idPuntatore) return;
      trascinando = false;
      nastro.classList.remove('trascina');
      // dito fermo prima di alzarlo: nessun lancio
      if (!lancia || e.timeStamp - tPrec > 90) vGesto = 0;
      v = Math.max(-MASSIMA, Math.min(MASSIMA, vGesto || v));
    }
    nastro.addEventListener('pointerup', function (e) { fineGesto(e, true); });
    // il browser si prende il gesto (scorrimento verticale): si riparte da dov'era
    nastro.addEventListener('pointercancel', function (e) { fineGesto(e, false); });

    // trackpad e rotella orizzontale
    nastro.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      x += e.deltaX;
      disegna();
      v = Math.max(-MASSIMA, Math.min(MASSIMA, e.deltaX * 6));
    }, { passive: false });

    // fuori dallo schermo non serve farlo girare
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (voci) { inVista = voci[0].isIntersecting; }).observe(nastro);
    }
  }

  /* ---------- micromappa: fumetto e percorso ----------
     Ogni pallino è un link a Google Maps (senza JavaScript ci porta dritto).
     Qui il tocco apre un fumetto con i minuti a piedi e il pulsante «Mappa»,
     e tratteggia la strada da quel parcheggio alla chiesa: un solo percorso
     alla volta. Si chiude toccando fuori, ritoccando lo stesso pallino o con Esc. */
  var fumetto = document.querySelector('[data-fumetto]');
  if (fumetto) {
    var cornice = fumetto.parentNode;
    var fTempo = fumetto.querySelector('[data-fumetto-tempo]');
    var fLink = fumetto.querySelector('[data-fumetto-link]');
    var pallini = cornice.querySelectorAll('.mm-p');
    var percorsi = cornice.querySelectorAll('.mm-percorso');
    var aperto = null;

    function mostraPercorso(n) {
      percorsi.forEach(function (p) {
        p.classList.toggle('visibile', p.getAttribute('data-percorso') === n);
      });
    }
    function chiudiFumetto() {
      fumetto.hidden = true;
      mostraPercorso(null);
      if (aperto) { aperto.classList.remove('attivo'); aperto.setAttribute('aria-expanded', 'false'); }
      aperto = null;
    }
    function apriFumetto(p, daTastiera) {
      chiudiFumetto();
      fTempo.textContent = p.getAttribute('data-tempo');
      fLink.href = p.getAttribute('href');
      fumetto.hidden = false;
      var r = p.querySelector('.mm-p-pallino').getBoundingClientRect();
      var m = cornice.getBoundingClientRect();
      var cx = r.left + r.width / 2 - m.left, cy = r.top + r.height / 2 - m.top;
      var w = fumetto.offsetWidth, h = fumetto.offsetHeight;
      var sinistra = Math.max(w / 2 + 8, Math.min(m.width - w / 2 - 8, cx));
      fumetto.classList.toggle('sotto', cy - h - 30 < 0);
      fumetto.style.left = sinistra + 'px';
      fumetto.style.top = cy + 'px';
      fumetto.style.setProperty('--freccia', (cx - sinistra + w / 2) + 'px');
      p.classList.add('attivo');
      p.setAttribute('aria-expanded', 'true');
      mostraPercorso(p.getAttribute('data-percorso'));
      aperto = p;
      if (daTastiera) fLink.focus();
    }
    pallini.forEach(function (p) {
      p.setAttribute('aria-expanded', 'false');
      p.addEventListener('click', function (e) {
        e.preventDefault();
        if (aperto === p) chiudiFumetto(); else apriFumetto(p, e.detail === 0);
      });
    });
    document.addEventListener('click', function (e) {
      if (aperto && !fumetto.contains(e.target) && !e.target.closest('.mm-p')) chiudiFumetto();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && aperto) { var p = aperto; chiudiFumetto(); p.focus(); }
    });
    window.addEventListener('resize', chiudiFumetto);
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

/* ============================================================
   AMBROGIO & FRANCESCA — il poco di JavaScript che serve.

   Tutto è un di più: senza script la pagina si legge per intero,
   l'IBAN si seleziona a mano e il conto alla rovescia non compare.
   È un file esterno perché la CSP del sito non accetta script inline.
============================================================ */
(function () {
  'use strict';

  var MATRIMONIO = new Date('2027-04-24T14:30:00+02:00');
  var avviso = document.querySelector('[data-avviso]');
  var timerAvviso;

  function mostraAvviso(testo) {
    if (!avviso) return;
    avviso.textContent = testo;
    avviso.classList.add('visibile');
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(function () { avviso.classList.remove('visibile'); }, 2200);
  }

  /* ---------- conto alla rovescia ---------- */
  var conto = document.querySelector('[data-conto]');
  if (conto) {
    var adesso = new Date();
    var giorni = Math.ceil((MATRIMONIO - adesso) / 86400000);
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

  /* ---------- copia IBAN ---------- */
  var codice = document.querySelector('[data-iban]');
  var copia = document.querySelector('[data-copia]');
  if (codice && copia && navigator.clipboard && window.isSecureContext) {
    copia.hidden = false;
    copia.addEventListener('click', function () {
      navigator.clipboard.writeText(codice.getAttribute('data-iban')).then(function () {
        copia.textContent = 'Copiato';
        mostraAvviso('IBAN copiato negli appunti');
        setTimeout(function () { copia.textContent = 'Copia'; }, 2200);
      }, function () {
        mostraAvviso('Non è stato possibile copiare: selezionatelo a mano');
      });
    });
  }

  /* ---------- fotografie che scorrono ----------
     Nell'HTML c'è una sola serie di foto. Qui la si triplica (le copie sono
     nascoste agli screen reader) e si tiene la posizione nella serie centrale:
     quando ne esce si salta di una serie esatta, e il salto non si vede.
     Avanza da sola; si ferma sotto il cursore, mentre la si trascina o la si
     scorre col dito, e riparte poco dopo. */
  var nastro = document.querySelector('[data-nastro]');
  if (nastro) {
    var serie = nastro.querySelector('.nastro-serie');
    for (var c = 0; c < 2; c++) {
      var copiaSerie = serie.cloneNode(true);
      copiaSerie.setAttribute('aria-hidden', 'true');
      copiaSerie.querySelectorAll('img').forEach(function (img) { img.alt = ''; });
      nastro.appendChild(copiaSerie);
    }

    var VELOCITA = 28; // pixel al secondo
    var fermoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var posizione = 0, ultimo = 0, sospeso = false, visibile = true, riprendi;

    function larghezzaSerie() { return nastro.scrollWidth / 3; }
    function riallinea() {
      var w = larghezzaSerie();
      if (!w) return;
      if (nastro.scrollLeft >= 2 * w) nastro.scrollLeft -= w;
      else if (nastro.scrollLeft < w * 0.5) nastro.scrollLeft += w;
      posizione = nastro.scrollLeft;
    }
    function sospendi() { sospeso = true; clearTimeout(riprendi); }
    function riprendiTra(ms) {
      clearTimeout(riprendi);
      riprendi = setTimeout(function () { posizione = nastro.scrollLeft; sospeso = false; }, ms);
    }

    function passo(t) {
      if (ultimo && !sospeso && visibile && !document.hidden && !fermoMovimento) {
        posizione += VELOCITA * Math.min(t - ultimo, 64) / 1000;
        nastro.scrollLeft = posizione;
        var w = larghezzaSerie();
        if (w && posizione >= 2 * w) { posizione -= w; nastro.scrollLeft = posizione; }
      }
      ultimo = t;
      requestAnimationFrame(passo);
    }

    // Parte dalla serie centrale, così si può scorrere subito anche all'indietro.
    function avvia() { nastro.scrollLeft = larghezzaSerie(); posizione = nastro.scrollLeft; }
    if (document.readyState === 'complete') avvia(); else window.addEventListener('load', avvia);
    window.addEventListener('resize', riallinea);
    requestAnimationFrame(passo);

    // Mentre l'utente scorre (dito, trackpad, tastiera) il nastro lo segue
    // e il giro continuo resta tale.
    nastro.addEventListener('scroll', function () { if (sospeso) riallinea(); }, { passive: true });

    // Cursore sopra: fermo. Dito: fermo finché tocca, poi riparte.
    nastro.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') sospendi(); });
    nastro.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && !trascinando) riprendiTra(600); });
    nastro.addEventListener('touchstart', sospendi, { passive: true });
    nastro.addEventListener('touchend', function () { riprendiTra(2500); }, { passive: true });
    nastro.addEventListener('wheel', function () { sospendi(); riprendiTra(2500); }, { passive: true });
    nastro.addEventListener('focus', sospendi);
    nastro.addEventListener('blur', function () { riprendiTra(600); });

    // Trascinare col mouse, come si farebbe col dito.
    var trascinando = false, xIniziale = 0, scrollIniziale = 0;
    nastro.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      trascinando = true; xIniziale = e.clientX; scrollIniziale = nastro.scrollLeft;
      nastro.classList.add('trascina');
      nastro.setPointerCapture(e.pointerId);
      sospendi();
    });
    nastro.addEventListener('pointermove', function (e) {
      if (!trascinando) return;
      nastro.scrollLeft = scrollIniziale - (e.clientX - xIniziale);
      var w = larghezzaSerie();
      if (nastro.scrollLeft >= 2 * w) { nastro.scrollLeft -= w; scrollIniziale -= w; }
      else if (nastro.scrollLeft < w * 0.5) { nastro.scrollLeft += w; scrollIniziale += w; }
    });
    function fineTrascina(e) {
      if (!trascinando) return;
      trascinando = false;
      nastro.classList.remove('trascina');
      if (!nastro.matches(':hover')) riprendiTra(1500);
    }
    nastro.addEventListener('pointerup', fineTrascina);
    nastro.addEventListener('pointercancel', fineTrascina);

    // Fuori dallo schermo non serve farlo girare.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visibile = entries[0].isIntersecting;
      }).observe(nastro);
    }
  }

  /* ---------- foto: ingrandimento ----------
     Le foto sono tutte in vista nel mosaico; con JavaScript ognuna si apre
     in un <dialog> che si sfoglia con le frecce, la tastiera o il dito. */
  var galleria = document.querySelector('[data-galleria]');
  if (galleria) {
    var bottoni = Array.prototype.slice.call(galleria.querySelectorAll('button[data-foto]'));

    var lb = document.querySelector('[data-lightbox]');
    if (lb && typeof lb.showModal === 'function') {
      var lbImg = lb.querySelector('[data-lb-img]');
      var lbConta = lb.querySelector('[data-lb-conta]');
      var corrente = 0, xTocco = null;

      function vai(i) {
        corrente = (i + bottoni.length) % bottoni.length;
        var b = bottoni[corrente], mini = b.querySelector('img');
        lbImg.src = b.getAttribute('data-foto');
        lbImg.width = b.getAttribute('data-w');
        lbImg.height = b.getAttribute('data-h');
        lbImg.alt = mini ? mini.alt : '';
        lbConta.textContent = (corrente + 1) + ' / ' + bottoni.length;
        // la foto dopo, già pronta
        var prox = new Image();
        prox.src = bottoni[(corrente + 1) % bottoni.length].getAttribute('data-foto');
      }
      bottoni.forEach(function (b, i) {
        b.addEventListener('click', function () { vai(i); lb.showModal(); });
      });
      lb.querySelector('[data-lb-chiudi]').addEventListener('click', function () { lb.close(); });
      lb.querySelector('[data-lb-prec]').addEventListener('click', function () { vai(corrente - 1); });
      lb.querySelector('[data-lb-succ]').addEventListener('click', function () { vai(corrente + 1); });
      lb.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') vai(corrente - 1);
        else if (e.key === 'ArrowRight') vai(corrente + 1);
      });
      // un tocco fuori dalla foto chiude
      lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
      lb.addEventListener('touchstart', function (e) { xTocco = e.changedTouches[0].clientX; }, { passive: true });
      lb.addEventListener('touchend', function (e) {
        if (xTocco === null) return;
        var dx = e.changedTouches[0].clientX - xTocco;
        xTocco = null;
        if (Math.abs(dx) > 50) vai(corrente + (dx < 0 ? 1 : -1));
      }, { passive: true });
      // chiudendo, il focus torna sulla miniatura: e la si porta in vista
      lb.addEventListener('close', function () { bottoni[corrente].focus({ preventScroll: false }); });
    }
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

  /* ---------- barra: bordo dopo lo scorrimento, voce attiva ---------- */
  var barra = document.querySelector('.barra');
  function aggiornaBarra() {
    if (barra) barra.classList.toggle('scrollata', window.scrollY > 8);
  }
  aggiornaBarra();
  window.addEventListener('scroll', aggiornaBarra, { passive: true });

  if ('IntersectionObserver' in window) {
    var voci = {};
    document.querySelectorAll('.barra nav a[href^="#"]').forEach(function (a) {
      voci[a.getAttribute('href').slice(1)] = a;
    });
    var visibili = {};
    var osservaSezioni = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { visibili[e.target.id] = e.isIntersecting; });
      // la voce attiva è la sezione a metà schermo; nessuna, se si è sulla foto iniziale
      var attiva = Object.keys(voci).filter(function (id) { return visibili[id]; }).pop();
      Object.keys(voci).forEach(function (id) { voci[id].classList.toggle('attivo', id === attiva); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(voci).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) osservaSezioni.observe(s);
    });

    /* ---------- comparsa dolce allo scorrimento ----------
       Solo per ciò che è ancora fuori dallo schermo: quello che si vede
       subito non deve lampeggiare. */
    var pocoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!pocoMovimento) {
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
  }
})();

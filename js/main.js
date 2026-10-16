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
    var testoConto;
    if (giorni > 1) testoConto = 'Mancano ' + giorni.toLocaleString('it-IT') + ' giorni';
    else if (giorni === 1) testoConto = 'Manca un giorno';
    else if (giorni === 0) testoConto = 'Oggi è il giorno';
    else testoConto = null;
    if (testoConto) {
      conto.textContent = testoConto;
      var pill = conto.closest('a');
      if (pill) pill.setAttribute('aria-label', testoConto + '. Aggiungi al calendario');
    }
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
    var mappa = cornice.querySelector('.micromappa');
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
    // Posizione del fumetto, in coordinate del contenitore. Da telefono sta
    // sopra o sotto il pallino (sovrapposto alla mappa); su desktop, a fianco.
    function posiziona(p) {
      var r = p.querySelector('.mm-p-pallino').getBoundingClientRect();
      var c = cornice.getBoundingClientRect();
      var m = mappa.getBoundingClientRect();
      var ox = m.left - c.left, oy = m.top - c.top;
      var cxm = r.left + r.width / 2 - m.left, cym = r.top + r.height / 2 - m.top;
      if (window.matchMedia('(min-width: 900px)').matches) {
        fumetto.classList.remove('sotto');
        fumetto.classList.add('lato');
        fumetto.style.left = (ox + m.width + 22) + 'px';
        fumetto.style.top = (oy + cym) + 'px';
        fumetto.style.removeProperty('--freccia');
        return;
      }
      fumetto.classList.remove('lato');
      var w = fumetto.offsetWidth, h = fumetto.offsetHeight;
      var sinistra = Math.max(w / 2 + 8, Math.min(m.width - w / 2 - 8, cxm));
      fumetto.classList.toggle('sotto', cym - h - 30 < 0);
      fumetto.style.left = (ox + sinistra) + 'px';
      fumetto.style.top = (oy + cym) + 'px';
      fumetto.style.setProperty('--freccia', (cxm - sinistra + w / 2) + 'px');
    }
    function apriFumetto(p, daTastiera) {
      chiudiFumetto();
      fTempo.textContent = p.getAttribute('data-tempo');
      fLink.href = p.getAttribute('href');
      fumetto.hidden = false;
      posiziona(p);
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
     Prima si chiede se si viene. "No": solo il nome. "Sì": quante persone
     (1–10) e, per ognuna, nome, fascia d'età e allergie. L'invio va a
     /api/rsvp, che salva nel database e manda il report via mail. La
     risposta si ricorda su questo dispositivo: "Modifica" la riapre e il
     nuovo invio aggiorna la stessa risposta, senza crearne una seconda. */
  var modulo = document.querySelector('[data-rsvp]');
  if (modulo && window.fetch) {
    var CHIAVE = 'rsvp-ambrogio-francesca';
    var MAX_PERSONE = 10;
    var passoNo = modulo.querySelector('[data-passo="no"]');
    var passoSi = modulo.querySelector('[data-passo="si"]');
    var contenitoreOspiti = modulo.querySelector('[data-ospiti]');
    var modello = document.getElementById('ospite-modello');
    var invia = modulo.querySelector('[data-invia]');
    var testoInvia = invia.textContent;
    var stato = modulo.querySelector('[data-stato]');
    var trappola = modulo.querySelector('[name="web"]');
    var grazie = document.querySelector('[data-grazie]');
    var grazieTesto = document.querySelector('[data-grazie-testo]');
    var risposta = null; // { id, dati } della risposta salvata su questo dispositivo

    function creaOspite(n) {
      var blocco = modello.content.firstElementChild.cloneNode(true);
      blocco.querySelector('[data-titolo]').textContent = 'Persona ' + n;
      blocco.querySelectorAll('input[type="radio"]').forEach(function (r) { r.name = 'eta-' + n; });
      contenitoreOspiti.appendChild(blocco);
    }
    for (var n = 1; n <= MAX_PERSONE; n++) creaOspite(n);
    var blocchi = contenitoreOspiti.querySelectorAll('[data-ospite]');

    function scelta(nome) {
      var el = modulo.querySelector('input[name="' + nome + '"]:checked');
      return el ? el.value : null;
    }
    // I campi nascosti sono disabilitati: non vengono validati né inviati.
    function abilita(contenitore, si) {
      contenitore.querySelectorAll('input, textarea').forEach(function (el) { el.disabled = !si; });
    }
    function aggiorna() {
      var presenza = scelta('presenza');
      var numero = presenza === 'si' ? parseInt(scelta('numero'), 10) || 0 : 0;
      passoNo.hidden = presenza !== 'no';
      abilita(passoNo, presenza === 'no');
      passoSi.hidden = presenza !== 'si';
      abilita(passoSi, presenza === 'si');
      blocchi.forEach(function (b, i) {
        var mostra = i < numero;
        b.hidden = !mostra;
        abilita(b, mostra);
      });
      invia.hidden = !(presenza === 'no' || numero > 0);
    }
    modulo.addEventListener('change', aggiorna);

    function raccogli() {
      var presenza = scelta('presenza');
      if (presenza === 'no') {
        return { presenza: 'no', rispondente: passoNo.querySelector('input').value.trim(), ospiti: [] };
      }
      var numero = parseInt(scelta('numero'), 10);
      var ospiti = [];
      for (var i = 0; i < numero; i++) {
        var b = blocchi[i];
        var eta = b.querySelector('input[type="radio"]:checked');
        ospiti.push({
          nome: b.querySelector('input[name="nome"]').value.trim(),
          eta: eta ? eta.value : null,
          allergie: b.querySelector('textarea').value.trim()
        });
      }
      return { presenza: 'si', rispondente: ospiti[0].nome, ospiti: ospiti };
    }
    // Riempie il modulo con una risposta già data (per "Modifica").
    function riempi(dati) {
      modulo.reset();
      var radio = modulo.querySelector('input[name="presenza"][value="' + dati.presenza + '"]');
      if (radio) radio.checked = true;
      if (dati.presenza === 'no') {
        passoNo.querySelector('input').value = dati.rispondente || '';
      } else {
        var numeri = modulo.querySelector('input[name="numero"][value="' + dati.ospiti.length + '"]');
        if (numeri) numeri.checked = true;
        dati.ospiti.forEach(function (o, i) {
          var b = blocchi[i];
          b.querySelector('input[name="nome"]').value = o.nome;
          var eta = b.querySelector('input[type="radio"][value="' + o.eta + '"]');
          if (eta) eta.checked = true;
          b.querySelector('textarea').value = o.allergie || '';
        });
      }
      aggiorna();
    }
    function mostraGrazie(dati) {
      grazieTesto.textContent = dati.presenza === 'si'
        ? 'Abbiamo ricevuto la vostra risposta, non vediamo l\'ora di festeggiare insieme!'
        : 'Abbiamo ricevuto la vostra risposta, ci mancherete: vi penseremo quel giorno!';
      modulo.hidden = true;
      grazie.hidden = false;
    }
    function ricordaRisposta(id, dati) {
      risposta = { id: id, dati: dati };
      try { localStorage.setItem(CHIAVE, JSON.stringify(risposta)); } catch (e) {}
    }
    function dimenticaRisposta() {
      risposta = null;
      try { localStorage.removeItem(CHIAVE); } catch (e) {}
    }

    // Chi ha già risposto da questo dispositivo ritrova il ringraziamento.
    try {
      var salvata = JSON.parse(localStorage.getItem(CHIAVE) || 'null');
      if (salvata && salvata.dati) { risposta = salvata; mostraGrazie(salvata.dati); }
    } catch (e) {}

    document.querySelector('[data-modifica]').addEventListener('click', function () {
      if (!risposta) return;
      riempi(risposta.dati);
      grazie.hidden = true;
      modulo.hidden = false;
      modulo.querySelector('input[name="presenza"]').focus();
    });
    document.querySelector('[data-di-nuovo]').addEventListener('click', function () {
      dimenticaRisposta();
      modulo.reset();
      aggiorna();
      stato.textContent = '';
      grazie.hidden = true;
      modulo.hidden = false;
      modulo.querySelector('input[name="presenza"]').focus();
    });

    modulo.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!modulo.reportValidity()) return;
      var dati = raccogli();
      var corpo = { presenza: dati.presenza, rispondente: dati.rispondente, ospiti: dati.ospiti, web: trappola.value };
      if (risposta && risposta.id) corpo.id = risposta.id;
      invia.disabled = true;
      invia.textContent = 'Invio in corso…';
      stato.textContent = '';
      fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, corpo: j }; });
      }).then(function (esito) {
        if (!esito.ok || !esito.corpo.ok) {
          stato.textContent = esito.corpo.errore || 'Non siamo riusciti a inviare la risposta. Controllate la connessione e riprovate, oppure scriveteci.';
          return;
        }
        ricordaRisposta(esito.corpo.id || (risposta && risposta.id), dati);
        mostraGrazie(dati);
        grazie.focus();
      }, function () {
        stato.textContent = 'Non siamo riusciti a inviare la risposta. Controllate la connessione e riprovate, oppure scriveteci.';
      }).then(function () {
        invia.disabled = false;
        invia.textContent = testoInvia;
      });
    });
    aggiorna();
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

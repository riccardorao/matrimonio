/* Pagina /admin: legge il report da /api/report e lo mostra agli sposi.
   La chiave segreta resta solo nella scheda del browser (sessionStorage). */
(() => {
  'use strict';

  const CHIAVE = 'rsvp-admin-chiave';
  const AGGIORNA_OGNI = 60000;
  const fasce = { '0-3': '0–3 anni', '4-11': '4–11 anni', '12+': '12+' };

  const $ = (s) => document.querySelector(s);
  const accesso = $('[data-accesso]');
  const cruscotto = $('[data-cruscotto]');
  const azioni = $('[data-azioni]');
  const statoAccesso = $('[data-stato-accesso]');

  let dati = null;
  let timer = null;

  const leggi = () => { try { return sessionStorage.getItem(CHIAVE); } catch (e) { return null; } };
  const salva = (v) => { try { v ? sessionStorage.setItem(CHIAVE, v) : sessionStorage.removeItem(CHIAVE); } catch (e) { /* ignora */ } };

  const crea = (tag, testo, classe) => {
    const e = document.createElement(tag);
    if (testo != null) e.textContent = testo;
    if (classe) e.className = classe;
    return e;
  };
  const svuota = (e) => { while (e.firstChild) e.removeChild(e.firstChild); };
  const quando = (iso) => new Date(iso).toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' });
  const norma = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

  async function scarica(chiave) {
    const r = await fetch('/api/report', { headers: { Authorization: 'Bearer ' + chiave }, cache: 'no-store' });
    if (r.status === 401) throw Object.assign(new Error('Chiave non valida.'), { chiaveErrata: true });
    if (!r.ok) throw new Error('Impossibile leggere i dati. Riprovate tra poco.');
    return r.json();
  }

  function disegna() {
    if (!dati) return;
    const { totali, risposte, duplicati = [], storico = [] } = dati;
    document.querySelectorAll('[data-n]').forEach((e) => { e.textContent = totali[e.dataset.n] ?? 0; });
    $('[data-aggiornato]').textContent = 'Dati letti alle ' + quando(dati.generato) + (totali.ultimo_aggiornamento ? ' · ultima risposta ' + quando(totali.ultimo_aggiornamento) : '');

    // nomi doppi
    const doppi = new Set(duplicati.map((d) => d.nome));
    $('[data-duplicati]').hidden = !duplicati.length;
    $('[data-duplicati-elenco]').textContent = duplicati.map((d) => d.nome + ' (' + d.risposte + ' risposte)').join(', ') + '. Controllate che non siano la stessa persona.';

    // allergie
    const lista = $('[data-allergie]');
    svuota(lista);
    risposte.forEach((r) => r.ospiti.filter((o) => o.allergie).forEach((o) => {
      const li = crea('li', o.nome + ': ' + o.allergie);
      li.appendChild(crea('small', ' · risposta di ' + r.rispondente));
      lista.appendChild(li);
    }));
    $('[data-blocco-allergie]').hidden = !lista.children.length;

    // tabella
    const filtro = $('[data-filtro]').value;
    const cerca = norma($('[data-cerca]').value);
    const corpo = $('[data-righe]');
    svuota(corpo);
    const visibili = risposte.filter((r) => (filtro === 'tutte' || r.presenza === filtro) &&
      (!cerca || norma(r.rispondente + ' ' + r.ospiti.map((o) => o.nome).join(' ')).includes(cerca)));
    visibili.forEach((r) => {
      const tr = document.createElement('tr');
      const chi = crea('td');
      chi.dataset.label = 'Chi';
      const nome = crea('div', r.rispondente);
      if (doppi.has(norma(r.rispondente))) nome.appendChild(crea('span', 'nome doppio', 'adm-doppio'));
      chi.appendChild(nome);
      tr.appendChild(chi);
      const viene = crea('td', r.presenza === 'si' ? 'Sì' : 'No', r.presenza === 'si' ? 'adm-si' : 'adm-no');
      viene.dataset.label = 'Viene';
      tr.appendChild(viene);
      const quante = crea('td', String(r.persone), 'num');
      quante.dataset.label = 'Persone';
      tr.appendChild(quante);
      const ospiti = crea('td');
      ospiti.dataset.label = 'Ospiti';
      const ospitiDentro = crea('div', null, 'adm-ospiti-celle');
      ospiti.appendChild(ospitiDentro);
      if (r.presenza === 'no') ospitiDentro.textContent = '—';
      r.ospiti.forEach((o) => {
        const blocco = crea('span', o.nome, 'adm-ospite');
        blocco.appendChild(crea('span', fasce[o.eta] || o.eta, 'adm-etichetta'));
        if (o.allergie) blocco.appendChild(crea('span', o.allergie, 'adm-allergia'));
        ospitiDentro.appendChild(blocco);
      });
      tr.appendChild(ospiti);
      const agg = crea('td', quando(r.aggiornata) + (r.versione > 1 ? ' (modificata ' + (r.versione - 1) + '×)' : ''));
      agg.dataset.label = 'Aggiornata';
      tr.appendChild(agg);
      corpo.appendChild(tr);
    });
    $('[data-vuoto]').hidden = visibili.length > 0;
    $('[data-vuoto]').textContent = risposte.length ? 'Nessuna risposta corrisponde alla ricerca.' : 'Ancora nessuna risposta.';

    // storico
    const st = $('[data-storico]');
    svuota(st);
    storico.forEach((s) => {
      const li = crea('li', s.rispondente + ' ' + (s.evento === 'nuova' ? 'ha risposto' : 'ha modificato') +
        (s.presenza === 'si' ? ': ' + s.persone + (s.persone === 1 ? ' persona' : ' persone') : ': non viene'));
      li.appendChild(crea('small', ' · ' + quando(s.quando)));
      st.appendChild(li);
    });
    if (!storico.length) st.appendChild(crea('li', 'Nessuna modifica ancora.'));
  }

  function csv() {
    if (!dati) return;
    const cella = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const righe = [['Chi risponde', 'Viene', 'Persone in risposta', 'Ospite', 'Età', 'Allergie / intolleranze', 'Aggiornata'].map(cella).join(';')];
    dati.risposte.forEach((r) => {
      if (!r.ospiti.length) righe.push([r.rispondente, 'No', 0, '', '', '', quando(r.aggiornata)].map(cella).join(';'));
      r.ospiti.forEach((o) => righe.push([r.rispondente, 'Sì', r.persone, o.nome, fasce[o.eta] || o.eta, o.allergie, quando(r.aggiornata)].map(cella).join(';')));
    });
    const blob = new Blob(['﻿' + righe.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rsvp-ambrogio-francesca.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function mostra(dentro) {
    accesso.hidden = dentro;
    cruscotto.hidden = !dentro;
    azioni.hidden = !dentro;
  }

  function esci(messaggio) {
    clearTimeout(timer);
    salva(null);
    dati = null;
    mostra(false);
    statoAccesso.textContent = messaggio || '';
  }

  async function carica(chiave, manuale) {
    try {
      dati = await scarica(chiave);
      salva(chiave);
      mostra(true);
      disegna();
    } catch (e) {
      if (e.chiaveErrata) return esci(manuale ? e.message : '');
      if (!dati) return esci(e.message);
      $('[data-aggiornato]').textContent = e.message; // restano i dati già a schermo
    }
    clearTimeout(timer);
    if (leggi()) timer = setTimeout(() => carica(leggi(), false), AGGIORNA_OGNI);
  }

  accesso.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const chiave = accesso.elements.chiave.value.trim();
    if (!chiave) return;
    statoAccesso.textContent = 'Controllo…';
    carica(chiave, true).then(() => { accesso.elements.chiave.value = ''; if (!dati) return; statoAccesso.textContent = ''; });
  });
  $('[data-aggiorna]').addEventListener('click', () => leggi() && carica(leggi(), true));
  $('[data-csv]').addEventListener('click', csv);
  $('[data-esci]').addEventListener('click', () => esci(''));
  $('[data-filtro]').addEventListener('change', disegna);
  $('[data-cerca]').addEventListener('input', disegna);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && leggi()) carica(leggi(), false); });

  mostra(false);
  if (leggi()) carica(leggi(), false);
})();

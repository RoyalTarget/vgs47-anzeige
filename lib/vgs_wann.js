// vgs-wann-card (07.10.2026, Nutzerwunsch): „Wann starten?“ als Ampel – drei große Gerätesymbole nebeneinander,
// Farbe = Empfehlung, darunter ein Stichwort, alles Weitere per Antippen/Darüberfahren. Läuft = blau, pulsierend.
//   grün  = jetzt (Sonne reicht oder Warten spart < 0,10 €) · gelb = „ab …“ (spart ≥ 0,10 €, > 4 h entfernt)
//   rot   = „warten …“ (spart ≥ 0,10 €, in ≤ 4 h) · blau = läuft · grau = keine Daten
// Daten: sensor.<gerät>_startempfehlung (startzeit.yaml), binary_sensor.<gerät>_lauft, sensor.akku_prognose (Gratis-Fenster).
// Dieselbe Datei läuft auf der Anzeigeseite (homeassistant/anzeige/lib/vgs_wann.js): dort setzt app.js .modell statt hass.
(() => {
  const ICON = {"mdiWashingMachine": "M14.83,11.17C16.39,12.73 16.39,15.27 14.83,16.83C13.27,18.39 10.73,18.39 9.17,16.83L14.83,11.17M6,2H18A2,2 0 0,1 20,4V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2M7,4A1,1 0 0,0 6,5A1,1 0 0,0 7,6A1,1 0 0,0 8,5A1,1 0 0,0 7,4M10,4A1,1 0 0,0 9,5A1,1 0 0,0 10,6A1,1 0 0,0 11,5A1,1 0 0,0 10,4M12,8A6,6 0 0,0 6,14A6,6 0 0,0 12,20A6,6 0 0,0 18,14A6,6 0 0,0 12,8Z", "mdiTumbleDryer": "M6,2H18A2,2 0 0,1 20,4V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2M7,4A1,1 0 0,0 6,5A1,1 0 0,0 7,6A1,1 0 0,0 8,5A1,1 0 0,0 7,4M10,4A1,1 0 0,0 9,5A1,1 0 0,0 10,6A1,1 0 0,0 11,5A1,1 0 0,0 10,4M12,8A6,6 0 0,0 6,14A6,6 0 0,0 12,20A6,6 0 0,0 18,14A6,6 0 0,0 12,8M8.11,10.5H10C9.76,11.88 10,12.67 10.58,13.29C11.68,14.36 12.16,15.71 11.89,17.5H10C10.24,16.12 10,15.33 9.42,14.71C8.32,13.64 7.85,12.29 8.11,10.5M12.11,10.5H14C13.76,11.88 14,12.67 14.58,13.29C15.68,14.36 16.16,15.71 15.89,17.5H14C14.24,16.12 14,15.33 13.42,14.71C12.32,13.64 11.85,12.29 12.11,10.5Z", "mdiDishwasher": "M18,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V4A2,2 0 0,0 18,2M10,4A1,1 0 0,1 11,5A1,1 0 0,1 10,6A1,1 0 0,1 9,5A1,1 0 0,1 10,4M7,4A1,1 0 0,1 8,5A1,1 0 0,1 7,6A1,1 0 0,1 6,5A1,1 0 0,1 7,4M18,20H6V8H18V20M14.67,15.33C14.69,16.03 14.41,16.71 13.91,17.21C12.86,18.26 11.15,18.27 10.09,17.21C9.59,16.71 9.31,16.03 9.33,15.33C9.4,14.62 9.63,13.94 10,13.33C10.37,12.5 10.81,11.73 11.33,11L12,10C13.79,12.59 14.67,14.36 14.67,15.33", "mdiWhiteBalanceSunny": "M3.55 19.09L4.96 20.5L6.76 18.71L5.34 17.29M12 6C8.69 6 6 8.69 6 12S8.69 18 12 18 18 15.31 18 12C18 8.68 15.31 6 12 6M20 13H23V11H20M17.24 18.71L19.04 20.5L20.45 19.09L18.66 17.29M20.45 5L19.04 3.6L17.24 5.39L18.66 6.81M13 1H11V4H13M6.76 5.39L4.96 3.6L3.55 5L5.34 6.81L6.76 5.39M1 13H4V11H1M13 20H11V23H13", "mdiBatteryOutline": "M16,20H8V6H16M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4Z", "mdiInformationOutline": "M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z"};
  const SPART = 0.10, BALD_H = 4;
  const GERAETE = [
    {k: 'waschmaschine', n: 'Waschmaschine', i: ICON.mdiWashingMachine, lauf: 'sensor.waschmaschine_letzter_lauf'},
    {k: 'trockner', n: 'Trockner', i: ICON.mdiTumbleDryer, lauf: 'sensor.trockner_letzter_lauf'},
    {k: 'spulmaschine', n: 'Spülmaschine', i: ICON.mdiDishwasher, lauf: 'sensor.spulmaschine_letzter_gang'}];
  const FARBE = {gruen: '#22c55e', gelb: '#facc15', rot: '#ef4444', blau: '#3b82f6', grau: '#6b7280'};
  const eur = (v) => v == null || isNaN(v) ? '–' : Number(v).toFixed(2).replace('.', ',') + ' €';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const uhr = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const tagVon = (t) => { const d = new Date(t), h = new Date(), m = new Date(Date.now() + 864e5);
    return d.toDateString() === h.toDateString() ? '' : d.toDateString() === m.toDateString() ? 'morgen ' : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()] + ' '; };
  const dauer = (ms) => { const mi = Math.max(Math.round(ms / 6e4), 0); return mi < 60 ? `${mi} min` : `${Math.floor(mi / 60)}:${String(mi % 60).padStart(2, '0')} h`; };
  const inZeit = (t) => { const mi = Math.round((new Date(t) - Date.now()) / 6e4); return mi < 1 ? 'gleich' : mi < 90 ? `${mi} min` : `${Math.round(mi / 60)} h`; };

  // Modell aus hass (Dashboard)
  function ausHass(h) {
    const st = (e) => h.states[e], at = (e, a) => (st(e) || {attributes: {}}).attributes[a];
    const geraete = GERAETE.map((g) => { const e = `sensor.${g.k}_startempfehlung`, s = st(e), b = st(`binary_sensor.${g.k}_lauft`);
      const laeuft = (s && s.state === 'läuft') || (b && b.state === 'on');
      return {...g, zustand: s ? s.state : 'unavailable', laeuft, seit: laeuft ? (at(g.lauf, 'start') || (b && b.last_changed)) : null,
        kj: at(e, 'kosten_jetzt'), kb: at(e, 'kosten_best'), er: at(e, 'ersparnis'), start: at(e, 'start'), kwh: at(e, 'kwh'), u0: (at(e, 'pv_uberschuss') || [0])[0]}; });
    const ap = st('sensor.akku_prognose');
    return {geraete, fenster: ap ? ap.attributes.fenster : null, maxSoc: ap ? ap.attributes.max_soc : null, maxZeit: ap ? ap.attributes.max_zeit : null};
  }

  // Ampel je Gerät
  function bewerte(g) {
    if (g.laeuft) return {f: 'blau', wort: g.seit ? 'läuft ' + dauer(Date.now() - new Date(g.seit)) : 'läuft', txt: `läuft${g.seit ? ' seit ' + uhr(g.seit) : ''}`};
    if (!g.zustand || ['unavailable', 'unknown'].includes(g.zustand)) return {f: 'grau', wort: '–', txt: 'keine Daten'};
    const h = g.start ? (new Date(g.start) - Date.now()) / 36e5 : null, sp = Number(g.er) || 0;
    if (sp >= SPART && h != null && h > 0 && h <= BALD_H) return {f: 'rot', wort: 'warten ' + inZeit(g.start),
      txt: `bitte warten bis ${uhr(g.start)} (in ${inZeit(g.start)}) · spart ${eur(sp)} (jetzt ${eur(g.kj)}, dann ${eur(g.kb)})`};
    if (sp >= SPART && h != null && h > BALD_H) { const gr = (Number(g.kb) || 0) < 0.02;
      return {f: 'gelb', wort: (tagVon(g.start) ? tagVon(g.start) : 'ab ') + uhr(g.start),
        txt: `${gr ? 'gratis' : 'günstiger'} ab ${tagVon(g.start)}${uhr(g.start)} (in ${inZeit(g.start)}) · spart ${eur(sp)} (jetzt ${eur(g.kj)}, dann ${eur(g.kb)})`}; }
    if ((Number(g.u0) || 0) >= (Number(g.kwh) || 1) * 0.8) return {f: 'gruen', wort: 'jetzt', txt: 'jetzt – die Sonne reicht für den ganzen Lauf'};
    // 07.10.2026: unter 0,10 € Ersparnis „egal wann“ statt „billiger wird es nicht“ (widersprach „spart 0,02 €“)
    const spaeter = g.start && (new Date(g.start) - Date.now()) > 30 * 6e4 && sp > 0.005;
    return {f: 'gruen', wort: 'jetzt', txt: spaeter ? `jetzt – egal wann (≈ ${eur(g.kj)}; ${tagVon(g.start)}${uhr(g.start)} wäre nur ${eur(sp)} billiger)` : `jetzt – billiger wird es nicht (≈ ${eur(g.kj)})`};
  }

  const CSS = `
    :host { display: block; }
    ha-card, .karte { padding: 14px 16px 12px; }
    .kopf { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    .titel { font-size: 16px; font-weight: 600; color: var(--primary-text-color, #e5e7eb); }
    .fenster { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--secondary-text-color, #9ca3af); cursor: pointer; background: none; border: 0; padding: 2px 0; font-family: inherit; }
    .fenster svg { width: 18px; height: 18px; flex: none; }
    .reihe { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 12px auto 0; max-width: 560px; }
    .g { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 8px 4px; border-radius: 12px; cursor: pointer; background: none; border: 0; color: inherit; font-family: inherit; min-width: 0; }
    .g:focus-visible { outline: 2px solid var(--primary-color, #60a5fa); outline-offset: 2px; }
    .g.offen { background: rgba(128,128,128,.12); }
    .kreis { width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; border: 2px solid var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); }
    .kreis svg { width: 38px; height: 38px; fill: var(--c); }
    .lauf .kreis { animation: puls 1.8s ease-in-out infinite; }
    .lauf .kreis svg { animation: wackel 2.4s ease-in-out infinite; }
    @keyframes puls { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--c) 55%, transparent); } 60% { box-shadow: 0 0 0 10px color-mix(in srgb, var(--c) 0%, transparent); } }
    @keyframes wackel { 0%, 100% { transform: rotate(0); } 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
    @media (prefers-reduced-motion: reduce) { .lauf .kreis, .lauf .kreis svg { animation: none; } }
    .name { font-size: 12px; color: var(--secondary-text-color, #9ca3af); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .wort { font-size: 14px; font-weight: 600; color: var(--c); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .info { margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: rgba(128,128,128,.10); font-size: 13px; line-height: 1.45; color: var(--primary-text-color, #e5e7eb); }
    .info b { color: var(--c, inherit); }
    .info[hidden] { display: none; }
    .leg { margin-top: 6px; font-size: 11px; color: var(--secondary-text-color, #9ca3af); display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
    .leg i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: 0; }`;

  class VgsWannCard extends HTMLElement {
    constructor() { super(); this.attachShadow({mode: 'open'}); this._offen = null; }
    setConfig(c) { this._cfg = c || {}; }
    getCardSize() { return 3; }
    getGridOptions() { return {columns: 'full', min_rows: 3}; }
    set hass(h) { this._hass = h; const now = Date.now(); if (this._t && now - this._t < 20000 && !this._neu) return; this._t = now; this._neu = false; this._mal(ausHass(h)); }
    set modell(m) { this._modell = m; this._mal(m); }
    connectedCallback() { this._iv = setInterval(() => { this._neu = true; if (this._hass) this.hass = this._hass; else if (this._modell) this._mal(this._modell); }, 60000); }
    disconnectedCallback() { clearInterval(this._iv); }
    _mal(m) {
      if (!m) return;
      const ws = m.geraete.map((g) => ({g, b: bewerte(g)}));
      const f = m.fenster;
      const fTxt = f ? `☀ Gratis-Fenster ${tagVon(f.start)}${uhr(f.start)}–${uhr(f.ende)} · ≈ ${Math.round(f.kwh)} kWh übrig – Akku voll, große Verbraucher dorthin legen`
        : `Kein Gratis-Fenster in Sicht – ${m.maxSoc != null && m.maxZeit ? (m.maxSoc >= 99 ? `Akku wird ${tagVon(m.maxZeit) || 'heute '}voll (≈ ${uhr(m.maxZeit)}), danach bleibt kaum Überschuss` : `Akku kommt ${tagVon(m.maxZeit) || 'heute '}nur bis ≈ ${Math.round(m.maxSoc)} % (${uhr(m.maxZeit)})`) : 'Akku wird voraussichtlich nicht voll'}, jede kWh kostet ungefähr gleich.`;
      const fKurz = f ? `gratis ${tagVon(f.start)}${uhr(f.start)}–${uhr(f.ende)}` : 'kein Gratis-Fenster';
      const fIcon = `<svg viewBox="0 0 24 24" style="fill:${f ? FARBE.gelb : FARBE.grau}"><path d="${f ? ICON.mdiWhiteBalanceSunny : ICON.mdiBatteryOutline}"/></svg>`;
      const offen = this._offen;
      const sel = offen === 'fenster' ? {c: f ? FARBE.gelb : FARBE.grau, html: esc(fTxt)} : (ws.find((x) => x.g.k === offen) || null);
      const infoHtml = !sel ? '' : sel.html ? sel.html : `<b>${esc(sel.g.n)}:</b> ${esc(sel.b.txt)}`;
      const infoC = !sel ? '' : sel.c || FARBE[sel.b.f];
      this.shadowRoot.innerHTML = `<style>${CSS}</style>${this._modell && !this._hass ? '<div class="karte">' : '<ha-card>'}
        <div class="kopf">${this.hasAttribute('ohne-titel') || (this._cfg && this._cfg.titel === false) ? '<span></span>' : '<span class="titel">⏱️ Wann starten?</span>'}
          <button class="fenster" data-k="fenster" title="${esc(fTxt)}">${fIcon}<span>${esc(fKurz)}</span></button></div>
        <div class="reihe">${ws.map(({g, b}) => `<button class="g ${b.f === 'blau' ? 'lauf' : ''} ${offen === g.k ? 'offen' : ''}" data-k="${g.k}" style="--c:${FARBE[b.f]}" title="${esc(g.n + ': ' + b.txt)}" aria-label="${esc(g.n + ': ' + b.txt)}">
            <span class="kreis"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${g.i}"/></svg></span>
            <span class="wort">${esc(b.wort)}</span><span class="name">${esc(g.n)}</span></button>`).join('')}</div>
        <div class="info" style="--c:${infoC}" ${sel ? '' : 'hidden'}>${infoHtml}</div>
        ${this._modell && !this._hass ? '</div>' : '</ha-card>'}`;
      this.shadowRoot.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { this._offen = this._offen === b.dataset.k ? null : b.dataset.k; this._mal(m); }));
    }
  }
  if (!customElements.get('vgs-wann-card')) customElements.define('vgs-wann-card', VgsWannCard);
  window.customCards = window.customCards || [];
  if (!window.customCards.find((c) => c.type === 'vgs-wann-card')) window.customCards.push({type: 'vgs-wann-card', name: 'VGS Wann starten', description: 'Ampel für Waschmaschine, Trockner, Spülmaschine'});
  window.vgsWann = {bewerte, icon: (k) => (GERAETE.find((g) => g.k === k) || {}).i || '', version: 1};
})();

// vgs-hv-card „Hauptverteilung live“ (31.10.2026, Nutzer: Shelly-Liste, Lichterliste und Sicherungen in einer Karte, Skizze UI-Check/skizzen/hv_live.html).
// modus 'voll' (Reiter Bericht): oben Last je Phase (gemessen | Rest), darunter der Kasten wie im Keller (FI-Reihen 1F–5F, je Sicherung eine Kachel:
//   Farbe = Phase aus sensor.sicherungen kreis_phase, Zahl = Leistung jetzt (gemessen + ≈ Schätzung Lichter/Netz), roter Rahmen = sensor.sicherung_ausgeloest
//   oder Widerspruch in sensor.phasen_pruefung). Kachel antippen = Geräteliste des Kreises (Gerät · Art · ⏻ · W · °C · 🛡️ · Quelle), nochmal = zu.
// modus 'phasen' (Übersicht): nur die drei Phasenbalken, antippen = Reiter Bericht. Nur Dashboard, nicht auf der Website (Ausnahme im Abgleich).
// Daten: Shelly/Meross-Geräte aus der Registry (hass.devices/hass.entities, Name = name_by_user|name wie in sicherungen.yaml), Lichter ohne eigenes Gerät
//   aus sensor.lichter_inventar (k = Kreis), feste Zusatzgeräte unten (EXTRA). Temperatur: orange ≥ 65, rot ≥ 70 °C, 🚨 = Alarm der Temperaturwache.
// 01.11.2026 (Nutzer): umgezogen nach Übersicht + PV (vor „PV-Anlage 3D“) und auf die Website; Bericht ohne. Springen behoben: nicht mehr alle 2 s
//   innerHTML neu (Seite schrumpfte kurz → Scrollposition sprang zurück), sondern nur geänderte Knoten anpassen (morph), Klicks per Delegation.
//   Watt ab 5 W als schwarzes Label mit weißem Rahmen; je Kachel „was hängt dran“ (sensor.sicherungen Attribut dran, auch ohne Messung).
//   Website: Eigenschaft `daten` (kueche.json „hv“ = sensor.hv_live: p Phasen, g Geräte [n, k, a, w, est, s], w Warnkreise, kp/kr/dran) statt hass.
(() => {
  const PH = {L1: '#e8a33d', L2: '#4aa3df', L3: '#b07be0', '3p': 'linear-gradient(90deg,#e8a33d 0 33%,#4aa3df 33% 67%,#b07be0 67%)'};
  const KASTEN = [
    ['1F', 'FI 30 mA A', ['1F1', '1F2', '1F3', '1F4']],
    ['2F', 'FI 30 mA A', ['2F1', '2F2', '2F3', '2F4', '2F5', '2F6', '2F7', '2F8']],
    ['3F', 'FI 30 mA A', ['3F1', '3F2', '3F3', '3F4', '3F5', '3F6']],
    ['4F', 'FI 30 mA A', ['4F1', '4F2', '4F3', '4F4', '4F5', '4F6', '4F7', '4F8']],
    ['5F', 'FI 30 mA B', ['5F1', '5F2', '5F3', '5F4', '5F5', '5F6']]];
  const NAME = {'1F2': '3×230 V Hausnr. 45', '1F4': 'Reserve', '2F1': '1.OG Licht & Steckdose', '2F2': '1.OG Bad', '2F3': 'DG Büro', '2F4': 'DG Bad',
    '2F6': 'Reserve', '3F6': 'Reserve', '4F4': 'ehem. Boiler', '5F5': 'Reserve'};
  const AUS = ['1F2', '1F4', '2F6', '3F6', '4F4', '5F5'];
  const DREI = {'1F1': '3p', '3F4': '3p', '5F1': '3p'};
  // Geräte ohne WLAN-Messgerät (Leistung aus Rechen-Sensor oder Helfer, Herkunft Elektro/Hauptverteilung.md)
  const EXTRA = [
    {n: 'Wärmepumpe', k: '5F1', a: 'Gerät', w: 'sensor.wp_leistung_elektrisch_gesamt'},
    {n: 'Heizungstechnik (UVR, Pumpen, Stellantriebe)', k: '5F4', a: 'Gerät', w: 'sensor.heizungstechnik_leistung', s: true},
    {n: 'Daikin Klima (Außengerät + 3 Innengeräte)', k: '5F6', a: 'Gerät', w: 'sensor.klima_leistung_geschatzt', s: true},
    {n: 'Kochfeld + Backofen', k: '3F4', a: 'Gerät', w: 'sensor.kochen_leistung'},
    {n: 'Balkonkraftwerk (Erzeugung)', k: '1F3', a: 'PV', w: 'sensor.em111_bkw_gesamtleistung', pv: true},
    {n: 'Victron (Wechselrichter, Akku)', k: '1F1', a: 'PV'},
    {n: 'Router & Repeater', k: '4F6', a: 'Netz', w: 'input_number.router_w', s: true},
    {n: 'Raspberry Pi', k: '4F8', a: 'Netz', w: 'input_number.pi_w', s: true},
    {n: 'Switch Keller', k: '4F8', a: 'Netz', w: 'input_number.switch_keller_w', s: true},
    {n: 'WLAN-Repeater 1.OG', k: '2F1', a: 'Netz'},
    {n: 'Emil Boombox', k: '2F1', a: 'Gerät', hinweis: '≈ 25 W wenn an'},
    {n: 'Föhn Bad DG', k: '2F4', a: 'Gerät', hinweis: '1,4–1,8 kW wenn an'},
    {n: 'Werkbank', k: '3F1', a: 'Steckdose'},
    {n: 'Klingel', k: '4F1', a: 'Gerät'},
    {n: 'Regelleisten / Stellantriebe FBH', k: '2F7', a: 'Gerät'}];
  const SONDER_W = {'TV Yoga Steckdose': 'sensor.tv_yoga_leistung'};   // Meross ohne Messung, Leistung aus tv_yoga.yaml
  const QUELLE = {t: 'getestet', n: 'laut Nutzer', b: 'Beschriftung'};
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const zahl = (v, n = 0) => Number(v).toLocaleString('de-DE', {minimumFractionDigits: n, maximumFractionDigits: n});
  const watt = (v) => v == null ? '–' : (Math.abs(v) >= 1000 ? `${zahl(v / 1000, 2)} kW` : `${zahl(v, Math.abs(v) < 10 && v % 1 ? 1 : 0)} W`);
  const zahlOder = (s) => { const v = parseFloat(s); return isNaN(v) ? null : v; };
  // nur Geändertes übernehmen (gleiche Knoten bleiben stehen → keine Höhen-Sprünge, Scrollposition bleibt)
  const morph = (a, b) => {
    if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.replaceWith(b.cloneNode(true)); return; }
    if (a.nodeType === 3) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
    if (a.nodeType !== 1) return;
    if (a.id !== 'r') {
      for (const x of [...a.attributes]) if (!b.hasAttribute(x.name)) a.removeAttribute(x.name);
      for (const x of [...b.attributes]) if (a.getAttribute(x.name) !== x.value) a.setAttribute(x.name, x.value);
    }
    const ac = [...a.childNodes], bc = [...b.childNodes];
    bc.forEach((n, i) => { if (i < ac.length) morph(ac[i], n); else a.appendChild(n.cloneNode(true)); });
    for (let i = bc.length; i < ac.length; i++) ac[i].remove();
  };

  const CSS = `
    :host { display: block; }
    ha-card { display: block; padding: 12px 14px; container-type: inline-size; }
    .ph { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .kopf { display: flex; justify-content: space-between; align-items: baseline; }
    .chip { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 12px; font-weight: 700; color: #111; }
    .ph b { font-size: 18px; font-weight: 500; }
    .bar { height: 10px; border-radius: 5px; background: rgba(128,128,128,.18); overflow: hidden; display: flex; margin: 5px 0 3px; }
    .bar i { display: block; height: 100%; }
    .bar i.r { background: repeating-linear-gradient(45deg, rgba(150,150,150,.55) 0 4px, rgba(110,110,110,.45) 4px 8px); }
    .mut { color: var(--secondary-text-color); font-size: 12px; }
    .phasen { cursor: pointer; }
    .reihe { display: grid; grid-template-columns: 92px 1fr; gap: 10px; padding: 8px 0; border-top: 1px solid var(--divider-color); }
    .fi { color: var(--secondary-text-color); font-size: 12px; display: flex; flex-direction: column; justify-content: center; border-right: 3px solid var(--divider-color); padding-right: 8px; }
    .fi b { color: var(--primary-text-color); font-size: 15px; }
    .ls { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 8px; }
    .k { background: rgba(128,128,128,.08); border: 1px solid var(--divider-color); border-left: 4px solid var(--c); border-radius: 8px; padding: 6px 8px; min-height: 72px;
         cursor: pointer; position: relative; -webkit-tap-highlight-color: transparent; }
    .k .nr { font-weight: 600; }
    .k .lb { color: var(--secondary-text-color); font-size: 11.5px; line-height: 1.25; height: 29px; overflow: hidden; }
    .k .w { font-size: 15px; font-weight: 500; margin-top: 2px; white-space: nowrap; }
    .k .w small { color: var(--secondary-text-color); font-weight: 400; font-size: 11px; }
    .k .w .lbl { background: #000; color: #fff; border: 1px solid #fff; border-radius: 6px; padding: 0 6px; }
    .k .dr { color: var(--secondary-text-color); font-size: 10.5px; line-height: 1.25; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .det .dr2 { color: var(--secondary-text-color); font-size: 12.5px; margin-top: 4px; }
    .k .pc { position: absolute; top: 6px; right: 7px; font-size: 10.5px; font-weight: 700; color: var(--c); }
    .k.drei { border-left-color: transparent; background: linear-gradient(to bottom,#e8a33d 0 33%,#4aa3df 33% 67%,#b07be0 67%) left / 4px 100% no-repeat border-box, rgba(128,128,128,.08); }
    .k.drei.sel { background: linear-gradient(to bottom,#e8a33d 0 33%,#4aa3df 33% 67%,#b07be0 67%) left / 4px 100% no-repeat border-box, rgba(128,128,128,.16); }
    .k.aus { opacity: .38; }
    .k.sel { outline: 2px solid var(--c); background: rgba(128,128,128,.16); }
    /* Bezug-Stufen (01.11.2026, Nutzer): Hintergrund in Phasenfarbe, ab 20 / 200 / 1000 W */
    .k.s1, .k.drei.sel.s1 { background-color: color-mix(in srgb, var(--c) 14%, transparent); }
    .k.s2, .k.drei.sel.s2 { background-color: color-mix(in srgb, var(--c) 28%, transparent); }
    .k.s3, .k.drei.sel.s3 { background-color: color-mix(in srgb, var(--c) 45%, transparent); }
    .k.warn { border-color: var(--error-color, #e5534b); box-shadow: 0 0 0 1px var(--error-color, #e5534b) inset; }
    .det { margin: 4px 0 6px; border-top: 1px solid var(--divider-color); padding-top: 8px; }
    .det .t { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 13.5px; margin-top: 6px; }
    th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--divider-color); }
    th { color: var(--secondary-text-color); font-weight: 500; font-size: 12px; }
    td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    td.q { color: var(--secondary-text-color); font-size: 12px; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: 1px; }
    .leg { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; }
    @container (max-width: 700px) {
      .ph { grid-template-columns: 1fr; gap: 8px; }
      .reihe { grid-template-columns: 1fr; gap: 6px; }
      .fi { border-right: 0; flex-direction: row; gap: 8px; align-items: baseline; padding: 0; }
      .ls { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .k { min-height: 56px; } .k .lb, .k .dr { display: none; } .k .w small { display: block; margin-top: -2px; }
      .breit { display: none; }
    }
    @container (min-width: 701px) and (max-width: 1000px) { .ls { grid-template-columns: repeat(4, minmax(0, 1fr)); } }`;

  class VgsHvCard extends HTMLElement {
    constructor() {
      super(); this.attachShadow({mode: 'open'}); this._sel = null; this._t = 0;
      this.shadowRoot.addEventListener('click', (ev) => {
        const pfad = ev.composedPath();
        if ((this._cfg || {}).modus === 'phasen') {
          history.pushState(null, '', this._cfg.ziel || '/dashboard-heizung/bericht');
          window.dispatchEvent(new CustomEvent('location-changed', {detail: {replace: false}})); return;
        }
        const k = pfad.find((e) => e.classList && e.classList.contains('k')); if (!k) return;
        this._sel = this._sel === k.dataset.k ? null : k.dataset.k;
        try { if (this._sel) localStorage.setItem('vgsHvSel', this._sel); else localStorage.removeItem('vgsHvSel'); } catch (x) { /* egal */ }
        this._alt = null; this._mal();
      });
    }
    // Website: Schnappschuss statt hass (kein Registry-Zugriff)
    set daten(d) { this._d = d; if (!this._cfg) this._cfg = {}; this._mal(); }
    setConfig(c) {
      this._cfg = c || {};
      try { this._sel = localStorage.getItem('vgsHvSel') || null; } catch (e) { /* ohne Speicher */ }
    }
    getCardSize() { return this._cfg && this._cfg.modus === 'phasen' ? 2 : 10; }
    getGridOptions() { return {columns: 'full'}; }
    set hass(h) {
      this._hass = h;
      const jetzt = Date.now();
      if (jetzt - this._t < 2000) { if (!this._warte) this._warte = setTimeout(() => { this._warte = null; this._t = Date.now(); this._mal(); }, 2000); return; }
      this._t = jetzt; this._mal();
    }

    _phasen() {
      if (this._d) return (this._d.p || []).map((x, i) => ({L: 'L' + (i + 1), g: x[0], r: x[1]}));
      const st = this._hass.states, v = (e) => zahlOder((st[e] || {}).state);
      return [1, 2, 3].map((i) => ({L: 'L' + i, g: v('sensor.venus_verbrauchsleistung_l' + i), r: v('sensor.rest_phase_l' + i)}));
    }

    _geraete() {
      if (this._d) return (this._d.g || []).map((x) => ({n: x[0], k: x[1], a: x[2], w: x[3], est: !!x[4], s: x[5] || '', q: x[6] || 't', hinweis: x[7] || null, t: null, off: false}));
      const h = this._hass, st = h.states, at = (e, a) => (st[e] || {attributes: {}}).attributes[a];
      const SG = at('sensor.sicherungen', 'geraete') || {};
      const AL = (at('sensor.shelly_temperaturwache', 'alarme') || []).map((x) => x.e);
      const B = at('sensor.shelly_temperaturwache', 'basis') || {};
      const proDev = {};
      for (const [eid, e] of Object.entries(h.entities || {})) {
        if (!e.device_id || !['shelly', 'meross_lan'].includes(e.platform)) continue;
        (proDev[e.device_id] = proDev[e.device_id] || []).push(eid);
      }
      const liste = [], belegt = new Set();
      for (const [did, es] of Object.entries(proDev)) {
        const d = (h.devices || {})[did] || {};
        const n = String(d.name_by_user || d.name || '').trim();
        const sg = SG[n];
        if (!sg || sg[1] === 'f') continue;
        const pw = es.find((x) => x.startsWith('sensor.') && (st[x] || {attributes: {}}).attributes.device_class === 'power');
        const tp = es.find((x) => /^sensor\..*_temperatur$/.test(x));
        const sw = es.find((x) => /^(switch|light|cover)\./.test(x) && !/_(dnd|config)/.test(x));
        const sch = es.filter((x) => /^binary_sensor\..*_(u|ue)ber(hitzung|last|strom|spannung)$/.test(x));
        const da = es.filter((x) => st[x]);
        const off = da.length > 0 && da.every((x) => st[x].state === 'unavailable');
        const wE = SONDER_W[n] || pw;
        es.forEach((x) => belegt.add(x));
        liste.push({n: n.replace(/ Shelly$/, ''), k: sg[0], q: sg[1], a: /^RL |PMG/.test(n) ? 'Fühler' : (/Fenster/.test(n) ? 'Fenster' : 'Gerät'),
          w: wE ? zahlOder((st[wE] || {}).state) : null, s: sw ? st[sw] && st[sw].state : '', t: tp ? zahlOder((st[tp] || {}).state) : null,
          tn: tp ? B[tp] : null, alarm: tp && AL.includes(tp), sch: sch.length ? sch.some((x) => (st[x] || {}).state === 'on') : null, off, _es: es});
      }
      // Lichter: Gerät schon in der Liste → Art „Licht“ + Schätzwert, sonst eigene Zeile (nicht smart / ohne WLAN-Gerät)
      const inv = at('sensor.lichter_inventar', 'liste') || [];
      for (const x of inv) {
        const eid = x.a === 'm' ? x.q : x.e;
        const dev = eid && belegt.has(eid) ? liste.find((y) => y._es && y._es.includes(eid)) : null;
        if (dev) { dev.a = 'Licht'; if (dev.w == null && x.jw != null) { dev.w = x.jw; dev.est = true; } continue; }
        if (!x.k) continue;
        liste.push({n: x.n.replace(/ \(< 10 W, kein Sprung\)$/, ''), k: x.k, q: 't', a: 'Licht', w: x.an == null ? null : x.jw, est: x.a !== 'm', an: x.an,
          hinweis: x.an == null && x.w ? `≈ ${zahl(x.w)} W wenn an` : null,
          s: x.an === true ? 'on' : (x.an === false ? 'off' : ''), wAn: x.w, t: null, off: false});
      }
      for (const x of EXTRA) {
        const v = x.w ? zahlOder((st[x.w] || {}).state) : null;
        liste.push({n: x.n, k: x.k, q: 't', a: x.a, w: x.pv && v != null ? -v : v, est: !!x.s, hinweis: x.hinweis, t: null, off: false, s: ''});
      }
      return liste;
    }

    _warn() {
      if (this._d) return new Set(this._d.w || []);
      const st = this._hass.states, w = new Set();
      ((st['sensor.sicherung_ausgeloest'] || {attributes: {}}).attributes.alarme || []).forEach((a) => w.add(a.kreis));
      const pp = (st['sensor.phasen_pruefung'] || {}).state || 'ok';
      if (pp !== 'ok') (pp.match(/Kreis (\d+F\d+)/g) || []).forEach((m) => w.add(m.slice(6)));
      return w;
    }

    _mal() {
      if (!this._hass && !this._d) return;
      const st = this._d ? {} : this._hass.states;
      const at = (e, a) => (this._d && e === 'sensor.sicherungen') ? ({kreis_phase: this._d.kp, kreise: this._d.kr, dran: this._d.dran}[a]) : (st[e] || {attributes: {}}).attributes[a];
      const modus = this._cfg.modus || 'voll';
      const P = this._phasen(), mx = Math.max(...P.map((p) => p.g || 0), 1) * 1.08;
      const phHtml = `<div class="ph">${P.map((p) => {
        const r = Math.max(p.r || 0, 0), m = Math.max((p.g || 0) - r, 0);
        return `<div><div class="kopf"><span class="chip" style="background:${PH[p.L]}">${p.L}</span><b>${watt(p.g)}</b></div>
          <div class="bar"><i style="width:${m / mx * 100}%;background:${PH[p.L]}"></i><i class="r" style="width:${r / mx * 100}%"></i></div>
          <div class="mut">gemessen ${watt(m)} · Rest ${watt(r)}</div></div>`;
      }).join('')}</div>`;
      let html;
      if (modus === 'phasen') {
        html = `<ha-card class="phasen">${this._cfg.titel ? `<div class="mut" style="margin-bottom:6px">${esc(this._cfg.titel)}</div>` : ''}${phHtml}</ha-card>`;
      } else {
        const G = this._geraete(), KP = at('sensor.sicherungen', 'kreis_phase') || {}, KR = at('sensor.sicherungen', 'kreise') || {}, W = this._warn();
        const DR = at('sensor.sicherungen', 'dran') || {}; this._dran = DR;
        let hv = '';
        for (const [fi, txt, ls] of KASTEN) {
          hv += `<div class="reihe"><div class="fi"><b>${fi}</b><span>${txt}</span></div><div class="ls">`;
          for (const k of ls) {
            const p = DREI[k] || KP[k] || '', g = G.filter((x) => x.k === k || (x.k === '4F6 + 4F8' && k === '4F6'));
            const summe = g.reduce((s, x) => s + (x.w > 0 ? x.w : 0), 0), est = g.some((x) => x.est && x.w > 0);
            const aus = AUS.includes(k), c = p === '3p' ? 'var(--primary-text-color)' : (p ? PH[p] : 'rgba(128,128,128,.5)');
            const st = aus ? 0 : summe >= 1000 ? 3 : summe >= 200 ? 2 : summe >= 20 ? 1 : 0;
            hv += `<div class="k${st ? ' s' + st : ''}${p === '3p' ? ' drei' : ''}${aus ? ' aus' : ''}${this._sel === k ? ' sel' : ''}${W.has(k) ? ' warn' : ''}" style="--c:${c}" data-k="${k}">
              <span class="pc">${p || '?'}</span><div class="nr">${k}</div><div class="lb">${esc(NAME[k] || KR[k] || '')}</div>
              <div class="w">${aus ? 'aus' : (g.length ? (summe >= 5 ? `<span class="lbl">${est ? '≈ ' : ''}${watt(summe)}</span>` : (est ? '≈ ' : '') + watt(summe)) : '–')} <small>${g.length ? g.length + ' Ger.' : ''}</small></div>
              ${DR[k] ? `<div class="dr" title="${esc(DR[k])}">${esc(DR[k])}</div>` : ''}</div>`;
          }
          hv += '</div></div>';
          if (ls.includes(this._sel)) hv += this._detail(this._sel, G, KP, KR, W);
        }
        html = `<ha-card>${phHtml}
          <div class="leg mut"><span><span class="dot" style="background:var(--primary-text-color)"></span>gemessen (Shelly/Meross/≈ Schätzung)</span><span><span class="dot" style="background:rgba(140,140,140,.6)"></span>Rest – ungemessen</span></div>
          <div style="margin-top:8px">${hv}</div>
          <div class="mut" style="margin-top:6px">Farbe = Phase (L1 orange · L2 blau · L3 lila · 3p dreifarbig · grau = Phase unbekannt) · Hintergrund = Bezug (ab 20 W leicht, ab 200 W mittel, ab 1 kW kräftig) · roter Rahmen = Sicherung ausgelöst? oder Phase ≠ Sicherung · blass = Reserve/aus · ≈ = Schätzwert · Zahl im schwarzen Feld = zieht gerade ≥ 5 W · grauer Text = was am Kreis hängt (auch ungemessen) · Kachel antippen = Geräte${this._d ? ' · Stand ' + esc(this._d.t || '') : ''} · Quelle: Elektro/Hauptverteilung.md → sensor.sicherungen</div>
        </ha-card>`;
      }
      if (html === this._alt) return;
      this._alt = html;
      let wurzel = this.shadowRoot.getElementById('r');
      if (!wurzel) { this.shadowRoot.innerHTML = `<style>${CSS}</style><div id="r">${html}</div>`; return; }
      const neu = document.createElement('div'); neu.innerHTML = html;
      morph(wurzel, neu);
    }

    _detail(k, G, KP, KR, W) {
      const p = DREI[k] || KP[k] || '?';
      const g = G.filter((x) => x.k === k || (x.k === '4F6 + 4F8' && k === '4F6')).sort((a, b) => (b.w || 0) - (a.w || 0) || a.n.localeCompare(b.n, 'de'));
      const pp = (this._hass.states['sensor.phasen_pruefung'] || {}).state || 'ok';
      let t = `<div class="det"><span class="t">${k} · ${esc(NAME[k] || KR[k] || '')}</span> <span class="chip" style="background:${PH[p] || '#888'}">${p}</span>
        ${W.has(k) ? `<span class="mut" style="color:var(--error-color)"> · ⚠️ ${esc(pp !== 'ok' ? pp : 'Sicherung ausgelöst?')}</span>` : ''}
        ${(this._dran || {})[k] ? `<div class="dr2">dran: ${esc(this._dran[k])}</div>` : ''}
        <table><tr><th>Gerät</th><th class="breit">Art</th><th>⏻</th><th class="n">jetzt</th><th class="n">°C</th><th class="breit">🛡️</th><th class="breit">Quelle</th></tr>`;
      if (!g.length) t += `<tr><td colspan="7" class="q">kein Gerät bekannt</td></tr>`;
      for (const x of g) {
        const on = x.off ? '❌' : (x.s === 'on' ? '<span class="dot" style="background:#3fb950"></span>an' : (x.s === 'off' ? '<span class="dot" style="background:#6b7280"></span>aus' : (x.s === 'open' || x.s === 'closed' ? esc(x.s === 'open' ? 'offen' : 'zu') : '')));
        const tf = x.t == null ? '' : (x.t >= 70 ? 'color:#ef4444;font-weight:600' : (x.t >= 65 ? 'color:#f59e0b;font-weight:600' : ''));
        const tt = x.t == null ? '' : `<span style="${tf}" title="${x.tn != null ? 'normal ' + Math.round(x.tn) + ' °C' : ''}">${zahl(x.t, 1)}</span>${x.alarm ? ' 🚨' : ''}`;
        const w = x.w == null ? (x.hinweis ? `<span class="mut">${esc(x.hinweis)}</span>` : '–') : ((x.est ? '≈ ' : '') + watt(x.w));
        t += `<tr><td>${esc(x.n)}</td><td class="breit q">${esc(x.a)}</td><td>${on}</td><td class="n">${w}</td><td class="n">${tt}</td>
          <td class="breit">${x.sch == null ? '' : (x.sch ? '⚠️' : '✓')}</td><td class="breit q">${QUELLE[x.q] || ''}</td></tr>`;
      }
      return t + '</table></div>';
    }
  }
  if (!customElements.get('vgs-hv-card')) customElements.define('vgs-hv-card', VgsHvCard);
  window.customCards = window.customCards || [];
  if (!window.customCards.find((c) => c.type === 'vgs-hv-card')) window.customCards.push({type: 'vgs-hv-card', name: 'VGS Hauptverteilung live', description: 'Sicherungen, Phasen und Geräte live'});
})();

// vgs-kennzahlen-card (22.10.2026, Nutzer: Tabellen „catchy“ ergänzen) – drei Teile, Daten aus sensor.web_texte_warme (web_texte.yaml):
//   teil: kacheln → 4 große Zahlen (Energie −%, Primärenergie −%, € gespart, AZ Heizen) aus Attribut kpi
//   teil: faktor  → „Aus 1 kWh Strom wird …“: Flammen je Wärmeerzeuger (CHA-07 Heizen/WW, BWWP, früher Gas) aus kpi.faktor
//   teil: start   → Startkachel Übersicht (12.11.2026, Nutzer „Variante A“): links Wärme (1 ⚡ → AZ 🔥 + Balken je Erzeuger), rechts Strom (☀ Anteil Sonne seit Messbeginn + Balken je Verbraucher), Leiste −% / € / Raum
//   teil: punkte  → Punktwolke AZ ↔ Außentemperatur je WP-Lauf (Größe = Wärme, blau = mit Warmwasser) + Trendlinie Heizläufe, Attribut punkte
// Gleiche Datei auf der Website (anzeige/lib/vgs_kennzahlen.js, hass-Ersatz aus verlauf.json fw). Touch-Regel: Tippen = Tooltip auf, nochmal = zu.
(() => {
  const FLAMME = 'M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z';   // mdi:fire
  const BLITZ = 'M11 15H6L13 1V9H18L11 23V15Z';   // mdi:flash
  const SONNE = 'M11.45,2V5.55L15,3.77L11.45,2M10.45,8L8,10.46L11.75,11.71L10.45,8M2,11.45L3.77,15L5.55,11.45H2M10,2H2V10C2.57,10.17 3.17,10.25 3.77,10.25C7.35,10.26 10.26,7.35 10.27,3.75C10.26,3.16 10.17,2.57 10,2M17,22V16H14L19,7V13H22L17,22Z';   // mdi:solar-power (Energiefluss)
  const HAUS = 'M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z';   // mdi:home
  const WP = 'M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3M12.75 7.08C13.57 7.2 14.32 7.5 14.95 8L12.75 10.19V7.08M11.25 7.08V10.19L9.05 8C9.68 7.5 10.43 7.2 11.25 7.08M8 9.05L10.19 11.25H7.08C7.2 10.43 7.5 9.68 8 9.05M7.08 12.75H10.19L8 14.95C7.5 14.32 7.2 13.57 7.08 12.75M11.25 16.92C10.43 16.8 9.68 16.5 9.05 16L11.25 13.81V16.92M12 13C11.45 13 11 12.55 11 12S11.45 11 12 11 13 11.45 13 12 12.55 13 12 13M12.75 16.92V13.81L14.95 16C14.32 16.5 13.57 16.8 12.75 16.92M16 14.95L13.81 12.75H16.92C16.8 13.57 16.5 14.32 16 14.95M13.81 11.25L16 9.05C16.5 9.69 16.8 10.44 16.92 11.25H13.81Z';   // mdi:heat-pump
  const zahl = (v, d = 1) => v === null || v === undefined || isNaN(v) ? '–' : Number(v).toFixed(d).replace('.', ',');
  const tsd = (v) => Math.round(v).toLocaleString('de-DE');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const STIL = `<style>
    :host{display:block} ha-card{display:block;padding:14px;box-sizing:border-box;height:100%;position:relative;container-type:inline-size}
    .k{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
    @container (max-width:560px){.k{grid-template-columns:repeat(2,1fr)}}
    .kc{background:rgba(255,255,255,.04);border-radius:12px;padding:12px 10px;text-align:center}
    .kz{font:600 30px/1.1 sans-serif;color:#4ade80;letter-spacing:-.5px;white-space:nowrap} .kz.n{color:var(--primary-text-color)}
    .kl{font-size:14px;color:var(--primary-text-color);margin-top:4px} .ks{font-size:11.5px;color:var(--secondary-text-color);margin-top:2px;text-wrap:balance}
    .fk{font-size:13px;color:var(--secondary-text-color);margin:0 0 8px}
    .fr{display:grid;grid-template-columns:minmax(120px,190px) 22px 1fr 46px;align-items:center;gap:8px;padding:6px 0;border-top:1px solid rgba(255,255,255,.06)}
    .fr:first-of-type{border-top:none} .fn{font-size:13.5px;color:var(--primary-text-color)} .fn small{display:block;font-size:11px;color:var(--secondary-text-color)}
    .fl{display:flex;gap:1px;flex-wrap:nowrap;overflow:hidden} .fl svg,.bz{width:22px;height:22px;flex:none;display:block}
    .fv{font:600 20px sans-serif;text-align:right;color:var(--primary-text-color)}
    @container (max-width:480px){.fr{grid-template-columns:1fr 46px;row-gap:2px}.fr .bz{display:none}.fl{grid-column:1/3;order:3}.fl svg{width:19px;height:19px}}
    .p svg{display:block;width:100%;height:auto;overflow:visible} .p .pt{cursor:pointer}
    .ax{font:11px sans-serif;fill:#9ca3af} .gl{stroke:rgba(255,255,255,.08)}
    .lg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--secondary-text-color);margin-top:6px}
    .lg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}
    .kc[data-k],.kc2[data-k]{cursor:help} .kl .i{font-size:12px;color:var(--secondary-text-color);margin-left:4px;vertical-align:1px}
    .st{display:grid;grid-template-columns:1fr 1fr;gap:12px} @container (max-width:720px){.st{grid-template-columns:1fr}}
    .sh{background:rgba(255,255,255,.04);border-radius:12px;padding:14px 16px;display:grid;gap:10px;align-content:start;min-width:0}
    .sk{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font:600 26px/1.1 sans-serif;letter-spacing:-.3px} .sk svg{width:26px;height:26px;flex:none}
    .sk .pf{color:var(--secondary-text-color);font-weight:400} .sk .kl2{font:400 14px sans-serif;color:var(--secondary-text-color)}
    .sk .fls{display:inline-flex;gap:0} .sk .fls svg{width:22px;height:22px}
    .su{font-size:12px;color:var(--secondary-text-color);margin-top:-4px}
    .sb{display:grid;gap:6px}
    .sr{display:grid;grid-template-columns:minmax(0,150px) 1fr 40px;gap:8px;align-items:center;font-size:12.5px}
    .sr .n{color:var(--secondary-text-color);display:flex;gap:5px;align-items:center;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} .sr .n svg{width:15px;height:15px;flex:none}
    .sr .b{height:11px;border-radius:6px;background:rgba(255,255,255,.08);display:flex;overflow:hidden} .sr .b i{height:100%}
    .sr .v{text-align:right;font-weight:600;color:var(--primary-text-color)}
    @container (max-width:400px){.sr{grid-template-columns:1fr 40px}.sr .b{grid-column:1/-1;grid-row:2}}
    .sl{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--secondary-text-color)} .sl i{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px;vertical-align:-1px}
    .sx{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:rgba(255,255,255,.07);border-radius:12px;overflow:hidden;margin-top:12px}
    .sx>div{background:var(--ha-card-background,var(--card-background-color,#1c1c1c));padding:9px 12px;min-width:0} .sx .z{font:600 19px sans-serif;color:#4ade80} .sx .z.n{color:var(--primary-text-color)} .sx .l{font-size:11.5px;color:var(--secondary-text-color)}
    @container (max-width:560px){.sx{grid-template-columns:repeat(2,1fr)}}
    .tip.w{white-space:normal;width:min(300px,calc(100% - 16px));line-height:1.4;font-size:12.5px}
    .tip{position:absolute;background:rgba(17,17,17,.95);border:1px solid #444;border-radius:8px;padding:6px 9px;font-size:12px;color:#e5e7eb;pointer-events:none;white-space:nowrap;display:none;z-index:2}
  </style>`;
  class VgsKennzahlen extends HTMLElement {
    setConfig(c) { this._c = { entity: 'sensor.web_texte_warme', teil: 'kacheln', ...c }; if (!this.shadowRoot) this.attachShadow({ mode: 'open' }); if (this.isConnected) this.connectedCallback(); }
    getCardSize() { return this._c?.teil === 'punkte' ? 6 : this._c?.teil === 'start' ? 5 : 3; }
    getGridOptions() { return { columns: 'full', rows: 'auto' }; }
    connectedCallback() {   // Punktwolke bei Breitenänderung (Drehen, Fenster) neu zeichnen
      if (this._ro || this._c?.teil !== 'punkte') return;
      this._ro = new ResizeObserver(() => { const b = Math.round(this.getBoundingClientRect().width); if (this._d && b && Math.abs(b - (this._br || 0)) > 30) this._zeichne(); }); this._ro.observe(this);
    }
    disconnectedCallback() { this._ro?.disconnect(); this._ro = null; }
    set hass(h) {
      const st = h.states[this._c.entity]; if (!st) return;
      if (this._c.teil === 'start') { const r = h.states['sensor.ht_wohnzimmer_temperatur']?.state, o = h.states['sensor.cmi_t_aussen']?.state; this._raum = [r, o]; }
      const a = st.attributes, d = this._c.teil === 'punkte' ? a.punkte : a.kpi, key = JSON.stringify(d) + (this._c.teil === 'start' ? JSON.stringify(this._raum) : '');
      if (!d || key === this._key) return; this._key = key; this._d = typeof d === 'string' ? JSON.parse(d) : d; this._zeichne();
    }
    _zeichne() {
      const t = this._c.teil, d = this._d; let h = '';
      if (t === 'kacheln') {
        const k = (z, l, s, neutral, ik) => `<div class="kc"${ik ? ` data-k="${ik}"` : ''}><div class="kz${neutral ? ' n' : ''}">${z}</div><div class="kl">${l}${ik ? '<span class="i">ⓘ</span>' : ''}</div><div class="ks">${[].concat(s).join('<br>')}</div></div>`;   // Untertitel als Zeilen-Liste, Klammern ohne Umbruch (22.10.2026, Nutzer: keine Waisenwörter)
        h = `<div class="k">${k('−' + zahl(d.energie, 0) + ' %', 'Energie im Jahr', ['heute gegenüber&nbsp;früher', '(Gas&nbsp;+&nbsp;Strom)'], false, 'energie')}
          ${k('−' + zahl(d.pe, 0) + ' %', 'Primärenergie', ['seit ' + esc(d.seit), 'GEG-Faktoren'], false, 'pe')}
          ${k(tsd(d.eur) + ' €', 'gespart', d.tage_eur ? ['in ' + d.tage_eur + ' Tagen', 'gegenüber&nbsp;früher <span style="white-space:nowrap">(Gas + Netzstrom)</span>'] : ['seit ' + esc(d.seit_eur || d.seit) + ' gegenüber&nbsp;früher', '(Gas&nbsp;+&nbsp;Netzstrom)'], false, 'eur')}
          ${k(zahl(d.az_heiz), 'Arbeitszahl Heizen', ['Luft/Wasser‑WP', d.n_heiz + ' Läufe'], true, 'az')}</div>`;
      } else if (t === 'start') {
        const ic = (p, f, c = '') => `<svg viewBox="0 0 24 24"${c}><path d="${p}" fill="${f}"/></svg>`;
        const az = d.az_heiz, F = (d.faktor || []).filter((x) => typeof x[1] === 'number'), mx = Math.max(...F.map((x) => x[1]), 1);
        let fl = ''; const voll = Math.floor(Math.min(az || 0, 8)), rest = Math.min(az || 0, 8) - voll;
        for (let j = 0; j < voll; j++) fl += ic(FLAMME, '#f97316');
        if (rest > 0.05) fl += `<svg viewBox="0 0 24 24"><defs><clipPath id="sc"><rect x="0" y="0" width="${(24 * rest).toFixed(1)}" height="24"/></clipPath></defs><path d="${FLAMME}" fill="#f97316" opacity=".25"/><path d="${FLAMME}" fill="#f97316" clip-path="url(#sc)"/></svg>`;
        const kurz = (n) => n.replace('Wärmepumpe CHA-07 – Heizen', 'WP Heizen').replace('Wärmepumpe CHA-07 – Warmwasser laden', 'WP Warmwasser').replace('Daikin Klima (Luft/Luft) – Heizen', 'Daikin Heizen').replace('früher: Gas-Brennwertkessel', 'früher Gas').replace('Brauchwasser-Wärmepumpe', 'Brauchwasser-WP');
        const zeile = (n, sym, segs, v, grau) => `<div class="sr"><span class="n"${grau ? ' style="opacity:.8"' : ''}>${sym}${esc(n)}</span><span class="b">${segs}</span><span class="v"${grau ? ' style="color:var(--secondary-text-color)"' : ''}>${v}</span></div>`;
        const wb = F.map(([n, v]) => { const gas = /Gas/.test(n), k = kurz(n);
          return zeile(k, gas ? ic(FLAMME, '#9ca3af') : /^WP/.test(k) ? ic(WP, '#9ca3af') : '', `<i style="width:${(v / mx * 100).toFixed(1)}%;background:${gas ? '#64748b' : 'linear-gradient(90deg,#f97316,#facc15)'}"></i>`, zahl(v), gas); }).join('');
        const S = d.strom || {}, sb = (n, sym, p) => p === null || p === undefined ? '' : zeile(n, sym, `<i style="width:${p}%;background:#facc15"></i><i style="width:${100 - p}%;background:#94a3b8"></i>`, zahl(p, 0) + ' %');
        const [raum, aus] = this._raum || [];
        h = `<div class="st">
          <div class="sh"><div class="sk"><span style="color:#facc15">1</span>${ic(BLITZ, '#facc15')}<span class="pf">→</span><span style="color:#fb923c">${zahl(az)}</span><span class="fls">${fl}</span></div>
            <div class="su">aus 1 kWh Strom so viel Wärme · WP Heizen, ${d.n_heiz} Läufe${d.az_seit ? ' seit ' + esc(d.az_seit) : ''}</div>
            <div class="sb">${wb}</div></div>
          <div class="sh"><div class="sk">${ic(SONNE, '#facc15')}<span style="color:#facc15">${zahl(S.aut, 0)} %</span><span class="kl2">vom Strom aus der Sonne</span></div>
            <div class="su">${tsd(S.sonne || 0)} von ${tsd(S.haus || 0)} kWh seit ${esc(d.seit)} (direkt + Akku) · früher 0 %</div>
            <div class="sb">${sb('Haus gesamt', ic(HAUS, '#9ca3af'), S.aut)}${sb('WP', ic(WP, '#9ca3af'), S.wp)}${sb('Brauchwasser-WP', '', S.bwwp)}</div>
            <div class="sl"><span><i style="background:#facc15"></i>Sonne (direkt + Akku)</span><span><i style="background:#94a3b8"></i>Netz</span></div></div>
        </div>
        <div class="sx">
          <div class="kc2" data-k="energie"><div class="z">−${zahl(d.energie, 0)} %</div><div class="l">Energie im Jahr ⓘ</div></div>
          <div class="kc2" data-k="pe"><div class="z">−${zahl(d.pe, 0)} %</div><div class="l">Primärenergie ⓘ</div></div>
          <div class="kc2" data-k="eur"><div class="z">${tsd(d.eur)} €</div><div class="l">gespart · ${d.tage_eur || ''} Tage ⓘ</div></div>
          <div><div class="z n">${raum && !isNaN(raum) ? zahl(+raum) + ' °C' : '–'}</div><div class="l">drinnen${aus && !isNaN(aus) ? ' · ' + zahl(+aus) + ' °C draußen' : ''}</div></div>
        </div>`;
      } else if (t === 'faktor') {
        const max = 8, rows = (d.faktor || []).map(([n, v, s], i) => {
          const gas = /Gas/.test(n), farbe = gas ? '#9ca3af' : i < 2 ? '#f97316' : '#fb923c';
          let fl = ''; const voll = Math.floor(Math.min(v || 0, max)), rest = Math.min(v || 0, max) - voll;
          for (let j = 0; j < voll; j++) fl += `<svg viewBox="0 0 24 24"><path d="${FLAMME}" fill="${farbe}"/></svg>`;
          if (rest > 0.05) fl += `<svg viewBox="0 0 24 24"><defs><clipPath id="c${i}"><rect x="0" y="0" width="${(24 * rest).toFixed(1)}" height="24"/></clipPath></defs><path d="${FLAMME}" fill="${farbe}" opacity=".25"/><path d="${FLAMME}" fill="${farbe}" clip-path="url(#c${i})"/></svg>`;
          const quelle = gas ? `<svg class="bz" viewBox="0 0 24 24"><path d="${FLAMME}" fill="#9ca3af"/></svg>` : `<svg class="bz" viewBox="0 0 24 24"><path d="${BLITZ}" fill="#facc15"/></svg>`;
          return `<div class="fr"><div class="fn">${esc(n)}<small>${esc(s)}</small></div>${quelle}<div class="fl">${fl}</div><div class="fv">${zahl(v)}</div></div>`;
        }).join('');
        h = `<div class="fk">Aus <b style="color:#facc15">1 kWh Strom</b> (früher: 1 kWh Gas) wird so viel Wärme – je Flamme 1 kWh:</div>${rows}`;
      } else {
        h = this._punkte(d);
      }
      this.shadowRoot.innerHTML = STIL + `<ha-card>${this._c.titel ? `<div class="fk">${esc(this._c.titel)}</div>` : ''}${h}<div class="tip"></div></ha-card>`;
      if (t === 'punkte') this._tips();
      if (t === 'kacheln' || t === 'start') this._infos();
    }
    _punkte(P) {
      if (!P.length) return '<div class="fk">noch keine Läufe</div>';
      // in echter Breite zeichnen (Schrift bleibt lesbar, iPhone), Höhe ~40 % der Breite
      const br = Math.round(this.getBoundingClientRect().width) || 600; this._br = br;
      const W = Math.max(300, Math.min(br - 28, 1100)), H = W < 500 ? 230 : Math.min(340, Math.round(W * 0.4)), L = 34, R = 10, O = 10, U = 30;
      const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
      let x0 = Math.floor(Math.min(...xs) - 1), x1 = Math.ceil(Math.max(...xs) + 1); if (x1 - x0 < 15) { const m = (x0 + x1) / 2; x0 = Math.floor(m - 7.5); x1 = Math.ceil(m + 7.5); }
      // y-Achse nicht ab 0 (22.10.2026): sonst kleben alle Punkte oben – Bereich = Daten ± 1, mindestens 4 AZ-Stufen
      let y0 = Math.max(0, Math.floor(Math.min(...ys)) - 1), y1 = Math.ceil(Math.max(...ys)) + 1; if (y1 - y0 < 4) y0 = Math.max(0, y1 - 4);
      const X = (v) => L + (v - x0) / (x1 - x0) * (W - L - R), Y = (v) => O + (1 - (v - y0) / (y1 - y0)) * (H - O - U);
      let g = '';
      for (let v = y0; v <= y1; v += 1) g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${L - 6}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
      const sx = (x1 - x0) > 24 ? 5 : 2;
      for (let v = Math.ceil(x0 / sx) * sx; v <= x1; v += sx) g += `<line class="gl" x1="${X(v)}" x2="${X(v)}" y1="${O}" y2="${H - U}"/><text class="ax" x="${X(v)}" y="${H - U + 15}" text-anchor="middle">${v}</text>`;
      g += `<text class="ax" x="${(L + W - R) / 2}" y="${H - 2}" text-anchor="middle">Außentemperatur während des Laufs (°C)</text><text class="ax" x="4" y="${O + 2}" text-anchor="start" style="font-weight:600">AZ</text>`;
      // Trend: nach Wärme gewichtete Gerade über die Heizläufe
      const h = P.filter((p) => !p[3]); let tr = '';
      if (h.length >= 5) { let sw = 0, sx1 = 0, sy = 0, sxx = 0, sxy = 0;
        for (const [x, y, w] of h) { sw += w; sx1 += w * x; sy += w * y; sxx += w * x * x; sxy += w * x * y; }
        const b = (sw * sxy - sx1 * sy) / (sw * sxx - sx1 * sx1), a = (sy - b * sx1) / sw;
        if (isFinite(b)) { const xa = Math.min(...h.map((p) => p[0])), xb = Math.max(...h.map((p) => p[0]));
          tr = `<line x1="${X(xa)}" y1="${Y(a + b * xa)}" x2="${X(xb)}" y2="${Y(a + b * xb)}" stroke="#fca5a5" stroke-width="2" stroke-dasharray="6 4"/>`;
          this._trend = `Trend Heizen: je 5 K kälter ${zahl(b * 5)} weniger AZ`; } }
      const pk = P.map((p, i) => `<circle class="pt" data-i="${i}" cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="${(3 + Math.sqrt(Math.max(p[2], 0)) * 1.25).toFixed(1)}" fill="#f97316" fill-opacity=".7" stroke="${p[6] ? '#93c5fd' : '#111'}" stroke-width="${p[6] ? 2.2 : .8}"/>`
        + (p[6] ? `<text x="${X(p[0]).toFixed(1)}" y="${(Y(p[1]) + 4).toFixed(1)}" text-anchor="middle" font-size="12" fill="#dbeafe" pointer-events="none">❄</text>` : '')).join('');   // hellblauer Ring + ❄ = Lauf mit Abtauung (22.10.2026)
      this._P = P; this._X = X; this._Y = Y;
      return `<div class="p"><svg viewBox="0 0 ${W} ${H}">${g}${tr}${pk}</svg></div>
        <div class="lg"><span><i style="background:#f97316"></i>Heizlauf</span><span><i style="background:#f97316;border:2px solid #93c5fd"></i>❄ mit Abtauung</span><span><i style="background:transparent;border:2px dashed #fca5a5;border-radius:0;height:0;width:14px;vertical-align:3px"></i>Trend Heizen</span><span>Punktgröße = Wärmemenge des Laufs · ${(() => { const nd = P.filter((p) => String(p[4]).includes('Dauerlauf')).length; return (P.length - nd) + ' reine Heizläufe' + (nd ? ' + ' + nd + ' Tage aus Dauerläufen' : ''); })()} (ohne Warmwasser)${this._trend ? ' · ' + this._trend : ''}</span></div>`;
    }
    // ⓘ-Erklärungen der Kacheln (25.10.2026, Nutzer: „solche Infos wie GEG als Tooltipp“) – Touch-Regel: Tippen = auf, nochmal = zu
    _infos() {
      const I = {
        energie: '<b>Energie im Jahr</b><br>Hochrechnung aufs ganze Jahr: heute (Hausstrom inkl. Victron-Anlage, Warmwasser, Heizung – wetterbereinigt) gegen früher mit Gasheizung (Hausstrom 5.600 + Warmwasser 11.716 + Heizung 20.178 kWh). Zählt jede kWh, egal ob vom Dach, aus dem Akku oder aus dem Netz.',
        pe: '<b>Primärenergie (GEG)</b><br>Energie, die die Natur liefern muss – mit Förderung, Kraftwerk und Transport. Die Faktoren legt das <b>Gebäudeenergiegesetz</b> (GEG, Anlage 4) fest: Erdgas 1,1 · Netzstrom 1,8 · eigener PV-Strom 0.<br>Verglichen wird Heizen + Warmwasser: früher Gas (aus den Gradtagen nachgerechnet) gegen heute WP- und BWWP-Strom aus dem Netz. Danach rechnen auch Energieausweis und Förderung.',
        eur: '<b>Gespart</b><br>Was dieselben Tage früher gekostet hätten (Gas inkl. Grundpreis + Wartung, dazu Hausstrom aus dem Netz) minus was es heute kostet (Netzstrom). Strom vom Dach/aus dem Akku zählt mit der entgangenen Einspeisevergütung als Kosten.',
        az: '<b>Arbeitszahl Heizen</b><br>Wärme ÷ Strom: 6 heißt, aus 1 kWh Strom werden 6 kWh Wärme. Gemessen über alle reinen Heizläufe (ohne Warmwasser) mit dem CMI-Wärmezähler und dem Stromzähler der WP-Zuleitung (inkl. Lüfter, Regelung, Heizstab). Im Herbst höher als im Winter – das Jahresmittel zeigt sich erst nach einer Heizperiode.'
      };
      const tip = this.shadowRoot.querySelector('.tip'), card = this.shadowRoot.querySelector('ha-card');
      tip.classList.add('w');
      const zeig = (el) => {
        if (!el) { tip.style.display = 'none'; this._ki = null; return; }
        this._ki = el.dataset.k; tip.innerHTML = I[el.dataset.k] || ''; tip.style.display = 'block';
        const r = el.getBoundingClientRect(), c = card.getBoundingClientRect();
        let x = r.left - c.left + r.width / 2 - tip.offsetWidth / 2; x = Math.max(8, Math.min(x, c.width - tip.offsetWidth - 8));
        tip.style.left = x + 'px'; tip.style.top = (r.bottom - c.top + 6) + 'px';
      };
      this.shadowRoot.querySelectorAll('.kc[data-k], .kc2[data-k]').forEach((el) => {
        el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') zeig(el); });
        el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') zeig(null); });
        el.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { e.stopPropagation(); zeig(this._ki === el.dataset.k ? null : el); } });
      });
    }
    _tips() {
      const tip = this.shadowRoot.querySelector('.tip'), card = this.shadowRoot.querySelector('ha-card');
      const zeig = (el) => {
        if (!el) { tip.style.display = 'none'; this._ti = null; return; }
        const p = this._P[+el.dataset.i]; this._ti = el.dataset.i;
        tip.innerHTML = `<b>${esc(p[4])}</b> · ${zahl(p[0])} °C · <b>AZ ${zahl(p[1])}</b><br>${zahl(p[2])} kWh Wärme${p[8] != null ? ' · ' + zahl(p[8]) + ' kWh Strom' : ''} · ${zahl(p[5] / 60)} h${p[3] ? ' · mit Warmwasser' : ''}`
          + (p[6] ? `<br>❄️ ${p[6]}× abgetaut (${Math.round(p[7] || 0)} min) – Wärme dafür schon abgezogen` : '');
        tip.style.display = 'block'; const r = el.getBoundingClientRect(), c = card.getBoundingClientRect();
        let x = r.left - c.left + r.width / 2 - tip.offsetWidth / 2; x = Math.max(4, Math.min(x, c.width - tip.offsetWidth - 4));
        tip.style.left = x + 'px'; tip.style.top = Math.max(4, r.top - c.top - tip.offsetHeight - 6) + 'px';
      };
      this.shadowRoot.querySelectorAll('.pt').forEach((el) => {
        el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') zeig(el); });
        el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') zeig(null); });
        el.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { e.stopPropagation(); zeig(this._ti === el.dataset.i ? null : el); } });
      });
      card.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse' && this._ti != null && !e.target.classList?.contains('pt')) zeig(null); });
    }
  }
  if (!customElements.get('vgs-kennzahlen-card')) customElements.define('vgs-kennzahlen-card', VgsKennzahlen);
  window.customCards = window.customCards || []; window.customCards.push({ type: 'vgs-kennzahlen-card', name: 'VGS Kennzahlen (Kacheln / Faktor / Punktwolke)' });
})();

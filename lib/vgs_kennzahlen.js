// vgs-kennzahlen-card (22.10.2026, Nutzer: Tabellen „catchy“ ergänzen) – drei Teile, Daten aus sensor.web_texte_warme (web_texte.yaml):
//   teil: kacheln → 4 große Zahlen (Energie −%, Primärenergie −%, € gespart, AZ Heizen) aus Attribut kpi
//   teil: faktor  → „Aus 1 kWh Strom wird …“: Flammen je Wärmeerzeuger (CHA-07 Heizen/WW, BWWP, früher Gas) aus kpi.faktor
//   teil: punkte  → Punktwolke AZ ↔ Außentemperatur je WP-Lauf (Größe = Wärme, blau = mit Warmwasser) + Trendlinie Heizläufe, Attribut punkte
// Gleiche Datei auf der Website (anzeige/lib/vgs_kennzahlen.js, hass-Ersatz aus verlauf.json fw). Touch-Regel: Tippen = Tooltip auf, nochmal = zu.
(() => {
  const FLAMME = 'M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z';   // mdi:fire
  const BLITZ = 'M11 15H6L13 1V9H18L11 23V15Z';   // mdi:flash
  const zahl = (v, d = 1) => v === null || v === undefined || isNaN(v) ? '–' : Number(v).toFixed(d).replace('.', ',');
  const tsd = (v) => Math.round(v).toLocaleString('de-DE');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const STIL = `<style>
    :host{display:block} ha-card{display:block;padding:14px;box-sizing:border-box;height:100%;position:relative;container-type:inline-size}
    .k{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
    @container (max-width:560px){.k{grid-template-columns:repeat(2,1fr)}}
    .kc{background:rgba(255,255,255,.04);border-radius:12px;padding:12px 10px;text-align:center}
    .kz{font:600 30px/1.1 sans-serif;color:#4ade80;letter-spacing:-.5px;white-space:nowrap} .kz.n{color:var(--primary-text-color)}
    .kl{font-size:14px;color:var(--primary-text-color);margin-top:4px} .ks{font-size:11.5px;color:var(--secondary-text-color);margin-top:2px}
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
    .tip{position:absolute;background:rgba(17,17,17,.95);border:1px solid #444;border-radius:8px;padding:6px 9px;font-size:12px;color:#e5e7eb;pointer-events:none;white-space:nowrap;display:none;z-index:2}
  </style>`;
  class VgsKennzahlen extends HTMLElement {
    setConfig(c) { this._c = { entity: 'sensor.web_texte_warme', teil: 'kacheln', ...c }; if (!this.shadowRoot) this.attachShadow({ mode: 'open' }); if (this.isConnected) this.connectedCallback(); }
    getCardSize() { return this._c?.teil === 'punkte' ? 6 : 3; }
    getGridOptions() { return { columns: 'full', rows: 'auto' }; }
    connectedCallback() {   // Punktwolke bei Breitenänderung (Drehen, Fenster) neu zeichnen
      if (this._ro || this._c?.teil !== 'punkte') return;
      this._ro = new ResizeObserver(() => { const b = Math.round(this.getBoundingClientRect().width); if (this._d && b && Math.abs(b - (this._br || 0)) > 30) this._zeichne(); }); this._ro.observe(this);
    }
    disconnectedCallback() { this._ro?.disconnect(); this._ro = null; }
    set hass(h) {
      const st = h.states[this._c.entity]; if (!st) return;
      const a = st.attributes, d = this._c.teil === 'punkte' ? a.punkte : a.kpi, key = JSON.stringify(d);
      if (!d || key === this._key) return; this._key = key; this._d = typeof d === 'string' ? JSON.parse(d) : d; this._zeichne();
    }
    _zeichne() {
      const t = this._c.teil, d = this._d; let h = '';
      if (t === 'kacheln') {
        const k = (z, l, s, neutral) => `<div class="kc"><div class="kz${neutral ? ' n' : ''}">${z}</div><div class="kl">${l}</div><div class="ks">${s}</div></div>`;
        h = `<div class="k">${k('−' + zahl(d.energie, 0) + ' %', 'Energie im Jahr', 'heute ≈ gegenüber früher (Gas + Strom)')}
          ${k('−' + zahl(d.pe, 0) + ' %', 'Primärenergie', 'seit ' + esc(d.seit) + ' · GEG-Faktoren')}
          ${k(tsd(d.eur) + ' €', 'gespart', 'seit ' + esc(d.seit) + ' gegenüber Gasheizung')}
          ${k(zahl(d.az_heiz), 'Arbeitszahl Heizen', 'Luft/Wasser-WP · ' + d.n_heiz + ' Läufe', true)}</div>`;
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
          this._trend = `Trend Heizen: je 5 K kälter ≈ ${zahl(b * 5)} weniger AZ`; } }
      const pk = P.map((p, i) => `<circle class="pt" data-i="${i}" cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="${(3 + Math.sqrt(Math.max(p[2], 0)) * 1.25).toFixed(1)}" fill="${p[3] ? '#60a5fa' : '#f97316'}" fill-opacity=".7" stroke="#111" stroke-width=".8"/>`).join('');
      this._P = P; this._X = X; this._Y = Y;
      return `<div class="p"><svg viewBox="0 0 ${W} ${H}">${g}${tr}${pk}</svg></div>
        <div class="lg"><span><i style="background:#f97316"></i>Heizlauf</span><span><i style="background:#60a5fa"></i>Lauf mit Warmwasser</span><span><i style="background:transparent;border:2px dashed #fca5a5;border-radius:0;height:0;width:14px;vertical-align:3px"></i>Trend Heizen</span><span>Punktgröße = Wärmemenge des Laufs · letzte ${P.length} Läufe${this._trend ? ' · ' + this._trend : ''}</span></div>`;
    }
    _tips() {
      const tip = this.shadowRoot.querySelector('.tip'), card = this.shadowRoot.querySelector('ha-card');
      const zeig = (el) => {
        if (!el) { tip.style.display = 'none'; this._ti = null; return; }
        const p = this._P[+el.dataset.i]; this._ti = el.dataset.i;
        tip.innerHTML = `<b>${esc(p[4])}</b> · ${zahl(p[0])} °C · <b>AZ ${zahl(p[1])}</b><br>${zahl(p[2])} kWh Wärme · ${zahl(p[5] / 60)} h${p[3] ? ' · mit Warmwasser' : ''}`;
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

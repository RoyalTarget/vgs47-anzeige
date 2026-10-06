// vgs-zaehler-card (06.10.2026, Nutzerwunsch „alte Zählerdarstellung“, Nostalgie)
// Stadtwerke-Zähler im Rollenzählwerk-Look: schwarz = ganze Einheiten, rot = Nachkomma.
//   art: 'wasser' → Wasserzähler m³ (5 + 3 Stellen) + Flügelstern, dreht mit dem SYR-Durchfluss
//   art: 'strom'  → 1.8.0 Bezug / 2.8.0 Einspeisung kWh (6 + 1 Stellen) + Ferraris-Scheibe, dreht mit der Netzleistung
//                   (+ = Bezug vorwärts, − = Einspeisung rückwärts; 75 U/kWh wie ein alter Drehstromzähler – reine Optik)
// Dieselbe Datei läuft im Dashboard (/local/vgs_zaehler.js) und auf der Anzeigeseite (anzeige/lib/vgs_zaehler.js, hass-Ersatz
// ohne Dienste). Antippen = Details (nur Dashboard), ✎ = Ablesung eintragen (input_number).
(() => {
  if (customElements.get('vgs-zaehler-card')) return;
  const ART = {
    wasser: {
      titel: 'Stadtwerke · Wasser', einheit: 'm³', ganz: 5, komma: 3,
      reihen: [{ e: 'sensor.wasserzahler_stadtwerke', ab: 'input_number.wasserzaehler_abgelesen' }],
      fluss: 'sensor.syr_connect_245124253_getflo',
    },
    strom: {
      titel: 'Stadtwerke · Strom', einheit: 'kWh', ganz: 6, komma: 1,
      reihen: [
        { e: 'sensor.stromzahler_bezug', ab: 'input_number.stromzaehler_bezug_abgelesen', obis: '1.8.0', name: 'Bezug' },
        { e: 'sensor.stromzahler_einspeisung', ab: 'input_number.stromzaehler_einspeisung_abgelesen', obis: '2.8.0', name: 'Einspeisung' },
      ],
      leistung: 'sensor.em_540_netzmessgeraet_leistung',
    },
  };
  const CSS = `
    :host { display: block; }
    ha-card, .karte { padding: 12px 14px 12px; box-sizing: border-box; height: 100%; }
    .kopf { display: flex; justify-content: space-between; align-items: baseline; font-size: 14px; color: var(--secondary-text-color, #9ca3af); margin-bottom: 8px; }
    .kopf b { color: var(--primary-text-color, #e5e7eb); font-weight: 500; }
    .gehaeuse { background: linear-gradient(160deg, #3a3d42, #1f2124 60%, #2b2e33); border-radius: 12px; padding: 10px 12px;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08), inset 0 -2px 6px rgba(0,0,0,.6); color: #d1d5db; cursor: pointer; }
    .reihe { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .reihe + .reihe { margin-top: 8px; }
    .lab { font: 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; color: #9ca3af; min-width: 74px; }
    .lab b { display: block; color: #e5e7eb; font: 500 12px/1.3 system-ui, sans-serif; }
    .werk { display: inline-flex; background: #0b0b0c; padding: 3px; border-radius: 5px; gap: 2px;
      box-shadow: inset 0 2px 4px rgba(0,0,0,.9), 0 0 0 1px #4b5058; }
    .rolle { width: 0.72em; height: 1.25em; overflow: hidden; font: 600 22px/1.25em 'DIN Alternate', 'Roboto Mono', ui-monospace, Menlo, monospace;
      text-align: center; color: #f3f4f6; border-radius: 2px; position: relative;
      background: linear-gradient(#000 0%, #2a2a2c 45%, #2a2a2c 55%, #000 100%); }
    .rolle.rot { background: linear-gradient(#5b0a0a 0%, #b91c1c 45%, #b91c1c 55%, #5b0a0a 100%); }
    .rolle::after { content: ''; position: absolute; inset: 0; background: linear-gradient(rgba(0,0,0,.55), transparent 30%, transparent 70%, rgba(0,0,0,.55)); pointer-events: none; }
    .band { transition: transform .9s cubic-bezier(.3,.7,.3,1); will-change: transform; }
    .band div { height: 1.25em; }
    .einh { font: 500 13px system-ui, sans-serif; color: #9ca3af; }
    .stift { margin-left: auto; font-size: 13px; color: #9ca3af; padding: 2px 6px; border-radius: 6px; cursor: pointer; user-select: none; }
    .stift:hover { background: rgba(255,255,255,.08); color: #e5e7eb; }
    .unten { display: flex; align-items: center; gap: 10px; margin-top: 10px; font: 12px system-ui, sans-serif; color: #9ca3af; }
    .stern { width: 34px; height: 34px; flex: none; }
    .stern g { transform-origin: 50% 50%; animation: dreh 1s linear infinite; animation-play-state: paused; }
    @keyframes dreh { to { transform: rotate(360deg); } }
    .scheibe { position: relative; width: 120px; height: 14px; flex: none; border-radius: 3px; overflow: hidden;
      background: #0b0b0c; box-shadow: inset 0 0 0 1px #4b5058, inset 0 3px 5px rgba(0,0,0,.9); }
    .scheibe .rand { position: absolute; inset: 3px 0; background:
      repeating-linear-gradient(90deg, #c0c4ca 0 7px, #9aa0a8 7px 8px); }
    .scheibe .marke { position: absolute; top: 3px; bottom: 3px; width: 10px; background: #dc2626; left: 0; }
    .scheibe .glanz { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0,0,0,.7), transparent 25%, transparent 75%, rgba(0,0,0,.7)); }
    .klein { font-size: 11px; color: #6b7280; }
  `;
  class VgsZaehler extends HTMLElement {
    setConfig(c) { this._c = { ...c }; this._a = ART[c.art] || ART.wasser; this._bau = false; }
    getCardSize() { return this._a && this._a.reihen.length > 1 ? 4 : 3; }
    getGridOptions() { return { columns: 12, min_columns: 6 }; }
    _bauen() {
      const a = this._a, r = this.shadowRoot || this.attachShadow({ mode: 'open' });
      const imHa = !!customElements.get('ha-card');
      const rolle = (rot) => `<div class="rolle${rot ? ' rot' : ''}"><div class="band">${[0,1,2,3,4,5,6,7,8,9,0].map((z) => `<div>${z}</div>`).join('')}</div></div>`;
      const werk = () => `<span class="werk">${Array.from({ length: a.ganz }, () => rolle(false)).join('')}${Array.from({ length: a.komma }, () => rolle(true)).join('')}</span>`;
      const reihen = a.reihen.map((x, i) => `<div class="reihe" data-i="${i}">${x.obis ? `<span class="lab">${x.obis}<b>${x.name}</b></span>` : ''}${werk()}<span class="einh">${a.einheit}</span>${imHa ? `<span class="stift" title="Ablesung eintragen" data-ab="${i}">✎</span>` : ''}</div>`).join('');
      const unten = a.fluss
        ? `<svg class="stern" viewBox="0 0 34 34"><circle cx="17" cy="17" r="16" fill="#0b0b0c" stroke="#4b5058"/><g>${[0,60,120,180,240,300].map((w, k) => `<path d="M17 17 L15 3 L19 3 Z" fill="${k % 2 ? '#e5e7eb' : '#dc2626'}" transform="rotate(${w} 17 17)"/>`).join('')}<circle cx="17" cy="17" r="3" fill="#9ca3af"/></g></svg><span class="txt"></span>`
        : `<div class="scheibe"><div class="rand"></div><div class="marke"></div><div class="glanz"></div></div><span class="txt"></span>`;
      const titel = this._c.titel === false ? '' : `<div class="kopf"><b>${this._c.titel || a.titel}</b><span class="sub"></span></div>`;
      r.innerHTML = `<style>${CSS}</style><${imHa ? 'ha-card' : 'div class="karte"'}>${titel}<div class="gehaeuse">${reihen}<div class="unten">${unten}</div></div></${imHa ? 'ha-card' : 'div'}>`;
      r.querySelector('.gehaeuse').addEventListener('click', (ev) => {
        const st = ev.target.closest('.stift');
        const e = st ? a.reihen[+st.dataset.ab].ab : (ev.target.closest('.reihe') ? a.reihen[+ev.target.closest('.reihe').dataset.i].e : a.reihen[0].e);
        if (!this._hass || !this._hass.callService) return;   // Anzeigeseite: nur ansehen
        this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: e }, bubbles: true, composed: true }));
      });
      this._bau = true; this._pos = 0; this._t = performance.now();
      if (!a.fluss) this._ferraris();
    }
    // Ferraris-Scheibe: rote Marke wandert mit 75 U/kWh × Leistung; Fensterbreite = ein Umlauf
    _ferraris() {
      const lauf = (t) => {
        if (!this.isConnected) { this._raf = null; return; }
        const dt = (t - this._t) / 1000; this._t = t;
        const kw = (this._kw || 0);
        this._pos = (this._pos + kw * 75 / 3600 * dt + 1) % 1;
        const m = this.shadowRoot && this.shadowRoot.querySelector('.marke');
        if (m) m.style.left = `calc(${(this._pos * 100).toFixed(2)}% - 5px)`;
        this._raf = requestAnimationFrame(lauf);
      };
      if (!this._raf) this._raf = requestAnimationFrame(lauf);
    }
    connectedCallback() { if (this._bau && !this._a.fluss) this._ferraris(); }
    set hass(h) {
      this._hass = h; if (!this._a) return; if (!this._bau) this._bauen();
      const a = this._a, r = this.shadowRoot, zahl = (e) => { const v = parseFloat(h.states[e] && h.states[e].state); return isFinite(v) ? v : null; };
      a.reihen.forEach((x, i) => {
        const v = zahl(x.e), rollen = r.querySelectorAll(`.reihe[data-i="${i}"] .band`);
        if (v === null) return;
        const s = Math.round(v * 10 ** a.komma).toString().padStart(a.ganz + a.komma, '0').slice(-(a.ganz + a.komma));
        rollen.forEach((b, k) => {
          const z = +s[k], alt = b._z;
          // 9 → 0 vorwärts über die zusätzliche 0 am Bandende rollen, dann ohne Animation zurücksetzen
          if (alt === 9 && z === 0) {
            b.style.transform = 'translateY(-12.5em)';
            setTimeout(() => { b.style.transition = 'none'; b.style.transform = 'translateY(0)'; b.offsetHeight; b.style.transition = ''; }, 950);
          } else b.style.transform = `translateY(-${z * 1.25}em)`;
          b._z = z;
        });
      });
      const txt = r.querySelector('.txt'), sub = r.querySelector('.sub'), de = (v, n) => v.toLocaleString('de-DE', { minimumFractionDigits: n, maximumFractionDigits: n });
      if (a.fluss) {
        const f = zahl(a.fluss) || 0, g = r.querySelector('.stern g');
        g.style.animationDuration = `${Math.max(0.25, 60 / Math.max(f / 10, 0.01)).toFixed(2)}s`;
        g.style.animationPlayState = f > 0 ? 'running' : 'paused';
        txt.textContent = f > 0 ? `läuft · ${de(f, 0)} l/h` : 'steht';
        const ab = zahl(a.reihen[0].ab), v = zahl(a.reihen[0].e);
        if (sub) sub.textContent = ab !== null && v !== null ? `seit Ablesung +${de(v - ab, 1)} m³` : '';
      } else {
        const p = zahl(a.leistung) || 0; this._kw = p / 1000;
        txt.innerHTML = Math.abs(p) < 5 ? 'Scheibe steht' : p > 0 ? `Bezug ▶ ${de(p, 0)} W` : `◀ Einspeisung ${de(-p, 0)} W`;
        txt.innerHTML += ' <span class="klein">· 75 U/kWh</span>';
        const b = zahl(a.reihen[0].e), e = zahl(a.reihen[1].e), bb = zahl(a.reihen[0].ab), eb = zahl(a.reihen[1].ab);
        if (sub) sub.textContent = [b, e, bb, eb].every((x) => x !== null) ? `seit Ablesung +${de(b - bb, 0)} / +${de(e - eb, 0)} kWh` : '';
      }
    }
  }
  customElements.define('vgs-zaehler-card', VgsZaehler);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'vgs-zaehler-card', name: 'VGS Zähler (Nostalgie)', description: 'Stadtwerke-Zähler als Rollenzählwerk' });
})();

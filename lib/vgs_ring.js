// vgs-ring-card (15.10.2026, Nutzer): Torte als SVG – äußerer Ring = Felder (Hausstrom/Warmwasser/Heizung),
// optional innerer schmaler Ring PV/Akku (grün) gegen Netz (dunkelgrau), Mitte = Einheit + Summe + Zeile darunter
// (☀ PV-Anteil % bzw. Text `unter`) – Mitte immer gleich aufgebaut, damit Zahlen nebeneinanderstehender Karten auf einer Höhe liegen.
// Config: title, entity, unit, unter, segments: [{attr, name, color}], pv: {attr: [...], netz: [...]} (Summen der Attribute).
// Touch-Regel: Tippen auf ein Segment = Tooltip auf, nochmal = zu; Desktop Hover.
(() => {
  // 15.10.2026 (Nutzer): ruhiger – PV grün wie Tabelle darunter (Ring, Sonne, %), Netz dunkelgrau, kleine weiße Sonne statt Modul/Strommast
  const PV = '#4ade80', NETZ = '#4b5563';
  const SONNE = 'M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z';   // mdi:white-balance-sunny
  const z = (v) => Math.round(v).toLocaleString('de-DE');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const bogen = (cx, cy, r, a0, a1) => {   // Kreisbogen im Uhrzeigersinn ab 12 Uhr, Winkel 0–1
    if (a1 - a0 >= 0.9999) a1 = a0 + 0.9999;
    const p = (a) => [cx + r * Math.sin(a * 2 * Math.PI), cy - r * Math.cos(a * 2 * Math.PI)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 0.5 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  class VgsRing extends HTMLElement {
    setConfig(c) { this._c = c; this._tip = null; if (!this.shadowRoot) this.attachShadow({ mode: 'open' }); }
    getCardSize() { return 5; }
    getGridOptions() { return { columns: 6, rows: 'auto' }; }
    set hass(h) {
      const st = h.states[this._c.entity]; if (!st) return;
      const a = st.attributes, key = this._c.segments.map((s) => a[s.attr]).join('|') + JSON.stringify(this._c.pv ? [this._c.pv.attr.map((k) => a[k]), this._c.pv.netz.map((k) => a[k])] : '');
      if (key === this._key) return; this._key = key; this._a = a; this._zeichne();
    }
    _zeichne() {
      const c = this._c, a = this._a, num = (k) => parseFloat(a[k]) || 0;
      const seg = c.segments.map((s) => ({ ...s, v: num(s.attr) })), sum = seg.reduce((x, s) => x + s.v, 0) || 1;
      const R = 78, W = 26, cx = 100, cy = 100;
      let w = 0, pfade = '', marken = '';
      seg.forEach((s, i) => {
        const a0 = w, a1 = w + s.v / sum; w = a1;
        pfade += `<path d="${bogen(cx, cy, R, a0, a1)}" stroke="${s.color}" stroke-width="${W}" fill="none" data-i="${i}" class="s"/>`;
        // Trennstrich
        pfade += `<path d="${bogen(cx, cy, R, a1 - 0.0015, a1)}" stroke="#1c1c1c" stroke-width="${W + 1}" fill="none" pointer-events="none"/>`;
        const p = (a1 - a0) * 100;
        if (p >= 6) { const m = (a0 + a1) / 2 * 2 * Math.PI; marken += `<text x="${(cx + R * Math.sin(m)).toFixed(1)}" y="${(cy - R * Math.cos(m) + 4).toFixed(1)}" class="pz">${Math.round(p)} %</text>`; }
      });
      let ring = '', mitte2 = '';
      if (c.pv) {
        const pv = c.pv.attr.reduce((x, k) => x + num(k), 0), nz = c.pv.netz.reduce((x, k) => x + num(k), 0), t = pv + nz || 1, r2 = R - W / 2 - 7;
        ring = `<circle cx="${cx}" cy="${cy}" r="${r2}" stroke="${NETZ}" stroke-width="7" fill="none" data-i="netz" class="s"/>`
          + `<path d="${bogen(cx, cy, r2, 0, pv / t)}" stroke="${PV}" stroke-width="7" fill="none" stroke-linecap="butt" data-i="pv" class="s"/>`;
        this._pv = { pv, nz, t };
        // ☀ + PV-Anteil, als Gruppe mittig (Breite grob geschätzt: Symbol 12 + Abstand 3 + Text ~6,6 px/Zeichen)
        const txt = `${Math.round(pv / t * 100)} %`, bx = cx - (15 + txt.length * 6.6) / 2;
        mitte2 = `<path d="${SONNE}" fill="${PV}" transform="translate(${bx.toFixed(1)} ${cy + 12}) scale(0.5)"/>`
          + `<text x="${(bx + 15).toFixed(1)}" y="${cy + 22}" class="m3" style="text-anchor:start;fill:${PV}">${txt}</text>`;
      } else if (c.unter) mitte2 = `<text x="${cx}" y="${cy + 22}" class="m2">${esc(c.unter)}</text>`;
      const leg = seg.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')
        + (c.pv ? `<span><i style="background:${PV}"></i>PV/Akku</span><span><i style="background:${NETZ}"></i>Netz</span>` : '');
      this._seg = seg; this._sum = sum;
      this.shadowRoot.innerHTML = `<style>
        ha-card{padding:12px 12px 10px;height:100%;box-sizing:border-box;position:relative}
        .t{font-size:15px;color:var(--secondary-text-color);margin:0 0 4px 4px}
        svg{display:block;width:100%;max-width:260px;margin:0 auto;overflow:visible}
        .s{cursor:pointer} .pz{font:700 11px sans-serif;fill:#fff;text-anchor:middle;pointer-events:none;paint-order:stroke;stroke:rgba(0,0,0,.45);stroke-width:2.5px}   /* wie Torten der Übersicht (vgs_fenster.js) */
        .m1{font:500 22px sans-serif;fill:var(--primary-text-color);text-anchor:middle}
        .m2{font:11px sans-serif;fill:#9ca3af;text-anchor:middle} .m3{font:600 11px sans-serif;fill:#e5e7eb}
        .lg{display:flex;flex-wrap:wrap;justify-content:center;gap:2px 10px;font-size:12px;color:var(--secondary-text-color);margin-top:6px}
        .lg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}
        .tip{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);background:rgba(17,17,17,.94);border:1px solid #444;border-radius:8px;padding:6px 9px;font-size:12px;color:#e5e7eb;pointer-events:none;white-space:nowrap;display:none}
      </style><ha-card>${c.title ? `<div class="t">${esc(c.title)}</div>` : ''}
        <svg viewBox="0 0 200 200">${pfade}${ring}${marken}
          <text x="${cx}" y="${cy - 20}" class="m2">${esc(c.unit || 'kWh')}</text>
          <text x="${cx}" y="${cy + 4}" class="m1">${z(sum)}</text>${mitte2}</svg>
        <div class="lg">${leg}</div><div class="tip"></div></ha-card>`;
      const tip = this.shadowRoot.querySelector('.tip');
      const zeig = (i) => {
        if (i == null) { tip.style.display = 'none'; this._tip = null; return; }
        let h;
        if (i === 'pv' || i === 'netz') { const x = i === 'pv' ? this._pv.pv : this._pv.nz; h = `<b>${i === 'pv' ? 'PV/Akku' : 'Netz'}</b> ${z(x)} kWh · ${Math.round(x / this._pv.t * 100)} %`; }
        else { const s = this._seg[+i]; h = `<b>${esc(s.name)}</b> ${z(s.v)} kWh · ${Math.round(s.v / this._sum * 100)} %`; }
        tip.innerHTML = h; tip.style.display = 'block'; this._tip = i;
      };
      this.shadowRoot.querySelectorAll('.s').forEach((el) => {
        el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') zeig(el.dataset.i); });
        el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') zeig(null); });
        el.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') { e.stopPropagation(); zeig(this._tip === el.dataset.i ? null : el.dataset.i); } });
      });
      this.shadowRoot.querySelector('ha-card').addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse' && this._tip != null && !e.target.classList?.contains('s')) zeig(null); });
    }
  }
  if (!customElements.get('vgs-ring-card')) customElements.define('vgs-ring-card', VgsRing);
  window.customCards = window.customCards || []; window.customCards.push({ type: 'vgs-ring-card', name: 'VGS Ring-Torte' });
})();

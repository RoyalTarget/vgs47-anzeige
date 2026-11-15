// vgs-bwwp-temp-card (15.11.2026, Nutzer: „Website-Ansicht schöner“ → v3 „eine Grafik für die BWWP, Leistung mit rein, Zeitachse wie oben“)
// Eine Grafik, eine Zeitachse (alle 2/3/… h, Tageswechsel fett mit Linie):
//   links °C: Speicher mitte T2 (rot) + Warmwasser am Ausgang (gelb), Schaltschwellen gestrichelt (Text im Rand rechts, entzerrt)
//   rechts W: BWWP-Leistung als türkise Fläche (10-min-Mittel), davon BWWP-Heizstab orange; Bänder WP lädt Warmwasser (blau) / WP-Heizstab (rot)
// Daten: sensor.bwwp_temp_verlauf (SQL-Helfer, bt [10-min-Block, T2, WW, W BWWP, W Heizstab], bn [l/h/b, t, an]); Schwellen live.
// Dashboard UND Website (lib/vgs_bwwp_temp.js, app.js zeigeBwwpTemp füttert hass aus verlauf.json) – ein Code. Ersetzt die Apex-Karte „BWWP – Leistung“.
// Selbstprüfung → this.dataset.pruef (UI-Check).
(() => {
  const zahl = (v, d = 1) => Number(v).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const js = (x) => { if (typeof x === 'string') { try { return JSON.parse(x); } catch (e) { return []; } } return x || []; };
  class VgsBwwpTemp extends HTMLElement {
    setConfig(c) { this._c = c || {}; }
    getCardSize() { return 7; }
    getGridOptions() { return { columns: 'full', min_rows: 6 }; }
    connectedCallback() { if (!this._ro) { this._ro = new ResizeObserver(() => { const w = this.getBoundingClientRect().width; if (w && Math.abs(w - (this._w || 0)) > 4) { this._k = ''; this._zeichne(); } }); this._ro.observe(this); } }
    disconnectedCallback() { if (this._ro) { this._ro.disconnect(); this._ro = null; } }
    set hass(h) {
      this._h = h; const ids = ['sensor.bwwp_temp_verlauf', 'sensor.naechster_start', 'input_number.uvr_ww_soll', 'input_number.uvr_ww_diff_aus', 'input_number.uvr_ww_diff_ein', 'input_number.bwwp_soll_et'];
      const k = ids.map((e) => { const s = h.states[e]; return s ? s.last_updated : '-'; }).join('|') + '|' + Math.floor(Date.now() / 300e3);
      if (k === this._k) return; this._k = k; this._zeichne();
    }
    _zeichne() {
      const h = this._h; if (!h) return;
      if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
      const pf = [], sv0 = h.states['sensor.bwwp_temp_verlauf'];
      if (!sv0) pf.push('fehlt sensor.bwwp_temp_verlauf');
      const bt = js(sv0 && sv0.attributes.bt), bn = js(sv0 && sv0.attributes.bn);
      const g = (((h.states['sensor.naechster_start'] || {}).attributes || {}).geraete || {}).bwwp || {};
      const f = (e) => parseFloat((h.states[e] || {}).state);
      const bw = this.getBoundingClientRect().width; this._w = bw;
      const W = Math.round(Math.max(300, Math.min(1600, (bw || 600) - 32)));
      const svg = VgsBwwpTemp.svg(bt, bn, g, f, W, zahl, pf);
      const leg = `<p class="l"><span style="color:#ef4444">━</span> Speicher mitte (T2, danach schaltet die BWWP) · <span style="color:#facc15">━</span> Warmwasser am Ausgang · <span style="color:#2dd4bf">■</span> BWWP-Leistung (rechte Achse, W) · <span style="color:#f59e0b">■</span> davon BWWP-Heizstab · <span style="color:#3b82f6">■</span> WP lädt Warmwasser · <span style="color:#ef4444">■</span> WP-Heizstab während der Warmwasser-Ladung · ▼ Auslöser (T2 unter Schwelle) · gestrichelt = Schaltschwellen</p>`;
      this.shadowRoot.innerHTML = `<style>:host{display:block}ha-card{display:block;padding:10px 16px 6px;position:relative}.l{color:var(--secondary-text-color,var(--leise,#9ca3af));font-size:12.5px;margin:2px 0 4px;line-height:1.5}
        svg{width:100%;height:auto;display:block;font:11px sans-serif;fill:var(--secondary-text-color,var(--leise,#9ca3af))}
        .tip{position:absolute;pointer-events:none;background:rgba(20,20,22,.95);color:#fff;font-size:12px;padding:6px 8px;border-radius:6px;border:1px solid #3f3f46;white-space:nowrap;display:none;z-index:2;line-height:1.45}</style>
        <ha-card>${svg}${leg}<div class="tip"></div></ha-card>`;
      const R = this.shadowRoot, tip = R.querySelector('.tip'), card = R.querySelector('ha-card');
      R.querySelectorAll('rect[data-tip]').forEach((el) => {
        el.addEventListener('mouseenter', () => { tip.innerHTML = el.dataset.tip; tip.style.display = 'block'; });
        el.addEventListener('mousemove', (e) => { const r = card.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
          tip.style.left = Math.max(0, Math.min(r.width - tip.offsetWidth - 4, x + 12)) + 'px'; tip.style.top = Math.max(0, y - tip.offsetHeight - 8) + 'px'; });
        el.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
        el.addEventListener('click', () => { tip.innerHTML = el.dataset.tip; tip.style.display = 'block'; const b = el.getBoundingClientRect(), r = card.getBoundingClientRect();
          tip.style.left = Math.max(0, Math.min(r.width - tip.offsetWidth - 4, b.left - r.left - 40)) + 'px'; tip.style.top = '4px'; });
      });
      this.dataset.pruef = pf.length ? pf.join('; ') : 'ok';
    }
    static svg(bt, bn, g, f, W, zahl, pf) {
      if (bt.length < 3) { pf.push('keine Daten'); return '<p>Noch keine Daten.</p>'; }
      const sw = [[Number(g.start ?? 52), 'BWWP an', '#60a5fa'], [Number(g.stop), 'BWWP aus', '#2dd4bf'], [f('input_number.uvr_ww_soll') + f('input_number.uvr_ww_diff_aus'), 'WP-Ladung aus', '#fb923c'],
        [f('input_number.uvr_ww_soll') + f('input_number.uvr_ww_diff_ein'), 'WP lädt nach', '#fb923c'], [f('input_number.bwwp_soll_et') - 1, 'BWWP-Heizstab', '#ef4444']].filter((x) => isFinite(x[0]));
      const kurz = W < 520, t1 = Date.now(), t0 = t1 - 48 * 3600e3, H = kurz ? 260 : 300, Lr = 34, Rr = kurz ? 112 : 150, T = 12, B = 30, xr = W - Rr;
      const X = (t) => Lr + (t - t0) / (t1 - t0) * (xr - Lr), lo = 25, hi = 60, Y = (c) => T + (1 - (Math.max(lo, Math.min(hi, c)) - lo) / (hi - lo)) * (H - T - B);
      const pmax = Math.max(0, ...bt.map((r) => Number(r[3]) || 0)), wmax = pmax > 500 ? Math.ceil(pmax / 500) * 500 : 500, YW = (w) => H - B - Math.max(0, Math.min(w, wmax)) / wmax * (H - T - B);
      let sv = '';
      for (const c of [30, 40, 50, 60]) sv += `<line x1="${Lr}" x2="${xr}" y1="${Y(c)}" y2="${Y(c)}" stroke="rgba(127,127,127,.22)"/><text x="${Lr - 5}" y="${Y(c) + 4}" text-anchor="end">${c}°</text>`;
      for (let i = 0; i <= 5; i++) { const w = wmax * i / 5; sv += `<text x="${xr + 5}" y="${YW(w) + 4}" fill="#2dd4bf" style="font-size:10px">${zahl(w, 0)}</text>`; }
      sv += `<text x="${xr + 5}" y="${T - 3}" fill="#2dd4bf" style="font-size:10px">W</text>`;
      // 15.11.2026 v5 (Nutzer: „hier nur die WW-Bereitung“): Intervalle je Schaltsignal; WP-Heizstab nur, solange die WP Warmwasser lädt
      // (Heiz-Einsätze stehen in „Wer hilft der WP?“). Erster Eintrag „aus“ heißt nicht „vorher an“ (HA schreibt nach Neustart „off“).
      const iv = (e) => { const out = []; let an = null; for (const x of bn.filter((y) => y[0] === e)) { const t = x[1] * 1000;
        if (x[2] && an === null) an = t; else if (!x[2] && an !== null) { if (t > t0) out.push([Math.max(an, t0), t]); an = null; } }
        if (an !== null) out.push([Math.max(an, t0), t1]); return out; };
      const L = iv('l'), HS = [];
      for (const [a, b] of iv('h')) for (const [c, d] of L) { const x = Math.max(a, c), y = Math.min(b, d); if (y > x) HS.push([x, y]); }
      const rect = (l, c, op) => l.map(([a, b]) => `<rect x="${X(a).toFixed(1)}" y="${T}" width="${Math.max(1, X(b) - X(a)).toFixed(1)}" height="${H - T - B}" fill="${c}" opacity="${op}"/>`).join('');
      sv += rect(L, '#3b82f6', 0.2) + rect(HS, '#ef4444', 0.35);
      // Leistung als Treppe je 10-min-Block (rechte Achse)
      const flaeche = (k, col, op) => { let d = ''; for (const r of bt) { const w = Number(r[k]) || 0, t = r[0] * 600e3; if (w < 1 || t + 600e3 < t0) continue;
        d += `M${X(Math.max(t, t0)).toFixed(1)} ${YW(0).toFixed(1)}V${YW(w).toFixed(1)}H${X(Math.min(t + 600e3, t1)).toFixed(1)}V${YW(0).toFixed(1)}Z`; } return d ? `<path d="${d}" fill="${col}" fill-opacity="${op}"/>` : ''; };
      sv += flaeche(3, '#2dd4bf', 0.28) + flaeche(4, '#f59e0b', 0.65);
      const lab = sw.map(([c, n, col]) => ({ c, n: kurz ? n.replace('WP-Ladung aus', 'Ladung aus').replace('WP lädt nach', 'lädt nach').replace('BWWP-Heizstab', 'Heizstab') : n, col, y: Y(c) + 3.5 })).sort((a, b) => a.y - b.y);
      for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 12) lab[i].y = lab[i - 1].y + 12;
      for (const L of lab) sv += `<line x1="${Lr}" x2="${xr}" y1="${Y(L.c)}" y2="${Y(L.c)}" stroke="${L.col}" stroke-dasharray="5 4" stroke-width="1.2" opacity=".85"/>`
        + `<text x="${xr + 38}" y="${L.y}" fill="${L.col}" style="font-size:10px">${L.n} ${zahl(L.c, 0)}°</text>`;
      if (!lab.every((L) => L.y <= H - B + 2)) pf.push('Schwellen-Text unter dem Zeichenbereich');
      const linie = (k, col, w) => { let last = null; const pts = []; for (const r of bt) { const val = r[k] ?? last; if (val == null) continue; last = val; const t = r[0] * 600e3 + 300e3; if (t < t0) continue; pts.push(`${X(t).toFixed(1)},${Y(val).toFixed(1)}`); }
        return `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="${w}" style="pointer-events:none"/>`; };
      sv += linie(2, '#facc15', 1.6) + linie(1, '#ef4444', 2.6);
      // Auslöser: Dreieck auf T2 beim Start der WP-Ladung (blau) bzw. der BWWP (türkis); T2 = Wert des 10-min-Blocks
      const t2bei = (t) => { let v = null; for (const r of bt) { if (r[0] * 600e3 > t) break; if (r[1] != null) v = r[1]; } return v; };
      const mark = (e, col, txt) => bn.filter((x) => x[0] === e && x[2] && x[1] * 1000 >= t0).map((x) => { const t = x[1] * 1000, v = t2bei(t); if (v == null) return '';
        const cx = X(t), cy = Y(v) - 7, z = new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        return `<path d="M${(cx - 5).toFixed(1)} ${(cy - 7).toFixed(1)}H${(cx + 5).toFixed(1)}L${cx.toFixed(1)} ${cy.toFixed(1)}Z" fill="${col}" stroke="#111" stroke-width=".8"><title>${txt} ${z} · T2 ${zahl(v, 1)} °C</title></path>`; }).join('');
      sv += mark('b', '#2dd4bf', 'BWWP an') + mark('l', '#3b82f6', 'WP lädt Warmwasser');
      // Zeitachse: Schritt so, dass ≥ 48 px je Beschriftung; Mitternacht = Wochentag + Datum fett mit Linie
      const pxh = (xr - Lr) / 48, st = [1, 2, 3, 4, 6, 12].find((x) => x * pxh >= 48) || 12;
      sv += `<line x1="${Lr}" x2="${xr}" y1="${H - B}" y2="${H - B}" stroke="rgba(127,127,127,.5)"/>`;
      for (let hh = Math.ceil(t0 / 3600e3); hh * 3600e3 < t1; hh++) { const t = hh * 3600e3, d = new Date(t), hr = d.getHours(); if (hr % st) continue;
        const x = X(t).toFixed(1), tag = hr === 0;
        sv += `<line x1="${x}" x2="${x}" y1="${H - B}" y2="${H - B + 4}" stroke="rgba(127,127,127,.6)"/>` + (tag ? `<line x1="${x}" x2="${x}" y1="${T}" y2="${H - B}" stroke="rgba(127,127,127,.35)"/>` : '')
          + `<text x="${x}" y="${H - B + 16}" text-anchor="middle" ${tag ? 'style="font-weight:700;fill:var(--primary-text-color,var(--text,#e5e7eb))"' : ''}>${tag ? d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' }) : String(hr).padStart(2, '0') + ':00'}</text>`; }
      // Tooltip-Flächen je 10-min-Block
      let l1 = null, l2 = null;
      for (const r of bt) { l1 = r[1] ?? l1; l2 = r[2] ?? l2; const t = r[0] * 600e3; if (t < t0) continue;
        const z = new Date(t + 300e3).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        sv += `<rect x="${X(t).toFixed(1)}" y="${T}" width="${(X(t + 600e3) - X(t)).toFixed(2)}" height="${H - T - B}" fill="transparent" data-tip="<b>${z}</b><br>Speicher mitte (T2) ${l1 != null ? zahl(l1, 1) : '–'} °C<br>Warmwasser ${l2 != null ? zahl(l2, 1) : '–'} °C<br>BWWP ${zahl(Number(r[3]) || 0, 0)} W${Number(r[4]) > 0 ? ' · davon Heizstab ' + zahl(Number(r[4]), 0) + ' W' : ''}"/>`; }
      return `<svg viewBox="0 0 ${W} ${H}">${sv}</svg>`;
    }
  }
  if (!customElements.get('vgs-bwwp-temp-card')) customElements.define('vgs-bwwp-temp-card', VgsBwwpTemp);
  window.customCards = window.customCards || []; window.customCards.push({ type: 'vgs-bwwp-temp-card', name: 'VGS Warmwasser – Speicher und BWWP 48 h' });
})();

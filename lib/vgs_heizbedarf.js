// vgs-heizbedarf-card (16.11.2026, Nutzer: Entwurf Fassung 3 „Heizung – Wer braucht, wer liefert? · 48 h“ abgenommen)
// Oben Bänder = was schaltet und warum: WiGa-/WZ-Ventile auf · Daikin heizt · Abtauen · WW-Ladung · WP am Anschlag (Stellgröße ≥ 69,5)
//   · Vorlauf unter Soll (WP-VL ≥ 1 K unter cmi_wp_heizen_soll, ohne WW/Abtauen ±10 min) · Heizstab an.
// Darunter kW (fest 0–10, Spitzen als Zahl): blau WP-Wärme (CMI, Abtauen negativ → 0), orange WP-Heizstab gestapelt
//   (= Strom gesamt − Strom vor dem Heizstab, wie wp_strom_ohne_heizstab), rote Linie Bedarf Heizkreis (hk_leistung).
// Daten: sensor.heizung_bedarf_verlauf (SQL-Helfer, Polling aus, heizbedarf.yaml alle 5 min):
//   d = [[Unix-s/300, wp kW, hk kW, WP-Strom W, außen, Ecke, Stellgröße, WP-VL, Soll, HK-VL, HK-RL, WiGa 0–1, WZ 0–1] …] (5-min-Mittel, 48 h)
//   bn = [[h|a|l|d, Unix-s, 1/0] …] Wechsel Heizstab / Abtauen / WW-Ladung / Daikin heizt (50 h)
// Dashboard UND Website (lib/vgs_heizbedarf.js, app.js zeigeHeizbedarf füttert hass aus heizung.json) – ein Code.
// Zähler WP/HK weichen kurzzeitig 0,5–1 kW ab (Gegenprobe Puffer 15.11.) → nur als Größenordnung, keine Puffer-Schraffur.
// Selbstprüfung → this.dataset.pruef (UI-Check).
(() => {
  const zahl = (v, d = 1) => (v == null || isNaN(v)) ? '–' : Number(v).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const js = (x) => { if (typeof x === 'string') { try { return JSON.parse(x); } catch (e) { return []; } } return x || []; };
  const TAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const F = { wp: '#3b82f6', hs: '#ff9800', hk: '#ef5350', wiga: '#66bb6a', wz: '#9ccc65', dk: '#4dd0e1', ab: '#90caf9', ww: '#5c6bc0', ans: '#ab47bc', vlu: '#ff7043' };
  const BAND = [['wiga', 'WiGa-Ventile auf'], ['wz', 'WZ-Ventile auf'], ['dk', 'Daikin heizt'], ['ab', 'Abtauen'], ['ww', 'WW-Ladung'],
    ['ans', 'WP am Anschlag'], ['vlu', 'Vorlauf unter Soll'], ['hsb', 'Heizstab an']];
  const BC = { wiga: F.wiga, wz: F.wz, dk: F.dk, ab: F.ab, ww: F.ww, ans: F.ans, vlu: F.vlu, hsb: F.hs };

  // Rohdaten → Zeilen je 5 min
  function rechne(d, bn, pf) {
    const R = d.map((z) => ({ t: z[0] * 300e3, wp: z[1], hk: z[2], g: z[3], aus: z[4], ecke: z[5], stg: z[6], vl: z[7], soll: z[8] != null && z[8] >= 20 ? z[8] : null,
      hkvl: z[9], rl: z[10], wiga: z[11] != null && z[11] >= 0.5 ? 1 : 0, wz: z[12] != null && z[12] >= 0.5 ? 1 : 0 }));
    // Anteil „an“ je Block aus den Wechseln
    const anteil = (k) => { const w = bn.filter((x) => x[0] === k).map((x) => [x[1] * 1000, x[2]]); let i = 0, an = 0;
      return R.map((r) => { const a = r.t, b = r.t + 300e3; let s = 0, t = a;
        while (i < w.length && w[i][0] <= a) { an = w[i][1]; i++; }
        let j = i; while (j < w.length && w[j][0] < b) { if (an) s += w[j][0] - t; t = w[j][0]; an = w[j][1]; j++; }
        if (an) s += b - t; i = j; return s / 300e3; }); };
    const fh = anteil('h'), fa = anteil('a'), fl = anteil('l'), fd = anteil('d');
    let basis = null;
    R.forEach((r, j) => { r.hsb = fh[j] >= 0.5 ? 1 : 0; r.ab = fa[j] >= 0.5 ? 1 : 0; r.ww = fl[j] >= 0.5 ? 1 : 0; r.dk = fd[j] >= 0.5 ? 1 : 0;
      if (fh[j] === 0 && fa[j] === 0 && r.g != null) basis = r.g;
      r.hs = fh[j] > 0 && r.g != null && basis != null ? Math.max(0, r.g - basis) / 1000 : 0;
      r.ans = r.stg != null && r.stg >= 69.5 ? 1 : 0; });
    R.forEach((r, j) => { let ruhig = true; for (let k = -2; k <= 2; k++) { const q = R[j + k]; if (q && (q.ww || q.ab)) ruhig = false; }
      r.vlu = ruhig && r.vl != null && r.soll != null && r.vl < r.soll - 1 ? 1 : 0; });
    R.forEach((r) => { if (r.hs < 0) pf.push('Heizstab negativ ' + new Date(r.t).toLocaleString('de-DE')); });
    R.forEach((r, j) => { const abN = [-2, -1, 0, 1, 2].some((k) => R[j + k] && R[j + k].ab); if ((r.wp || 0) < -0.3 && !abN) pf.push('WP negativ ohne Abtauen ' + new Date(r.t).toLocaleString('de-DE')); });
    return R;
  }

  function svg(R, W) {
    const schmal = W < 560, L = schmal ? 30 : 40, Rr = 8, bh = schmal ? 12 : 14, bg = 3, top = 2, bandH = BAND.length * (bh + bg), gT = top + bandH + 14;
    const gH = Math.round(Math.max(190, Math.min(320, W * 0.24))), H = gT + gH + 24;
    const t0 = R[0].t, t1 = R[R.length - 1].t + 300e3, x = (t) => L + (t - t0) / (t1 - t0) * (W - L - Rr);
    const ym = 10, y = (v) => gT + gH - Math.max(0, Math.min(v, ym)) / ym * gH, fs = schmal ? 10 : 11;
    let s = '';
    BAND.forEach(([k, n], i) => { const yy = top + i * (bh + bg);
      s += `<rect x="${L}" y="${yy}" width="${W - L - Rr}" height="${bh}" fill="rgba(127,127,127,.16)" rx="3"/>`;
      let a = null; R.forEach((r, j) => { if (r[k] && a == null) a = r.t;
        if ((!r[k] || j === R.length - 1) && a != null) { const e = r[k] ? r.t + 300e3 : r.t; s += `<rect x="${x(a).toFixed(1)}" y="${yy}" width="${Math.max(1.5, x(e) - x(a)).toFixed(1)}" height="${bh}" fill="${BC[k]}" rx="2"/>`; a = null; } });
      s += `<text x="${L + 5}" y="${yy + bh - 3}" font-size="${fs}" fill="#fff" style="paint-order:stroke;stroke:#262626;stroke-width:3px">${n}</text>`; });
    for (let v = 0; v <= ym; v += 2) s += `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(127,127,127,.35)" ${v ? 'stroke-dasharray="3 4"' : ''}/><text x="${L - 5}" y="${y(v) + 4}" font-size="${fs + 1}" text-anchor="end">${v}</text>`;
    s += `<text x="2" y="${gT - 9}" font-size="${fs}">kW</text>`;
    // Zeitachse: Abstand ≥ 48 px, Schritte 1/2/3/4/6/12 h, Tageswechsel fett mit Linie
    const pxH = (W - L - Rr) / ((t1 - t0) / 3600e3), step = [1, 2, 3, 4, 6, 12].find((h) => h * pxH >= 48) || 24;
    let dd = new Date(t0); dd.setMinutes(0, 0, 0);
    while (dd.getTime() < t1) { const tt = dd.getTime(); if (tt >= t0) { const xx = x(tt), mn = dd.getHours() === 0;
        if (mn) s += `<line x1="${xx}" x2="${xx}" y1="${top}" y2="${gT + gH}" stroke="rgba(200,200,200,.55)" stroke-width="1.5"/>`;
        if (mn || dd.getHours() % step === 0) { const lab = mn ? TAG[dd.getDay()] + ' ' + dd.getDate() + '.' : String(dd.getHours()).padStart(2, '0') + ':00';
          const hh = dd.getHours(), nahMn = !mn && Math.min(hh, 24 - hh) < step * 0.6;
          if (!nahMn) s += `<text x="${xx}" y="${gT + gH + 17}" font-size="${fs + 1}" text-anchor="middle" ${mn ? 'font-weight="600" style="fill:var(--primary-text-color,#e5e7eb)"' : ''}>${lab}</text>`; } }
      dd = new Date(dd.getFullYear(), dd.getMonth(), dd.getDate(), dd.getHours() + 1); }
    const P = (f) => R.map((r) => [x(r.t + 150e3), f(r)]);
    const wp = (r) => Math.max(0, r.wp || 0);
    const flaeche = (lo, hi, c, o) => { const a = P(hi), b = P(lo).reverse(); return `<path d="M${a.map((p) => p[0].toFixed(1) + ',' + y(p[1]).toFixed(1)).join('L')}L${b.map((p) => p[0].toFixed(1) + ',' + y(p[1]).toFixed(1)).join('L')}Z" fill="${c}" fill-opacity="${o}"/>`; };
    s += flaeche(() => 0, wp, F.wp, 0.75);
    s += flaeche(wp, (r) => wp(r) + (r.hs || 0), F.hs, 1);
    // Spitzen über 10 kW als Zahl; nahe Spitzen (< 70 px) → nur die höchste
    const pks = []; let pk = null; R.forEach((r, j) => { const v = wp(r) + (r.hs || 0);
      if (v > ym && (!pk || v > pk.v)) pk = { v, t: r.t };
      if ((v <= ym || j === R.length - 1) && pk) { pks.push(pk); pk = null; } });
    const gesetzt = []; pks.sort((a, b) => b.v - a.v).forEach((q) => { const xx = Math.min(W - 30, Math.max(L + 30, x(q.t)));
      if (gesetzt.some((g) => Math.abs(g - xx) < 70)) return; gesetzt.push(xx);
      s += `<text x="${xx}" y="${gT - 3}" font-size="${fs}" fill="${F.hs}" text-anchor="middle">↑ ${zahl(q.v)} kW</text>`; });
    s += `<path d="M${P((r) => r.hk || 0).map((p) => p[0].toFixed(1) + ',' + y(p[1]).toFixed(1)).join('L')}" fill="none" stroke="${F.hk}" stroke-width="1.8"/>`;
    s += `<line class="cur" x1="0" x2="0" y1="${top}" y2="${gT + gH}" stroke="rgba(255,255,255,.55)" display="none"/>`;
    s += `<rect class="feld" x="${L}" y="0" width="${W - L - Rr}" height="${gT + gH}" fill="transparent"/>`;
    return { html: `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${s}</svg>`, L, Rr, t0, t1, W, x };
  }

  function tipHtml(r) {
    const dt = new Date(r.t), z = (a, b) => `<div class="z"><span>${a}</span><span>${b}</span></div>`;
    const an = BAND.filter((b) => r[b[0]]).map((b) => b[1]).join(', ') || 'nichts geschaltet';
    return `<b>${TAG[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}. ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}</b>`
      + z('WP-Wärme', zahl(r.wp) + ' kW') + z('Heizstab', zahl(r.hs) + ' kW') + z('geliefert', zahl(Math.max(0, r.wp || 0) + (r.hs || 0)) + ' kW') + z('Bedarf Heizkreis', zahl(r.hk) + ' kW')
      + '<hr>' + z('Außen', zahl(r.aus) + ' °C') + z('Ecke WiGa', zahl(r.ecke) + ' °C') + z('Stellgröße', zahl(r.stg, 0))
      + '<hr>' + z('Vorlauf-Soll', zahl(r.soll) + ' °C') + z('WP-Vorlauf', zahl(r.vl) + ' °C') + z('HK-Vorlauf', zahl(r.hkvl) + ' °C') + z('HK-Rücklauf', zahl(r.rl) + ' °C')
      + `<div class="an">${an}</div>`;
  }

  class VgsHeizbedarf extends HTMLElement {
    setConfig(c) { this._c = c || {}; }
    getCardSize() { return 8; }
    getGridOptions() { return { columns: 'full', min_rows: 7 }; }
    connectedCallback() { if (!this._ro) { this._ro = new ResizeObserver(() => { const w = this.getBoundingClientRect().width; if (w && Math.abs(w - (this._w || 0)) > 4) { this._k = ''; this._zeichne(); } }); this._ro.observe(this); } }
    disconnectedCallback() { if (this._ro) { this._ro.disconnect(); this._ro = null; } }
    set hass(h) { this._h = h; const s = h.states['sensor.heizung_bedarf_verlauf']; const k = (s ? s.last_updated : '-') + '|' + Math.floor(Date.now() / 300e3);
      if (k === this._k) return; this._k = k; this._zeichne(); }
    _zeichne() {
      const h = this._h; if (!h) return;
      if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
      const pf = [], sv = h.states['sensor.heizung_bedarf_verlauf'];
      if (!sv) pf.push('fehlt sensor.heizung_bedarf_verlauf');
      const d = js(sv && sv.attributes.d), bn = js(sv && sv.attributes.bn);
      const bw = this.getBoundingClientRect().width; this._w = bw;
      const W = Math.round(Math.max(300, Math.min(1600, (bw || 600) - 32)));
      let body = '<p class="l">keine Daten</p>', R = [];
      if (d.length > 12) {
        R = rechne(d, bn, pf);
        const alt = (Date.now() - (R[R.length - 1].t + 300e3)) / 60e3;
        if (alt > 40) pf.push('Daten veraltet: letzter Wert vor ' + Math.round(alt) + ' min');
        const g = svg(R, W); this._g = g; this._R = R;
        const min = (k) => R.filter((r) => r[k]).length * 5, kwh = (k) => R.reduce((a, r) => a + Math.max(0, r[k] || 0) / 12, 0);
        const hsA = min('hsb'), hsW = R.filter((r) => r.hsb && r.wiga).length * 5, std = (m) => m >= 60 ? zahl(m / 60) + ' h' : m + ' min';
        const leg = `<p class="l"><span style="color:${F.wp}">■</span> WP-Wärme · <span style="color:${F.hs}">■</span> WP-Heizstab · <span style="color:${F.hk}">━</span> Bedarf Heizkreis · Bänder oben = was schaltet und warum`
          + ` · <abbr title="Blau = Wärme der WP, Orange = Heizstab obendrauf, rote Linie = was der Heizkreis abnimmt. Die Bänder zeigen, warum: Ventile auf → WP am Anschlag (Stellgröße ab 70) → Vorlauf unter Soll (ab 1 K, ohne WW-Ladung und Abtauen) → Heizstab. Rot und Blau schalten selbst nichts. Die beiden Zähler weichen kurzzeitig um 0,5–1 kW voneinander ab, daher nur als Größenordnung lesen. Heizstab-Leistung = WP-Strom gesamt minus Strom vor dem Heizstab.">ⓘ</abbr></p>`;
        const sum = `<p class="l s">48 h: Heizstab ${std(hsA)} · ${zahl(kwh('hs'))} kWh${hsA ? ' · davon ' + Math.round(100 * hsW / hsA) + ' % bei offenen WiGa-Ventilen' : ''} · WiGa-Ventile auf ${std(min('wiga'))} · WP-Wärme ${zahl(kwh('wp'), 0)} kWh</p>`;
        body = leg + g.html + sum;
      } else pf.push('zu wenige Daten (' + d.length + ')');
      this.shadowRoot.innerHTML = `<style>:host{display:block}ha-card{display:block;padding:8px 16px 6px;position:relative}
        .l{color:var(--secondary-text-color,var(--leise,#9ca3af));font-size:12.5px;margin:2px 0 6px;line-height:1.5}.l.s{margin:4px 0 2px}
        abbr{text-decoration:none;cursor:help}
        svg{width:100%;height:auto;display:block;font-family:sans-serif;fill:var(--secondary-text-color,var(--leise,#9ca3af));touch-action:pan-y}
        .tip{position:absolute;pointer-events:none;background:rgba(20,20,22,.95);color:#fff;font-size:12px;padding:7px 9px;border-radius:7px;border:1px solid #3f3f46;display:none;z-index:2;line-height:1.45;min-width:190px}
        .tip .z{display:flex;justify-content:space-between;gap:14px}.tip hr{border:0;border-top:1px solid #444;margin:4px 0}.tip .an{color:#aaa;margin-top:4px;max-width:230px;white-space:normal}</style>
        <ha-card>${body}<div class="tip"></div></ha-card>`;
      this.dataset.pruef = pf.length ? pf.slice(0, 3).join('; ') : 'ok';
      if (!R.length) return;
      const S = this.shadowRoot, tip = S.querySelector('.tip'), card = S.querySelector('ha-card'), el = S.querySelector('svg'), cur = S.querySelector('.cur'), g = this._g;
      const zeig = (cx, cy) => { const bb = el.getBoundingClientRect(), px = (cx - bb.left) * g.W / bb.width;
        if (px < g.L || px > g.W - g.Rr) { weg(); return false; }
        const t = g.t0 + (px - g.L) / (g.W - g.L - g.Rr) * (g.t1 - g.t0), i = Math.max(0, Math.min(R.length - 1, Math.floor((t - g.t0) / 300e3))), r = R[i];
        const xx = g.x(r.t + 150e3); cur.setAttribute('x1', xx); cur.setAttribute('x2', xx); cur.removeAttribute('display');
        tip.innerHTML = tipHtml(r); tip.style.display = 'block';
        const cr = card.getBoundingClientRect(), x = cx - cr.left, y = cy - cr.top;
        tip.style.left = (x + 14 + tip.offsetWidth > cr.width ? Math.max(0, x - 14 - tip.offsetWidth) : x + 14) + 'px';
        tip.style.top = Math.max(0, Math.min(cr.height - tip.offsetHeight - 4, y - tip.offsetHeight / 2)) + 'px'; return true; };
      const weg = () => { tip.style.display = 'none'; cur.setAttribute('display', 'none'); this._offen = false; };
      // Touch-Regel: 1× tippen = Tooltip auf, nochmal tippen = zu; Maus = folgen
      el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') zeig(e.clientX, e.clientY); });
      el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') weg(); });
      el.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') return; if (this._offen) weg(); else this._offen = zeig(e.clientX, e.clientY); });
    }
  }
  if (!customElements.get('vgs-heizbedarf-card')) customElements.define('vgs-heizbedarf-card', VgsHeizbedarf);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'vgs-heizbedarf-card', name: 'VGS Heizung – Wer braucht, wer liefert?' });
})();

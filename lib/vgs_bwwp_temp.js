// vgs-bwwp-temp-card (15.11.2026, Nutzer: „Website-Ansicht schöner“ → v3 „eine Grafik für die BWWP, Leistung mit rein, Zeitachse wie oben“)
// Eine Grafik, eine Zeitachse (alle 2/3/… h, Tageswechsel fett mit Linie):
//   links °C: Speicher mitte T2 (rot) + Warmwasser am Ausgang (gelb), Schaltschwellen gestrichelt (Text im Rand rechts, entzerrt)
//   rechts W: BWWP-Leistung als türkise Fläche (10-min-Mittel), davon BWWP-Heizstab orange; Bänder WP lädt Warmwasser (blau) / WP-Heizstab (rot)
// Daten: sensor.bwwp_temp_verlauf (SQL-Helfer, bt [10-min-Block, T2, WW, W BWWP, W Heizstab], bn [l/h/b, t, an]); Schwellen live.
// Dashboard UND Website (lib/vgs_bwwp_temp.js, app.js zeigeBwwpTemp füttert hass aus verlauf.json) – ein Code. Ersetzt die Apex-Karte „BWWP – Leistung“.
// 20.11.2026 (Nutzer: „Scroll-Funktion nach hinten wie bei den anderen Anzeigen“, Entwurf entwurf_ww_fenster.html freigegeben):
//   Zurückblättern bis 30 Tage – nur im Dashboard (hass.callWS vorhanden): 5-min-Statistik (T2, WW, BWWP, Heizstab) + Verlauf der 3 Schaltsignale,
//   alle 30 min neu; die letzten 48 h kommen weiter aus dem SQL-Sensor. Knöpfe ‹ 1 Tag · 24 h · 48 h · 7 Tage · jetzt · 1 Tag ›, in der Grafik ziehen,
//   Übersichtsleiste: Säule = BWWP-kWh je Tag (davon Heizstab orange), blauer Punkt = WP-Ladung, roter Punkt = WP-Heizstab lief während der Ladung.
//   Website (kein callWS): wie bisher 48 h ohne Knöpfe/Leiste. Gleiche Karte auch im Reiter Wasser.
// Selbstprüfung → this.dataset.pruef (UI-Check).
(() => {
  const zahl = (v, d = 1) => Number(v).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const js = (x) => { if (typeof x === 'string') { try { return JSON.parse(x); } catch (e) { return []; } } return x || []; };
  const STD = 3600e3, BLK = 600e3;
  const tagPlus = (t, n) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); };
  const STAT = ['sensor.cmi_bwwp_mitte', 'sensor.cmi_t_warmwasser', 'sensor.keller_bwwp_shelly_leistung', 'sensor.bwwp_heizstab_leistung'];
  const SIG = { 'binary_sensor.cmi_anforderung_wp_ww_ladung': 'l', 'binary_sensor.wp_heizstab': 'h', 'binary_sensor.bwwp_lauft': 'b' };
  // Intervalle [an, aus] eines Schaltsignals im Bereich t0–t1. Erster Eintrag „aus“ heißt nicht „vorher an“ (HA schreibt nach Neustart „off“).
  const iv = (bn, e, t0, t1) => { const out = []; let an = null; for (const x of bn) { if (x[0] !== e) continue; const t = x[1] * 1000;
    if (x[2] && an === null) an = t; else if (!x[2] && an !== null) { if (t > t0 && an < t1) out.push([Math.max(an, t0), Math.min(t, t1)]); an = null; } }
    if (an !== null && an < t1) out.push([Math.max(an, t0), t1]); return out; };
  const schnitt = (A, B) => { const o = []; for (const [a, b] of A) for (const [c, d] of B) { const x = Math.max(a, c), y = Math.min(b, d); if (y > x) o.push([x, y]); } return o; };

  class VgsBwwpTemp extends HTMLElement {
    setConfig(c) { this._c = c || {}; }
    getCardSize() { return 8; }
    getGridOptions() { return { columns: 'full', min_rows: 7 }; }
    connectedCallback() { if (!this._ro) { this._ro = new ResizeObserver(() => { const w = this.getBoundingClientRect().width; if (w && Math.abs(w - (this._w || 0)) > 4) { this._k = ''; this._zeichne(); } }); this._ro.observe(this); } }
    disconnectedCallback() { if (this._ro) { this._ro.disconnect(); this._ro = null; } }
    set hass(h) {
      this._h = h; const ids = ['sensor.bwwp_temp_verlauf', 'sensor.naechster_start', 'input_number.uvr_ww_soll', 'input_number.uvr_ww_diff_aus', 'input_number.uvr_ww_diff_ein', 'input_number.bwwp_soll_et'];
      if (typeof h.callWS === 'function' && !this._laedt && (!this._lang || Date.now() - this._lang.t > 30 * 60e3) && Date.now() - (this._versuch || 0) > 5 * 60e3) this._lade();
      const k = ids.map((e) => { const s = h.states[e]; return s ? s.last_updated : '-'; }).join('|') + '|' + Math.floor(Date.now() / 300e3);
      if (k === this._k) return; this._k = k; this._zeichne();
    }
    async _lade() {
      this._laedt = true; this._versuch = Date.now();
      try {
        const t0 = tagPlus(Date.now(), -30), iso = new Date(t0).toISOString();
        const [st, hi] = await Promise.all([
          this._h.callWS({ type: 'recorder/statistics_during_period', start_time: iso, period: '5minute', statistic_ids: STAT, types: ['mean'] }),
          this._h.callWS({ type: 'history/history_during_period', start_time: iso, entity_ids: Object.keys(SIG), minimal_response: true, no_attributes: true, significant_changes_only: false })]);
        const M = new Map();
        STAT.forEach((sid, i) => { for (const r of (st[sid] || [])) { if (r.mean == null) continue; const s = typeof r.start === 'number' ? r.start : Date.parse(r.start);
          const b = Math.floor(s / BLK); let z = M.get(b); if (!z) M.set(b, (z = [[], [], [], []])); z[i].push(r.mean); } });
        const mw = (l, d) => (l.length ? Math.round(l.reduce((a, x) => a + x, 0) / l.length * 10 ** d) / 10 ** d : null);
        const bt = [...M.keys()].sort((a, b) => a - b).map((b) => { const z = M.get(b); return [b, mw(z[0], 1), mw(z[1], 1), mw(z[2], 0), mw(z[3], 0)]; });
        const bn = [];
        for (const [e, c] of Object.entries(SIG)) { let last = null; for (const x of (hi[e] || [])) { const o = x.s === 'on' ? 1 : x.s === 'off' ? 0 : null; if (o === null || o === last) continue;
          bn.push([c, Math.floor(x.lu ?? x.lc ?? 0), o]); last = o; } }
        bn.sort((a, b) => a[1] - b[1]);
        this._lang = { bt, bn, t: Date.now() }; this._fehler = '';
      } catch (e) { this._fehler = 'Langzeitdaten: ' + ((e && e.message) || e); }
      this._laedt = false; this._k = ''; this._zeichne();
    }
    // 48 h aus dem Sensor + ältere Blöcke/Schaltwechsel aus der Langzeit-Ladung
    _daten(bt, bn) {
      const L = this._lang; if (!L || !L.bt.length || !bt.length) return { bt, bn };
      const b0 = bt[0][0], s0 = bn.length ? bn[0][1] : b0 * 600;
      return { bt: L.bt.filter((r) => r[0] < b0).concat(bt), bn: L.bn.filter((x) => x[1] < s0).concat(bn) };
    }
    _zeichne() {
      const h = this._h; if (!h) return;
      if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
      const R = this.shadowRoot;
      if (!R.querySelector('ha-card')) this._geruest();
      const pf = [], sv0 = h.states['sensor.bwwp_temp_verlauf'];
      if (!sv0) pf.push('fehlt sensor.bwwp_temp_verlauf');
      if (this._fehler) pf.push(this._fehler);
      const D = this._daten(js(sv0 && sv0.attributes.bt), js(sv0 && sv0.attributes.bn));
      const g = (((h.states['sensor.naechster_start'] || {}).attributes || {}).geraete || {}).bwwp || {};
      const f = (e) => parseFloat((h.states[e] || {}).state);
      const bw = this.getBoundingClientRect().width; this._w = bw;
      const W = Math.round(Math.max(300, Math.min(1600, (bw || 600) - 32)));
      // Fenster: t1 = null folgt „jetzt“; Bereich = vorhandene Daten
      const jetzt = Date.now(), tAnf = D.bt.length ? D.bt[0][0] * BLK : jetzt - 48 * STD;
      const lang = !!this._lang && jetzt - tAnf > 3 * 24 * STD;
      let fen = lang ? (this._fen || 48 * STD) : 48 * STD; fen = Math.max(12 * STD, Math.min(fen, Math.max(48 * STD, jetzt - tAnf)));
      let t1 = lang && this._t1 != null ? this._t1 : jetzt; t1 = Math.min(jetzt, Math.max(tAnf + fen, t1)); if (t1 >= jetzt - 60e3) t1 = jetzt;
      this._fen = fen; const t0 = t1 - fen;
      const r = VgsBwwpTemp.svg(D.bt, D.bn, g, f, W, zahl, pf, t0, t1);
      this._geo = { W, X0: r.X0, X1: r.X1, fen, t1, tAnf, jetzt, lang };
      R.querySelector('.haupt').innerHTML = r.svg;
      const ld = R.querySelector('.leiste'), kn = R.querySelector('.kopf');
      kn.hidden = !lang; ld.hidden = !lang; R.querySelector('.ll').hidden = !lang;
      if (lang) {
        ld.innerHTML = VgsBwwpTemp.leiste(D.bt, D.bn, W, r.X0, r.X1, tAnf, jetzt, t0, t1, zahl, pf);
        const fz = (o) => new Date(o).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
        R.querySelector('.zeit').textContent = `${fz(t0)} – ${t1 === jetzt ? 'jetzt' : fz(t1)}`;
        R.querySelectorAll('button[data-w]').forEach((b) => b.classList.toggle('an', Number(b.dataset.w) * STD === fen));
        R.querySelector('button[data-j]').classList.toggle('an', t1 === jetzt);
      }
      this._tipps();
      this.dataset.pruef = pf.length ? pf.join('; ') : 'ok';
    }
    _geruest() {
      const R = this.shadowRoot;
      const leg = `<p class="l"><span style="color:#ef4444">━</span> Speicher mitte (T2, danach schaltet die BWWP) · <span style="color:#facc15">━</span> Warmwasser am Ausgang · <span style="color:#2dd4bf">■</span> BWWP-Leistung (rechte Achse, W) · <span style="color:#f59e0b">■</span> davon BWWP-Heizstab · <span style="color:#3b82f6">■</span> WP lädt Warmwasser · <span style="color:#ef4444">■</span> WP-Heizstab während der Warmwasser-Ladung · ▼ Auslöser (T2 unter Schwelle) · gestrichelt = Schaltschwellen (heutige Werte)</p>`
        + `<p class="l ll">Leiste: Säule = BWWP-Strom je Tag (kWh, davon Heizstab orange) · <span style="color:#3b82f6">●</span> WP-Ladung · <span style="color:#ef4444">●</span> WP-Heizstab lief während der Ladung · gelb = sichtbarer Ausschnitt (ziehen, Griffe = breiter/schmaler, Tag antippen = hinspringen)</p>`;
      R.innerHTML = `<style>:host{display:block}ha-card{display:block;padding:10px 16px 6px;position:relative}.l{color:var(--secondary-text-color,var(--leise,#9ca3af));font-size:12.5px;margin:2px 0 4px;line-height:1.5}
        .kopf{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:space-between;margin:0 0 2px}.zeit{color:var(--secondary-text-color,#9ca3af);font-size:13px}
        .kn{display:flex;flex-wrap:wrap;gap:4px}.kn button{background:rgba(127,127,127,.14);color:var(--primary-text-color,#e5e7eb);border:1px solid rgba(127,127,127,.35);border-radius:6px;padding:3px 9px;font-size:13px;cursor:pointer;font-family:inherit}
        .kn button.an{border-color:#facc15;background:rgba(250,204,21,.14)}
        svg{width:100%;height:auto;display:block;font:11px sans-serif;fill:var(--secondary-text-color,var(--leise,#9ca3af));user-select:none;-webkit-user-select:none}
        .haupt.zug{cursor:grab;touch-action:pan-y}.haupt.zieh{cursor:grabbing}.leiste{touch-action:pan-y}[hidden]{display:none!important}
        .tip{position:absolute;pointer-events:none;background:rgba(20,20,22,.95);color:#fff;font-size:12px;padding:6px 8px;border-radius:6px;border:1px solid #3f3f46;white-space:nowrap;display:none;z-index:2;line-height:1.45}</style>
        <ha-card><div class="kopf" hidden><span class="zeit"></span><span class="kn"><button data-s="-1">‹ 1 Tag</button><button data-w="24">24 h</button><button data-w="48">48 h</button><button data-w="168">7 Tage</button><button data-j="1">jetzt</button><button data-s="1">1 Tag ›</button></span></div>
        <div class="haupt"></div><div class="leiste" hidden></div>${leg}<div class="tip"></div></ha-card>`;
      const hd = R.querySelector('.haupt'), ld = R.querySelector('.leiste'), tip = R.querySelector('.tip');
      const proPx = (el, breite) => { const g = this._geo; return g.W / el.getBoundingClientRect().width * breite / (g.X1 - g.X0); };
      R.querySelectorAll('.kn button').forEach((b) => b.addEventListener('click', () => { const g = this._geo; if (!g) return;
        if (b.dataset.w) this._fen = Number(b.dataset.w) * STD;
        if (b.dataset.j) this._t1 = null;
        if (b.dataset.s) this._t1 = Math.min(g.jetzt, g.t1 + Number(b.dataset.s) * 24 * STD);
        tip.style.display = 'none'; this._zeichne(); }));
      // In der Grafik ziehen (Maus + Finger waagerecht); kurzer Tipp ohne Bewegung bleibt Tooltip (Touch-Regel 08.10.2026)
      let zg = null;
      hd.addEventListener('pointerdown', (e) => { const g = this._geo; if (!g || !g.lang || (e.pointerType === 'mouse' && e.button !== 0)) return; zg = { x: e.clientX, t1: g.t1, id: e.pointerId, weg: false }; });
      hd.addEventListener('pointermove', (e) => { if (!zg || e.pointerId !== zg.id) return; const dx = e.clientX - zg.x;
        if (!zg.weg && Math.abs(dx) < 6) return; if (!zg.weg) { zg.weg = true; try { hd.setPointerCapture(e.pointerId); } catch (x) {} hd.classList.add('zieh'); tip.style.display = 'none'; }
        this._t1 = zg.t1 - dx * proPx(hd, this._geo.fen); this._zeichne(); });
      const ende = () => { if (zg && zg.weg) { this._klickSperre = Date.now(); } zg = null; hd.classList.remove('zieh'); };
      hd.addEventListener('pointerup', ende); hd.addEventListener('pointercancel', ende);
      // Leiste: gelbes Fenster verschieben, Griffe a/b ziehen, Tag antippen
      let lz = null;
      ld.addEventListener('pointerdown', (e) => { const g = this._geo, ziel = e.target.dataset || {}; if (!g) return;
        if (e.target.classList.contains('fen') || ziel.g) { lz = { x: e.clientX, t1: g.t1, fen: g.fen, g: ziel.g, id: e.pointerId }; try { ld.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); } });
      ld.addEventListener('pointermove', (e) => { if (!lz || e.pointerId !== lz.id) return; const g = this._geo, dt = (e.clientX - lz.x) * proPx(ld, g.jetzt - g.tAnf);
        if (lz.g === 'a') { this._fen = lz.fen - dt; this._t1 = lz.t1; } else if (lz.g === 'b') { this._t1 = lz.t1 + dt; this._fen = lz.fen + dt; } else this._t1 = lz.t1 + dt;
        tip.style.display = 'none'; this._zeichne(); });
      const lende = () => { if (lz) this._klickSperre = Date.now(); lz = null; };
      ld.addEventListener('pointerup', lende); ld.addEventListener('pointercancel', lende);
      ld.addEventListener('click', (e) => { const t = e.target.dataset && e.target.dataset.t; if (!t || Date.now() - (this._klickSperre || 0) < 300) return; const g = this._geo;
        this._t1 = Math.min(g.jetzt, tagPlus(Number(t), 1) + Math.max(0, g.fen - 24 * STD) / 2); tip.style.display = 'none'; this._zeichne(); });
    }
    _tipps() {
      const R = this.shadowRoot, tip = R.querySelector('.tip'), card = R.querySelector('ha-card');
      R.querySelectorAll('[data-tip]').forEach((el) => {
        el.addEventListener('mouseenter', (e) => { if (e.buttons) return; tip.innerHTML = el.dataset.tip; tip.style.display = 'block'; });
        el.addEventListener('mousemove', (e) => { if (e.buttons) return; const r = card.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
          tip.style.left = Math.max(0, Math.min(r.width - tip.offsetWidth - 4, x + 12)) + 'px'; tip.style.top = Math.max(0, y - tip.offsetHeight - 8) + 'px'; });
        el.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
        if (!el.dataset.t) el.addEventListener('click', () => { if (Date.now() - (this._klickSperre || 0) < 300) return; tip.innerHTML = el.dataset.tip; tip.style.display = 'block'; const b = el.getBoundingClientRect(), r = card.getBoundingClientRect();
          tip.style.left = Math.max(0, Math.min(r.width - tip.offsetWidth - 4, b.left - r.left - 40)) + 'px'; tip.style.top = '4px'; });
      });
    }
    static svg(bt, bn, g, f, W, zahl, pf, t0, t1) {
      if (bt.length < 3) { pf.push('keine Daten'); return { svg: '<p>Noch keine Daten.</p>', X0: 34, X1: W - 150 }; }
      const sw = [[Number(g.start ?? 52), 'BWWP an', '#60a5fa'], [Number(g.stop), 'BWWP aus', '#2dd4bf'], [f('input_number.uvr_ww_soll') + f('input_number.uvr_ww_diff_aus'), 'WP-Ladung aus', '#fb923c'],
        [f('input_number.uvr_ww_soll') + f('input_number.uvr_ww_diff_ein'), 'WP lädt nach', '#fb923c'], [f('input_number.bwwp_soll_et') - 1, 'BWWP-Heizstab', '#ef4444']].filter((x) => isFinite(x[0]));
      const kurz = W < 520, H = kurz ? 260 : 300, Lr = 34, Rr = kurz ? 112 : 150, T = 22, B = 30, xr = W - Rr;
      const X = (t) => Lr + (t - t0) / (t1 - t0) * (xr - Lr), lo = 25, hi = 60, Y = (c) => T + (1 - (Math.max(lo, Math.min(hi, c)) - lo) / (hi - lo)) * (H - T - B);
      const sicht = bt.filter((r) => r[0] * BLK + BLK > t0 && r[0] * BLK < t1);
      const pmax = Math.max(0, ...sicht.map((r) => Number(r[3]) || 0)), wmax = pmax > 500 ? Math.ceil(pmax / 500) * 500 : 500, YW = (w) => H - B - Math.max(0, Math.min(w, wmax)) / wmax * (H - T - B);
      let sv = `<clipPath id="bwk"><rect x="${Lr}" y="0" width="${xr - Lr}" height="${H}"/></clipPath>`;
      for (const c of [30, 40, 50, 60]) sv += `<line x1="${Lr}" x2="${xr}" y1="${Y(c)}" y2="${Y(c)}" stroke="rgba(127,127,127,.22)"/><text x="${Lr - 5}" y="${Y(c) + 4}" text-anchor="end">${c}°</text>`;
      for (let i = 0; i <= 5; i++) { const w = wmax * i / 5; sv += `<text x="${xr + 5}" y="${YW(w) + 4}" fill="#2dd4bf" style="font-size:10px">${zahl(w, 0)}</text>`; }
      sv += `<text x="${xr + 5}" y="${T - 9}" fill="#2dd4bf" style="font-size:10px">W</text>`;  // 18.11.2026: T 12 → 22, „W“ nicht mehr auf der obersten Zahl (Nutzer)
      // 15.11.2026 v5 (Nutzer: „hier nur die WW-Bereitung“): WP-Heizstab nur, solange die WP Warmwasser lädt (Heiz-Einsätze stehen in „Wer hilft der WP?“)
      const L = iv(bn, 'l', t0, t1), HS = schnitt(iv(bn, 'h', t0, t1), L);
      const rect = (l, c, op) => l.map(([a, b]) => `<rect x="${X(a).toFixed(1)}" y="${T}" width="${Math.max(1, X(b) - X(a)).toFixed(1)}" height="${H - T - B}" fill="${c}" opacity="${op}"/>`).join('');
      sv += rect(L, '#3b82f6', 0.2) + rect(HS, '#ef4444', 0.35);
      // Leistung als Treppe je 10-min-Block (rechte Achse)
      const flaeche = (k, col, op) => { let d = ''; for (const r of sicht) { const w = Number(r[k]) || 0, t = r[0] * BLK; if (w < 1) continue;
        d += `M${X(Math.max(t, t0)).toFixed(1)} ${YW(0).toFixed(1)}V${YW(w).toFixed(1)}H${X(Math.min(t + BLK, t1)).toFixed(1)}V${YW(0).toFixed(1)}Z`; } return d ? `<path d="${d}" fill="${col}" fill-opacity="${op}"/>` : ''; };
      sv += flaeche(3, '#2dd4bf', 0.28) + flaeche(4, '#f59e0b', 0.65);
      const lab = sw.map(([c, n, col]) => ({ c, n: kurz ? n.replace('WP-Ladung aus', 'Ladung aus').replace('WP lädt nach', 'lädt nach').replace('BWWP-Heizstab', 'Heizstab') : n, col, y: Y(c) + 3.5 })).sort((a, b) => a.y - b.y);
      for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 12) lab[i].y = lab[i - 1].y + 12;
      for (const l of lab) sv += `<line x1="${Lr}" x2="${xr}" y1="${Y(l.c)}" y2="${Y(l.c)}" stroke="${l.col}" stroke-dasharray="5 4" stroke-width="1.2" opacity=".85"/>`
        + `<text x="${xr + 38}" y="${l.y}" fill="${l.col}" style="font-size:10px">${l.n} ${zahl(l.c, 0)}°</text>`;
      if (!lab.every((l) => l.y <= H - B + 2)) pf.push('Schwellen-Text unter dem Zeichenbereich');
      const linie = (k, col, w) => { let last = null; const pts = []; for (const r of bt) { const val = r[k] ?? last; if (val == null) continue; last = val; const t = r[0] * BLK + BLK / 2; if (t < t0 - BLK || t > t1 + BLK) continue; pts.push(`${X(t).toFixed(1)},${Y(val).toFixed(1)}`); }
        return `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="${w}" clip-path="url(#bwk)" style="pointer-events:none"/>`; };
      sv += linie(2, '#facc15', 1.6) + linie(1, '#ef4444', 2.6);
      // Auslöser: Dreieck auf T2 beim Start der WP-Ladung (blau) bzw. der BWWP (türkis); T2 = Wert des 10-min-Blocks
      const t2bei = (t) => { let v = null; for (const r of bt) { if (r[0] * BLK > t) break; if (r[1] != null) v = r[1]; } return v; };
      const mark = (e, col, txt) => bn.filter((x) => x[0] === e && x[2] && x[1] * 1000 >= t0 && x[1] * 1000 <= t1).map((x) => { const t = x[1] * 1000, v = t2bei(t); if (v == null) return '';
        const cx = X(t), cy = Y(v) - 7, z = new Date(t).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
        return `<path d="M${(cx - 5).toFixed(1)} ${(cy - 7).toFixed(1)}H${(cx + 5).toFixed(1)}L${cx.toFixed(1)} ${cy.toFixed(1)}Z" fill="${col}" stroke="#111" stroke-width=".8"><title>${txt} ${z} · T2 ${zahl(v, 1)} °C</title></path>`; }).join('');
      sv += mark('b', '#2dd4bf', 'BWWP an') + mark('l', '#3b82f6', 'WP lädt Warmwasser');
      // Zeitachse: Schritt so, dass ≥ 48 px je Beschriftung; Mitternacht = Wochentag + Datum fett mit Linie; ab 24-h-Schritt nur Tage
      const std = (t1 - t0) / STD, pxh = (xr - Lr) / std, st = [1, 2, 3, 4, 6, 12, 24].find((x) => x * pxh >= 48) || 24;
      sv += `<line x1="${Lr}" x2="${xr}" y1="${H - B}" y2="${H - B}" stroke="rgba(127,127,127,.5)"/>`;
      for (let hh = Math.ceil(t0 / STD); hh * STD < t1; hh++) { const t = hh * STD, d = new Date(t), hr = d.getHours(); if (hr && (hr % st || st >= 24)) continue;
        const x = X(t).toFixed(1), tag = hr === 0;
        sv += `<line x1="${x}" x2="${x}" y1="${H - B}" y2="${H - B + 4}" stroke="rgba(127,127,127,.6)"/>` + (tag ? `<line x1="${x}" x2="${x}" y1="${T}" y2="${H - B}" stroke="rgba(127,127,127,.35)"/>` : '')
          + `<text x="${x}" y="${H - B + 16}" text-anchor="middle" ${tag ? 'style="font-weight:700;fill:var(--primary-text-color,var(--text,#e5e7eb))"' : ''}>${tag ? d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' }) : String(hr).padStart(2, '0') + ':00'}</text>`; }
      // Tooltip-Flächen je 10-min-Block
      let l1 = null, l2 = null;
      for (const r of bt) { l1 = r[1] ?? l1; l2 = r[2] ?? l2; const t = r[0] * BLK; if (t + BLK <= t0 || t >= t1) continue;
        const z = new Date(t + BLK / 2).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
        const xa = X(Math.max(t, t0)), xb = X(Math.min(t + BLK, t1));
        sv += `<rect x="${xa.toFixed(1)}" y="${T}" width="${Math.max(0.5, xb - xa).toFixed(2)}" height="${H - T - B}" fill="transparent" data-tip="<b>${z}</b><br>Speicher mitte (T2) ${l1 != null ? zahl(l1, 1) : '–'} °C<br>Warmwasser ${l2 != null ? zahl(l2, 1) : '–'} °C<br>BWWP ${zahl(Number(r[3]) || 0, 0)} W${Number(r[4]) > 0 ? ' · davon Heizstab ' + zahl(Number(r[4]), 0) + ' W' : ''}"/>`; }
      return { svg: `<svg viewBox="0 0 ${W} ${H}">${sv}</svg>`, X0: Lr, X1: xr };
    }
    // Übersichtsleiste: je Tag BWWP-kWh (10-min-Mittel W ÷ 6000), davon Heizstab; Punkte WP-Ladung (blau) / WP-Heizstab während der Ladung (rot)
    static leiste(bt, bn, W, X0, X1, tAnf, tEnde, t0, t1, zahl, pf) {
      const H = 58, T = 6, B = 16, X = (t) => X0 + (t - tAnf) / (tEnde - tAnf) * (X1 - X0), tage = [];
      for (let t = tagPlus(tAnf, 0); t < tEnde; t = tagPlus(t, 1)) { const e = tagPlus(t, 1); let k = 0, hz = 0;
        for (const r of bt) { const s = r[0] * BLK; if (s < t || s >= e) continue; k += (Number(r[3]) || 0) / 6000; hz += (Number(r[4]) || 0) / 6000; }
        const nl = bn.filter((x) => x[0] === 'l' && x[2] && x[1] * 1000 >= t && x[1] * 1000 < e).length;
        const wh = Math.round(schnitt(iv(bn, 'h', t, e), iv(bn, 'l', t, e)).reduce((a, [x, y]) => a + (y - x) / 60e3, 0));
        if (hz > k + 0.01 || k < 0 || hz < 0) pf.push('Leiste: Heizstab > BWWP am ' + new Date(t).toLocaleDateString('de-DE'));
        tage.push({ t, e, k, hz, nl, wh }); }
      const kmax = Math.max(0.5, ...tage.map((d) => d.k)), hb = H - T - B - 12;
      let s = `<rect x="${X0}" y="${T}" width="${X1 - X0}" height="${H - T - B}" fill="rgba(127,127,127,.06)"/>`;
      for (const d of tage) { const x = X(Math.max(d.t, tAnf)), w = X(Math.min(d.e, tEnde)) - x; if (w < 2) continue; const h = hb * d.k / kmax, hh = hb * d.hz / kmax, dt = new Date(d.t);
        s += `<rect x="${(x + 1.5).toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${Math.max(1, w - 3).toFixed(1)}" height="${h.toFixed(1)}" fill="#2dd4bf" opacity=".45"/>`
          + (hh > 0.5 ? `<rect x="${(x + 1.5).toFixed(1)}" y="${(H - B - hh).toFixed(1)}" width="${Math.max(1, w - 3).toFixed(1)}" height="${hh.toFixed(1)}" fill="#f59e0b" opacity=".85"/>` : '');
        const pk = Math.max(2, Math.min(2.6, w / 8)); let px = x + 2 + pk;
        for (let i = 0; i < d.nl; i++, px += pk * 2.6) s += `<circle cx="${px.toFixed(1)}" cy="${T + 5}" r="${pk}" fill="#3b82f6"/>`;
        if (d.wh > 0) s += `<circle cx="${px.toFixed(1)}" cy="${T + 5}" r="${pk}" fill="#ef4444"/>`;
        s += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 3}" text-anchor="middle" style="font-size:10px">${w > 34 ? dt.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' }) : w > 13 ? dt.getDate() : ''}</text>`;
        s += `<rect data-t="${d.t}" x="${x.toFixed(1)}" y="${T}" width="${w.toFixed(1)}" height="${H - T - B}" fill="transparent" style="cursor:pointer" data-tip="<b>${dt.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'numeric' })}</b><br>BWWP ${zahl(d.k, 2)} kWh${d.hz > 0.01 ? ' · davon Heizstab ' + zahl(d.hz, 2) + ' kWh' : ''}<br>WP-Ladungen ${d.nl}${d.wh > 0 ? ' · WP-Heizstab ' + d.wh + ' min' : ''}"/>`; }
      const a = X(t0), b = X(t1);
      s += `<rect class="fen" x="${a.toFixed(1)}" y="${T - 2}" width="${Math.max(4, b - a).toFixed(1)}" height="${H - T - B + 4}" fill="#e5e7eb" fill-opacity="0.12" stroke="#e5e7eb" stroke-width="1.5" rx="3" style="cursor:grab"/>`
        + `<rect data-g="a" x="${(a - 3.5).toFixed(1)}" y="${T - 3}" width="7" height="${H - T - B + 6}" rx="2" fill="#facc15" style="cursor:ew-resize"/><rect data-g="b" x="${(b - 3.5).toFixed(1)}" y="${T - 3}" width="7" height="${H - T - B + 6}" rx="2" fill="#facc15" style="cursor:ew-resize"/>`
        + [a, b].map((x) => `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${(T + (H - T - B) / 2 - 4).toFixed(1)}" y2="${(T + (H - T - B) / 2 + 8).toFixed(1)}" stroke="#1c1c1c" stroke-width="1.4" pointer-events="none"/>`).join('')   // 22.11.2026 (Nutzer): Schieber einheitlich wie Wärmebild (weißer Rahmen, Griffe volle Höhe + Strich);
      return `<svg viewBox="0 0 ${W} ${H}">${s}</svg>`;
    }
  }
  if (!customElements.get('vgs-bwwp-temp-card')) customElements.define('vgs-bwwp-temp-card', VgsBwwpTemp);
  window.customCards = window.customCards || []; window.customCards.push({ type: 'vgs-bwwp-temp-card', name: 'VGS Warmwasser – Speicher und BWWP' });
})();

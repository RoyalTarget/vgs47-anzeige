// vgs-waermekosten-card (15.11.2026, Nutzer: „Kunden fragen: heute X kWh Strom für Y kWh Wärme, kostet Z – im Vergleich zu Gas/Öl“)
// Daten: sensor.waerme_kosten (packages/waerme_kosten.yaml), Attribute heute/gestern/monat + p (Annahmen). Gleiche Zeichnung wie
// Website app.js zeigeWaermeKosten (VgsWaermeKosten.html wird dort 1:1 kopiert → bei Änderung beide anpassen).
// Selbstprüfung: Summen Strom/Wärme = Teile, Kosten ≥ 0, Wärme ≥ Strom (AZ ≥ 1) → this.dataset.pruef.
(() => {
  const zahl = (v, d = 1) => Number(v).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const eur = (v) => zahl(v, 2) + ' €';
  // gemeinsame Rechnung + HTML (Website kopiert diese Funktion)
  function waermeKostenHtml(a, sel, zahl, pf) {
    const T = { heute: 'Heute', gestern: 'Gestern', monat: 'Monat' };
    const d = a[sel] || {}, p = a.p || {};
    const n = (k) => Number(d[k]) || 0;
    const strom = n('s_wp') + n('s_bw') + n('s_dk'), waerme = n('w_hk') + n('w_ww') + n('w_dk'), pv = Math.min(n('pv'), strom);
    if (!strom) return { html: `<p class="wk-leer">${sel === 'gestern' ? 'Gestern noch nicht erfasst.' : 'Noch keine Daten.'}</p>`, ok: true };
    const kN = strom * p.sp / 100, kPv = (strom - pv) * p.sp / 100 + pv * p.ev / 100;
    const gasKwh = waerme / p.ge, kG = gasKwh * p.gp / 100, oelL = waerme / p.oe / p.ok, kO = oelL * p.op / 100, az = waerme / strom;
    if ([kN, kG, kO].some((x) => !(x >= 0))) pf.push(sel + ': Kosten ungültig');
    if (az < 1) pf.push(sel + ': Wärme < Strom');
    const tage = sel === 'monat' ? (Number(p.tm) || 1) : 1, gfix = (Number(p.gf) || 0) * tage;
    const mx = Math.max(kN, kG, kO), r = (x) => `${Math.max(2, x / mx * 100).toFixed(1)}%`;
    const d2 = (v) => zahl(v, sel === 'monat' ? 0 : 1);
    const bar = (name, sub, k, col, txt) => `<div class="wk-b"><div class="wk-bn">${name}<small>${sub}</small></div><div class="wk-bt"><i style="width:${r(k)};background:${col}"></i></div><div class="wk-be"><b>${eur(k)}</b>${txt ? `<small>${txt}</small>` : ''}</div></div>`;
    const html = `<div class="wk-satz"><b>${d2(strom)} kWh Strom</b> → <b style="color:#fb923c">${d2(waerme)} kWh Wärme</b><span class="wk-az">Arbeitszahl ${zahl(az, 1)}</span></div>`
      + bar('Wärmepumpen', `${zahl(p.sp, 2)} ct/kWh Netzstrom`, kN, '#22c55e', pv > 0.05 ? `mit eigener PV ${eur(kPv)}` : '')
      + bar('Gaskessel', `gleiche Wärme · Wirkungsgrad ${zahl(p.ge, 2)} · ${zahl(p.gp, 2)} ct/kWh`, kG, '#60a5fa', `${d2(gasKwh)} kWh Gas`)
      + bar('Ölkessel', `gleiche Wärme · Wirkungsgrad ${zahl(p.oe, 2)} · ${zahl(p.op, 2)} €/100 l`, kO, '#a16207', `${d2(oelL)} l Öl`)
      // 15.11.2026 (Nutzer, Fassung a+b): Kessel benannt, nur Arbeitspreise; zweite Zeile mit Gas-Grundpreis + Wartung (fallen beim Umstieg weg)
      + `<div class="wk-sp">${T[sel]} günstiger als ein Gaskessel: <b>${eur(kG - kN)}</b> · als ein Ölkessel: <b>${eur(kO - kN)}</b>`
      + (gfix > 0 ? `<br>Mit Gas-Grundpreis und Wartung (${eur(p.gf)}/Tag${sel === 'monat' ? ` × ${tage} Tage` : ''}), die mit der Gasheizung wegfallen: <b>${eur(kG + gfix - kN)}</b>` : '') + `</div>`
      + `<details class="wk-d"><summary>Rechnung &amp; Annahmen</summary>`
      + `<div>Strom: Wolf-WP ${d2(n('s_wp'))} · Brauchwasser-WP ${d2(n('s_bw'))} · Daikin ${d2(n('s_dk'))} kWh${pv > 0.05 ? ` (davon ${d2(pv)} kWh vom Dach)` : ''}</div>`
      + `<div>Wärme: Heizkreis ${d2(n('w_hk'))} · Warmwasser ${d2(n('w_ww'))} · Daikin ${d2(n('w_dk'))} kWh (geschätzt, COP ${zahl(p.cop, 1)})</div>`
      + `<div>Wärme = was im Haus ankommt (Wärmezähler Heizkreis + Warmwasser am Hahn). Gas und Öl müssten dieselbe Wärme liefern: Gas ${d2(waerme)} ÷ ${zahl(p.ge, 2)} = ${d2(gasKwh)} kWh, Öl ${d2(waerme)} ÷ ${zahl(p.oe, 2)} ÷ ${zahl(p.ok, 0)} kWh/l = ${d2(oelL)} l.</div>`
      + `<div>Balken: nur Arbeitspreise – Grundpreise, Wartung, Schornsteinfeger nicht enthalten (Gas-Grundpreis + Wartung stehen in der zweiten Zeile). Mit eigener PV: Dach-Strom zählt mit ${zahl(p.ev, 0)} ct entgangener Einspeisung. Ölpreis Stand ${String(p.stand || '–').replace(/[<>&]/g, '')}. Öl-Brennwertkessel rechnet mit ca. 0,92.</div></details>`;
    return { html, ok: true };
  }
  const STIL = `<style>
    .wk-tabs{display:flex;gap:6px;margin-bottom:10px}.wk-tabs span{padding:4px 12px;border-radius:14px;background:rgba(127,127,127,.12);cursor:pointer;font-size:13px}
    .wk-tabs span.on{background:#fb923c;color:#111;font-weight:600}
    .wk-satz{font-size:18px;margin:2px 0 10px;line-height:1.4}.wk-az{display:inline-block;margin-left:10px;font-size:13px;color:var(--secondary-text-color,var(--leise))}
    .wk-b{display:grid;grid-template-columns:minmax(120px,190px) 1fr auto;gap:10px;align-items:center;padding:5px 0}
    .wk-bn{font-weight:500}.wk-bn small,.wk-be small{display:block;font-weight:400;font-size:11.5px;color:var(--secondary-text-color,var(--leise))}
    .wk-bt{height:14px;border-radius:7px;background:rgba(127,127,127,.12);overflow:hidden}.wk-bt i{display:block;height:100%;border-radius:7px}
    .wk-be{text-align:right;white-space:nowrap;min-width:92px}
    .wk-sp{margin-top:8px;font-size:13.5px}
    .wk-d{margin-top:8px;font-size:12.5px;color:var(--secondary-text-color,var(--leise))}.wk-d summary{cursor:pointer}.wk-d div{margin-top:4px;line-height:1.45}
    .wk-leer{color:var(--secondary-text-color,var(--leise))}
    @media (max-width:500px){.wk-b{grid-template-columns:1fr auto;grid-template-areas:"n e" "t t";row-gap:3px}.wk-bn{grid-area:n}.wk-be{grid-area:e}.wk-bt{grid-area:t}}
  </style>`;
  class VgsWaermeKosten extends HTMLElement {
    setConfig(c) { this._c = c || {}; this._sel = 'heute'; }
    getCardSize() { return 5; }
    getGridOptions() { return { columns: 'full', min_rows: 4 }; }
    set hass(h) { this._h = h; const s = h.states['sensor.waerme_kosten']; const k = s ? s.last_updated : '-'; if (k === this._k) return; this._k = k; this._zeichne(); }
    _zeichne() {
      const h = this._h; if (!h) return; if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
      const s = h.states['sensor.waerme_kosten'], pf = [];
      let inhalt;
      if (!s) { pf.push('fehlt sensor.waerme_kosten'); inhalt = '<p>sensor.waerme_kosten fehlt</p>'; }
      else { inhalt = ['heute', 'gestern', 'monat'].map((t) => { const r = waermeKostenHtml(s.attributes, t, zahl, pf); return `<div data-t="${t}" ${t === this._sel ? '' : 'hidden'}>${r.html}</div>`; }).join(''); }
      const offen = this.shadowRoot.querySelector('details[open]') != null;
      this.shadowRoot.innerHTML = STIL + `<ha-card style="padding:12px 16px"><div class="wk-tabs">${['heute', 'gestern', 'monat'].map((t) => `<span data-t="${t}" class="${t === this._sel ? 'on' : ''}">${{ heute: 'Heute', gestern: 'Gestern', monat: 'Monat' }[t]}</span>`).join('')}</div>${inhalt}</ha-card>`;
      if (offen) this.shadowRoot.querySelectorAll('details').forEach((d) => { d.open = true; });
      this.shadowRoot.querySelectorAll('.wk-tabs span').forEach((el) => el.addEventListener('click', () => { this._sel = el.dataset.t; this._zeichne(); }));
      this.dataset.pruef = pf.length ? pf.join('; ') : 'ok';
    }
  }
  VgsWaermeKosten.html = waermeKostenHtml; VgsWaermeKosten.STIL = STIL;
  if (!customElements.get('vgs-waermekosten-card')) customElements.define('vgs-waermekosten-card', VgsWaermeKosten);
  window.customCards = window.customCards || []; window.customCards.push({ type: 'vgs-waermekosten-card', name: 'VGS Wärmekosten (WP gegen Gas/Öl)' });
})();

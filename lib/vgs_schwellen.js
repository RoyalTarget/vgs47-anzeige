// „Wer schaltet wann?“ – Schwellen-Leisten (04.10.2026, Nutzerwunsch: Temperaturen + Ein/Aus-Logik von BWWP, Heizstab, WW-Ladung, Heizkreis, WP auf einen Blick)
// Je Zeile: Fühler-Istwert als Punkt auf einer Skala, Ein-Schwelle (darunter = Bereich „an“) und Aus-Schwelle (darüber = aus), dazwischen hält der Zustand.
// Schwellen live: gelernte Werte aus sensor.naechster_start (geraete.*), Nennwerte aus den Helfern in ww_ladung.yaml / naechster_start.yaml.
// Tendenz-Pfeile (05.10.2026, Nutzerwunsch): Steigung der letzten 30 min je Fühler (History, alle 5 min), Pfeil am Punkt,
//   orange = bewegt sich auf die nächste Schaltschwelle zu (läuft → Aus, aus → Ein), grau = davon weg; Doppelpfeil ab 1 K/h, unter 0,15 K/h kein Pfeil.
// 06.10.2026 (Nutzerwunsch): „Als Nächstes“ integriert – Kopfzeile je Einheit = Zustand + nächstes Ereignis mit Uhrzeit (sensor.naechster_start),
//   darunter die Spur; alle Erklärtexte nur noch per ⓘ / Antippen. Entfeuchter als eigene Spur (Feuchte, umgekehrt: an oberhalb).
// Karte: type: custom:vgs-schwellen-card · Optionen: titel (Text oder false; Standard „Als Nächstes“)
// Auch auf der Anzeigeseite (06.10.2026, Kopie anzeige/lib/vgs_schwellen.js): app.js baut ein hass-Ersatzobjekt aus data.json + verlauf.json „ns“;
//   dort ohne Tendenz-Pfeile (kein callWS → _ladeTrend scheitert still).
(() => {
  if (customElements.get('vgs-schwellen-card')) return;
  const z = (v, n = 1) => (v == null || isNaN(v) ? '–' : Number(v).toFixed(n).replace('.', ','));
  const num = (h, e) => { const s = h.states[e]; const v = s ? parseFloat(s.state) : NaN; return isNaN(v) ? null : v; };
  const on = (h, e) => h.states[e] && h.states[e].state === 'on';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);

  const E_T2 = 'sensor.cmi_bwwp_mitte', E_T11 = 'sensor.cmi_t_speicher_mitte', E_FE = 'sensor.keller_ht_feuchte';
  const TREND_E = ['sensor.cmi_t_aussen', 'sensor.cmi_t_puffer_oben', 'sensor.cmi_t_puffer_mitte', E_T2, E_T11, E_FE];
  const TREND_MIN = 0.15;   // K/h bzw. %/h – darunter gilt der Wert als ruhig
  // Steigung je h: Treppenverlauf der letzten 30 min im 1-min-Raster, lineare Regression
  function steigung(hist, jetzt) {
    if (!hist || !hist.length) return null;
    const t0 = jetzt - 30 * 60e3, pts = [];
    let k = 0, v = parseFloat(hist[0].s);
    for (let t = t0; t <= jetzt; t += 60e3) {
      while (k < hist.length && (hist[k].lu ?? hist[k].lc) * 1000 <= t) { const w = parseFloat(hist[k].s); if (!isNaN(w)) v = w; k++; }
      if (!isNaN(v)) pts.push([(t - t0) / 3600e3, v]);
    }
    if (pts.length < 10) return null;
    const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
    const sxx = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0), sxy = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0);
    return sxx ? sxy / sxx : null;
  }
  // relevante Schwelle: läuft → Aus, aus → Ein; normal: steigend = auf Aus zu; umgekehrt (inv, Entfeuchter): fallend = auf Aus zu
  const aufZu = (r, tr) => (r.inv ? -tr : tr) > 0 === !!r.an;
  const ein = (r) => r.u === '%' ? ' %' : ' K';
  const proH = (r) => r.u === '%' ? ' %/h' : ' K/h';

  // Uhrzeit wie bisher in „Als Nächstes“: ≈ [morgen/Wochentag] HH:MM (in N min) – sonst „nicht absehbar“
  function zeit(iso) {
    const t = iso ? new Date(iso) : null;
    if (!t || isNaN(t)) return 'nicht absehbar';
    const jetzt = new Date(), m = Math.round((t - jetzt) / 60e3), mo = new Date(jetzt.getTime() + 864e5);
    const tag = t.toDateString() === jetzt.toDateString() ? '' : t.toDateString() === mo.toDateString() ? 'morgen ' : ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][t.getDay()] + ' ';
    const hm = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
    return `≈ ${tag}${hm}${m < 1 ? ' (gleich)' : m < 120 ? ` (in ${m} min)` : ''}`;
  }
  const bald = (iso) => !!iso && !isNaN(new Date(iso)) && new Date(iso) - Date.now() < 30 * 60e3;
  // nx = {an, was ('an'/'aus'/Text), iso, bald, zusatz, info}
  const nxAn = (an, iso, info, zusatz) => ({an, was: an ? 'aus' : 'an', iso, bald: !an && bald(iso), zusatz, info});

  function zeilen(h) {
    const g = (h.states['sensor.naechster_start'] || {attributes: {}}).attributes.geraete || {};
    const bw = g.bwwp || {}, wp = g.wp || {}, hk = g.hk || {}, en = g.entf || {};
    const t2 = num(h, 'sensor.cmi_bwwp_mitte'), t11 = num(h, 'sensor.cmi_t_speicher_mitte');
    const po = num(h, 'sensor.cmi_t_puffer_oben'), pm = num(h, 'sensor.cmi_t_puffer_mitte');
    const sollWp = num(h, 'input_number.bwwp_soll_wp') ?? 55, sollPv = num(h, 'input_number.bwwp_soll_wp_pv') ?? 57;
    const et = num(h, 'input_number.bwwp_soll_et') ?? 38;
    const ws = num(h, 'input_number.uvr_ww_soll') ?? 35;
    const wEin = ws + (num(h, 'input_number.uvr_ww_diff_ein') ?? -1), wAus = ws + (num(h, 'input_number.uvr_ww_diff_aus') ?? 10);
    const fT2 = ((h.states['input_select.uvr_ww_fuehler'] || {}).state || '').startsWith('T2');
    const ventil = (h.states['sensor.wolf_3_way_diverter_valve_htg_dhw'] || {}).state;
    const hzOn = on(h, 'binary_sensor.cmi_bwwp_heizstab') || on(h, 'binary_sensor.bwwp_heizstab');
    const f9 = num(h, 'sensor.cmi_wp_heizen_soll'), f7 = num(h, 'sensor.cmi_hk_vorlauf_soll');
    const dEin = num(h, 'input_number.uvr_wp_diff_ein') ?? 1, dAus = num(h, 'input_number.uvr_wp_diff_aus') ?? 5;
    const wpBasis = f9 > 10 ? f9 : (f7 > 10 ? f7 : null);

    // ---------- Als Nächstes (Texte aus der früheren Markdown-Karte, 29.09./03.10.2026) ----------
    const pg = ' · Zeit aus der Wetterprognose, Abweichung zum Fühler ' + z(hk.versatz) + ' K eingerechnet';
    const nxHk = hk.an
      ? nxAn(true, hk.eta, `aus, wenn außen ≥ ${z(hk.stop)} °C (gelernt; UVR: 10-min-Mittel > 20 °C) · jetzt ${z(hk.wert)} °C${hk.eta2 ? ` · danach wieder an ${zeit(hk.eta2)} (≤ ${z(hk.start)} °C)` : ''}${pg}`)
      : nxAn(false, hk.eta, `an, wenn außen ≤ ${z(hk.start)} °C (gelernt) · jetzt ${z(hk.wert)} °C${hk.eta2 ? ` · danach wieder aus ${zeit(hk.eta2)} (≥ ${z(hk.stop)} °C)` : ''}${pg}`);
    const sollTxt = (d) => wp.soll != null ? `Soll ${z(wp.soll)} + ${z(d - wp.soll)} K` : 'gelernt';
    let nxWp;
    if (wp.an) nxWp = nxAn(true, wp.eta, `aus, wenn Puffer mitte > ${z(wp.stop)} °C (${sollTxt(wp.stop)}) oder der Heizkreis ausgeht · jetzt ${z(wp.wert)} °C · steigt ${z(wp.rate)} K/h${wp.grund === 'heizkreis' ? ` · ${z(wp.stop)} °C werden bis dahin voraussichtlich nicht erreicht` : ''}`, wp.grund === 'heizkreis' ? 'mit dem Heizkreis' : '');
    else if (wp.wartet_hk) nxWp = {an: false, was: `an frühestens mit dem Heizkreis`, iso: hk.eta, info: `an, wenn der Heizkreis läuft und Puffer oben < ${z(wp.start)} °C (${sollTxt(wp.start)}) · jetzt ${z(wp.wert)} °C`};
    else if (wp.vor_hk_aus_nicht) nxWp = {an: false, was: 'kein Start, bevor der Heizkreis ausgeht', iso: hk.eta, info: `an, wenn Puffer oben < ${z(wp.start)} °C (${sollTxt(wp.start)}) · jetzt ${z(wp.wert)} °C · ${wp.rate < 0 ? `fällt ${z(-wp.rate)} K/h${wp.eta_puffer ? ' → rechnerisch ' + zeit(wp.eta_puffer) : ''}` : 'fällt gerade nicht'}${hk.eta2 ? ` · Heizkreis wieder an ${zeit(hk.eta2)}` : ''}`};
    else nxWp = nxAn(false, wp.eta, `an, wenn Puffer oben < ${z(wp.start)} °C (${sollTxt(wp.start)}) · jetzt ${z(wp.wert)} °C · ${wp.rate < 0 ? `fällt ${z(-wp.rate)} K/h` : 'fällt gerade nicht'}`);
    const bwF = bw.fuehler === 'T2' ? 'Speicher (BWWP-Fühler T2)' : 'Speicher mitte';
    let nxBw;
    if (bw.an) nxBw = nxAn(true, bw.eta, `aus, wenn ${bwF} ≈ ${z(bw.stop)} °C (mit PV ${z(bw.stop_pv)} °C) · jetzt ${z(bw.wert)} °C · ${bw.rate != null && bw.rate >= 0 ? 'steigt ' + z(bw.rate) : 'fällt ' + z(-(bw.rate || 0))} K/h${hzOn ? ' · ⚡ Heizstab an' : ''}`);
    else { const ue = bw.ueblich && (!bw.eta || new Date(bw.ueblich) < new Date(bw.eta)), fr = ue ? bw.ueblich : bw.eta;
      nxBw = nxAn(false, fr, `an, wenn ${bwF} < ${z(bw.start)} °C (Soll ${z(sollWp, 0)} − 3 K) · jetzt ${z(bw.wert)} °C · ${bw.rate != null && bw.rate < 0 ? 'fällt ' + z(-bw.rate) + ' K/h' : 'fällt gerade nicht'} · nur durch Abkühlen ${zeit(bw.eta)} · übliche Startzeit = Median der letzten Starts (Duschen ziehen vor)`, ue && bw.ueblich !== bw.eta ? 'übliche Startzeit' : ''); }
    const pvab = num(h, 'input_number.entfeuchter_pv_ein_ab') ?? 52, sonne = (num(h, 'sensor.pv_gesamt') ?? 0) >= 300;
    let nxEn;
    if (!en.automatik) nxEn = {an: !!en.an, was: 'Automatik aus', iso: null, keineZeit: true, info: 'Automatik aus (input_boolean.entfeuchter_automatik)'};
    else if (en.an) nxEn = nxAn(true, en.eta, `aus, wenn Keller < ${z(en.stop, 0)} % · jetzt ${z(en.wert, 0)} % · ${z(en.rate)} %/h${on(h, 'input_boolean.entfeuchter_pv_lauf') ? ' · PV-Lauf' : ''}`);
    else { const pv = sonne && en.wert != null && en.wert >= pvab;
      nxEn = nxAn(false, pv ? null : en.eta, `an, wenn Keller > ${z(en.start, 0)} %${sonne ? ` oder mit PV-Überschuss ab ${z(pvab, 0)} %` : ` (keine Sonne – PV-Lauf erst wieder tagsüber ab ${z(pvab, 0)} %)`} · jetzt ${z(en.wert, 0)} % · ${en.rate > 0 ? 'steigt ' + z(en.rate) + ' %/h' : 'steigt gerade nicht'}${sonne ? ` · PV-Freigabe: ${en.pv_freigabe ? 'ja' : 'Einspeisung ' + z(en.einspeisung, 0) + ' von 500 W'}` : ''}`);
      if (pv) { nxEn.was = 'an jetzt mit PV-Überschuss möglich'; nxEn.keineZeit = true; nxEn.bald = true; } }

    return [
      {
        titel: '♨️ Fußbodenheizung', fuehler: 'Außentemperatur', tech: 'UVR Funktion 7 · Heizkreis-Pumpe PMG', an: hk.an, ein: hk.start, aus: hk.stop, nx: nxHk,
        punkte: [{n: 'außen', v: hk.wert ?? num(h, 'sensor.cmi_t_aussen'), haupt: true, e: 'sensor.cmi_t_aussen'}],
        info: `Heizung an, wenn es außen ≤ ${z(hk.start)} °C hat, aus ab ${z(hk.stop)} °C (gelernt; UVR: Heizgrenze Mittelwert > 20 °C, 10-min-Mittel). Vorlauf-Soll ${f7 > 10 ? z(f7) + ' °C' : '– (aus)'}.`,
        grafik: heizkurve(hk.wert ?? num(h, 'sensor.cmi_t_aussen'), f7),
        kurveTxt: 'Heizkurve: je Grad kälter ≈ +0,57 K Vorlauf (+10 °C → 28, −20 °C → 45, max. 48). Die Kurve gibt nur den Heizkreis vor; die WP lädt den Puffer, wenn Puffer oben unter dieses Soll + 1 K fällt.',
      },
      {
        titel: '🔥 Wärmepumpe', fuehler: wp.an ? 'Puffer Mitte' : 'Puffer oben', tech: 'UVR Funktion 9 · Start nach Puffer oben, Stopp nach Puffer mitte', an: on(h, 'binary_sensor.wp_lauft'), nx: nxWp,
        ein: wp.start, aus: wp.stop, gesperrt: !hk.an && !wp.an ? 'wartet, bis die Fußbodenheizung läuft' : null,
        punkte: [{n: 'oben', v: po, haupt: !wp.an, e: 'sensor.cmi_t_puffer_oben'}, {n: 'mitte', v: pm, haupt: !!wp.an, e: 'sensor.cmi_t_puffer_mitte'}],
        info: `Lädt den Heizungspuffer. Start, wenn Puffer oben < Soll + ${z(dEin)} K, Stopp, wenn Puffer Mitte > Soll + ${z(dAus)} K – nur solange die Fußbodenheizung läuft. Soll = ${wpBasis ? z(wpBasis) + ' °C' : 'Heizkurve (jetzt aus)'}${wp.quelle === 'gelernt' ? '; ohne Soll gelernte Schwellen' : ''}.`,
      },
      {
        titel: 'BWWP', kurz: 'BWWP-Verdichter', gruppe: 'bwwp', fuehler: 'Speicher', tech: 'Wolf FHS-HE, schaltet selbst nach ihrem Fühler T2 · grauer Punkt = UVR-Fühler T11', an: on(h, 'binary_sensor.bwwp_lauft') && !(hzOn && (num(h, 'sensor.bwwp_verdichter_leistung') ?? 1) < 80),
        ein: bw.start, aus: bw.stop, aus2: bw.stop_pv, aus2n: 'PV', nx: nxBw,
        punkte: [{n: 'Speicher', v: t2, haupt: true, e: E_T2}, {n: '2. Fühler', v: t11, e: E_T11}],
        info: `Schaltet nach ihrem eigenen Speicherfühler: Soll ${z(sollWp, 0)} → an < ${z(bw.start)}, aus > ${z(bw.stop)} °C; mit PV-Freigabe Soll ${z(sollPv, 0)} → aus > ${z(bw.stop_pv)} °C (gelernt, gestrichelt). Grauer Punkt = zweiter Fühler der UVR im selben Speicher, nur zum Vergleich.`,
      },
      {
        titel: 'WP lädt BWWP nach', kurz: 'WP lädt nach', gruppe: fT2 ? 'bwwp' : null, fuehler: fT2 ? 'Speicher' : '2. Fühler', tech: `UVR Funktion 11 · Ausgang A5 · Fühler ${fT2 ? 'T2 (BWWP)' : 'T11 (UVR)'}`, an: on(h, 'binary_sensor.cmi_anforderung_wp_ww_ladung'),
        ein: wEin, aus: wAus, extra: ventil && ventil !== 'Heizen' && ventil !== 'unavailable' ? `Wolf-Ventil: ${ventil}` : null,
        punkte: fT2 ? [{n: 'Speicher', v: t2, haupt: true, e: E_T2}] : [{n: '2. Fühler', v: t11, haupt: true, e: E_T11}, {n: 'Speicher', v: t2, e: E_T2}],
        info: `Die WP lädt den BWWP-Speicher über den Wärmetauscher nach: an bei Speicher < ${z(wEin)} °C, aus > ${z(wAus)} °C (Soll ${z(ws)}). Seit 05.10.2026 kommt die WP vor dem Heizstab (< ${z(et - 1)} °C): sie ist schneller (~8 kW) und effizienter; der Heizstab ist nur noch Reserve, wenn der Speicher trotzdem weiter abfällt.`,
      },
      {
        titel: 'Heizstab BWWP', kurz: 'Heizstab', gruppe: 'bwwp', fuehler: 'Speicher', tech: 'Heizstab der BWWP, Fühler T2', an: hzOn, ein: et - 1, aus: et + 1,
        punkte: [{n: 'Speicher', v: t2, haupt: true, e: E_T2}],
        info: `Heizstab der BWWP (~1,9 kW) erst bei T2 < ${z(et - 1)} °C, aus > ${z(et + 1)} °C (T min ${z(et, 0)} °C). Passiert nur nach viel Zapfung.`,
      },
      {
        titel: '💧 Entfeuchter', fuehler: 'Keller-Feuchte', u: '%', dez: 0, inv: true, tech: 'packages/entfeuchter.yaml · Keller H&T', an: on(h, 'binary_sensor.entfeuchter_lauft'), nx: nxEn,
        ein: en.start, aus: en.stop, aus2: pvab, aus2n: 'PV ab', gesperrt: en.automatik === false ? 'Automatik aus' : null,
        punkte: [{n: 'Keller', v: en.wert ?? num(h, E_FE), haupt: true, e: E_FE}],
        info: `An über ${z(en.start, 0)} % immer, zwischen ${z(pvab, 0)} und ${z(en.start, 0)} % nur mit PV-Überschuss (gestrichelt), aus unter ${z(en.stop, 0)} %.`,
      },
    ];
  }

  const werte = (r) => [r.ein, r.aus, r.aus2, ...r.punkte.map((p) => p.v)].filter((v) => v != null && !isNaN(v));
  function bereich(vals) {
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = Math.max(2, (hi - lo) * 0.15); return [Math.floor(lo - pad), Math.ceil(hi + pad)];
  }

  // g (Gruppe, 05.10.2026): {lo, hi, erste, letzte} – gemeinsame Skala, Punkt-Beschriftung nur in der ersten Spur, Skala nur unter der letzten
  function leiste(r, g, trends) {
    const vals = werte(r);
    if (!vals.length) return '<div class="leer">keine Werte</div>';
    const [lo, hi] = g ? [g.lo, g.hi] : bereich(vals);
    const x = (v) => ((v - lo) / (hi - lo)) * 100, d = r.dez ?? 1;
    let s = `<div class="spur${g && !g.erste ? ' folge' : ''}">`;
    // Zonen: normal an links der Ein-Schwelle; umgekehrt (inv) rechts davon, Halte-Bereich jeweils zwischen Ein und Aus
    if (r.ein != null) s += r.inv ? `<div class="zone an inv" style="left:${x(r.ein)}%;right:0"></div>` : `<div class="zone an" style="left:0;width:${x(r.ein)}%"></div>`;
    if (r.ein != null && r.aus != null) { const a = Math.min(r.ein, r.aus), b = Math.max(r.ein, r.aus); s += `<div class="zone halt" style="left:${x(a)}%;width:${x(b) - x(a)}%"></div>`; }
    const mark = (v, txt, cls, rand) => v == null ? '' : `<div class="mark ${cls}" style="left:${x(v)}%">${txt == null ? '' : `<span style="transform:translateX(${rand === 'l' ? '-100%' : rand === 'r' ? '0' : '-50%'})">${txt} ${z(v, d)}</span>`}</div>`;
    // Beschriftungen nach Lage sortiert; eng beieinander (< 22 % der Breite): linke nach links, rechte nach rechts schieben
    const ms = [{v: r.ein, txt: r.inv ? 'an >' : 'an <', cls: 'm-ein'}, {v: r.aus, txt: r.inv ? 'aus <' : 'aus >', cls: 'm-aus'}];
    if (r.aus2 != null) ms.push({v: r.aus2, txt: g ? null : r.aus2n, cls: 'm-aus2'});   // Gruppe: PV-Schwelle nur gestrichelt, Wert im ⓘ-Text
    const sm = ms.filter((m) => m.v != null && m.txt != null).sort((a, c) => a.v - c.v);
    for (let i = 1; i < sm.length; i++) if (Math.abs(x(sm[i].v) - x(sm[i - 1].v)) < 22) { if (!sm[i - 1].rand) sm[i - 1].rand = 'l'; sm[i].rand = 'r'; }
    for (const m of ms) s += mark(m.v, m.txt, m.cls, m.rand);
    // zwei Punkte eng beieinander (< 25 % der Breite, 05.10.2026): linke Beschriftung endet am Punkt, rechte beginnt dort
    const pk = r.punkte.filter((p) => p.v != null), engP = pk.length > 1 && Math.abs(x(pk[0].v) - x(pk[1].v)) < 25;
    const links = engP ? [...pk].sort((a, c) => a.v - c.v)[0] : null;
    for (const p of pk) { const tr = !engP ? '-50%' : p === links ? 'calc(-100% + 2px)' : '-2px';
      const txt = g && !g.erste ? '' : `<span style="transform:translateX(${tr})">${esc(p.n)} ${z(p.v, d)}</span>`;
      const tg = trends && p.e ? trends[p.e] : null;
      let pf = '';
      // Pfeil nur am entscheidenden Punkt, immer seitlich (06.10.2026: unter dem Punkt war er nicht zu erkennen);
      // gezeichnetes Dreieck statt ▸ (Glyphe saß unter der Mitte), dunkler Rand → liegt sichtbar über einem Nachbarpunkt
      if (p.haupt && tg != null && Math.abs(tg) >= TREND_MIN) {
        const zu = aufZu(r, tg), dbl = Math.abs(tg) >= 1, w = dbl ? 16 : 9;
        const dd = tg > 0 ? 'M1.5 1.5 L7.5 6 L1.5 10.5Z' + (dbl ? ' M8.5 1.5 L14.5 6 L8.5 10.5Z' : '') : 'M7.5 1.5 L1.5 6 L7.5 10.5Z' + (dbl ? ' M14.5 1.5 L8.5 6 L14.5 10.5Z' : '');
        pf = `<svg class="pf ${tg > 0 ? 'r' : 'l'} ${zu ? 'zu' : ''}" width="${w}" height="12" viewBox="0 0 ${w} 12"><path d="${dd}"/></svg>`;
      }
      const tt = `${esc(p.n)} ${z(p.v, d)} ${r.u || '°C'}${tg != null ? ` · ${tg >= 0 ? '+' : '−'}${z(Math.abs(tg))}${proH(r)} (30 min)` : ''}`;
      s += `<div class="pkt ${p.haupt ? 'haupt' : ''}" style="left:${x(p.v)}%" title="${tt}">${txt}${pf}</div>`; }
    s += '</div>' + (g && !g.letzte ? '<div class="abst"></div>' : `<div class="skala"><span>${lo}</span><span>${hi} ${r.u || '°C'}</span></div>`);
    return s;
  }

  // Abstand zur Schaltschwelle + Tendenz (früher eigene Zeile „→ …“, seit 06.10.2026 im ⓘ-Text)
  function naechstes(r, trends) {
    const h = r.punkte.find((p) => p.haupt) || r.punkte[0];
    const v = h && h.v, d = r.dez ?? 1, u = r.u || '°C';
    if (v == null || r.ein == null || r.aus == null) return '';
    const tr = trends && h.e ? trends[h.e] : null;
    let t = '';
    if (tr != null && Math.abs(tr) >= TREND_MIN) {
      t = ` · ${tr > 0 ? 'steigt' : 'fällt'} ${z(Math.abs(tr))}${proH(r)}`;
      const rest = (r.an ? r.aus - v : v - r.ein) * (r.inv ? -1 : 1);
      if (!r.gesperrt && aufZu(r, tr) && rest > 0) { const std = rest / Math.abs(tr);
        if (std <= 24) t += ` · ≈ ${std < 1 ? Math.max(1, Math.round(std * 60)) + ' min' : z(std) + ' h'}`; }
    }
    if (r.gesperrt) return r.gesperrt + t;
    const gr = r.inv ? ['<', '>'] : ['>', '<'];
    if (r.an) return `aus bei ${r.fuehler} ${gr[0]} ${z(r.aus, d)} ${u} · noch ${z(Math.abs(r.aus - v), d)}${ein(r)}` + t;
    if (r.inv ? v > r.ein : v < r.ein) return `jenseits der Einschalt-Schwelle – startet gleich` + t;
    return `an erst bei ${r.fuehler} ${gr[1]} ${z(r.ein, d)} ${u} · noch ${z(Math.abs(v - r.ein), d)}${ein(r)}` + t;
  }

  // Kopfzeile „Als Nächstes“: Titel [AN] → aus ≈ 14:00 (Zusatz) ⓘ
  function kopfNx(titel, nx, ib) {
    if (!nx) return `<span class="kl"><span class="t">${esc(titel)}</span></span>${ib}`;
    const st = nx.an ? '<span class="zs an">AN</span>' : '<span class="zs">AUS</span>';
    const wann = nx.keineZeit ? '' : ` <b class="${nx.bald ? 'bald' : ''}">${esc(zeit(nx.iso))}</b>`;
    const was = nx.keineZeit && nx.bald ? `<b class="bald">${esc(nx.was)}</b>` : esc(nx.was);
    return `<span class="kl"><span class="t">${esc(titel)}</span> <span class="nx">${st} → ${was}${wann}${nx.zusatz ? ` <span class="f">(${esc(nx.zusatz)})</span>` : ''}</span></span>${ib}`;
  }
  const infoBlock = (offen, teile, tech, html) => `<div class="i" ${offen ? '' : 'hidden'}>${teile.filter(Boolean).map(esc).join('<br>')}${tech ? `<br><span class="tech">${esc(tech)}</span>` : ''}${html || ''}</div>`;

  // Heizkurve F7 (06.10.2026, Nutzerwunsch): Parameter von den CMI-Fotos 02.10.2026 (Jochen) – NICHT live, bei Änderung hier nachziehen.
  // Gerade durch (+10 °C → 28) und (−20 °C → 45), darüber Min 28, Heizgrenze 10-min-Mittel > 20 °C aus (an < 19). Raumeinfluss 15 % verschiebt leicht.
  // Kandidat (Wochenauswertung): +10-Punkt 27, Heizgrenze 17 – nur gestrichelt zum Vergleich.
  const HK = {p1: [10, 28], p2: [-20, 45], max: 48, grenze: 20, kand: {p1: [10, 27], grenze: 17}};
  const hkSoll = (a, p1 = HK.p1, grenze = HK.grenze) => a > grenze ? null : a >= p1[0] ? p1[1] : a <= HK.p2[0] ? HK.p2[1]
    : Math.min(HK.max, p1[1] + (p1[0] - a) * (HK.p2[1] - p1[1]) / (p1[0] - HK.p2[0]));
  function heizkurve(au, f7) {
    const W = 320, H = 150, L = 30, R = 8, T = 10, B = 24, x0 = -20, x1 = 25, y0 = 20, y1 = 50;
    const X = (a) => L + (a - x0) / (x1 - x0) * (W - L - R), Y = (v) => T + (y1 - v) / (y1 - y0) * (H - T - B);
    const pfad = (p1, gr) => { const pts = []; for (let a = x0; a <= gr + 1e-9; a += 0.5) pts.push(`${X(a).toFixed(1)},${Y(hkSoll(a, p1, gr)).toFixed(1)}`); return pts.join(' '); };
    let g = '';
    for (const v of [25, 30, 35, 40, 45]) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="rgba(127,127,127,.18)"/><text x="${L - 4}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`;
    for (const a of [-20, -10, 0, 10, 20]) g += `<line x1="${X(a)}" x2="${X(a)}" y1="${T}" y2="${H - B}" stroke="rgba(127,127,127,.18)"/><text x="${X(a)}" y="${H - B + 12}" text-anchor="middle">${a}</text>`;
    g += `<rect x="${X(HK.grenze)}" y="${T}" width="${X(x1) - X(HK.grenze)}" height="${H - T - B}" fill="rgba(127,127,127,.12)"/><text x="${(X(HK.grenze) + X(x1)) / 2}" y="${T + 12}" text-anchor="middle">aus</text>`;
    g += `<polyline points="${pfad(HK.kand.p1, HK.kand.grenze)}" fill="none" stroke="#9ca3af" stroke-width="1.3" stroke-dasharray="4 3"/>`;
    g += `<polyline points="${pfad(HK.p1, HK.grenze)}" fill="none" stroke="#ff9800" stroke-width="2.2"/>`;
    if (au != null) {
      const an = f7 != null && f7 > 10, v = an ? f7 : y0;
      g += `<circle cx="${X(Math.max(x0, Math.min(x1, au)))}" cy="${Y(Math.max(y0, Math.min(y1, v)))}" r="4.5" fill="#e53935" stroke="#fff" stroke-width="1"/>`;
      const links = X(au) > W * 0.55;   // Punkt rechts → Beschriftung links unterhalb (rechts abgeschnitten, oberhalb liegt die Kurve)
      g += `<text x="${X(Math.max(x0, Math.min(x1, au))) + (links ? -8 : 8)}" y="${Y(Math.max(y0, Math.min(y1, v))) + (links ? 16 : -8)}" text-anchor="${links ? 'end' : 'start'}" fill="#e53935" style="font-weight:600">${an ? z(f7) + ' °C' : 'aus'} bei ${z(au)} °C</text>`;
    }
    g += `<text x="${W - R}" y="${H - 2}" text-anchor="end">außen °C</text><text x="4" y="${T - 1}">VL °C</text>`;
    return `<div class="hkurve"><svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:520px;display:block;margin-top:6px;font:9px sans-serif;fill:#9ca3af">${g}</svg>`
      + `<div class="tech"><b style="color:#ff9800">━</b> Heizkurve (Vorlauf-Soll der UVR) · <b style="color:#e53935">●</b> jetzt (echtes Soll) · <b>╌</b> Kandidat: +10-Punkt 27 °C, Heizgrenze 17 °C</div></div>`;
  }

  class VgsSchwellen extends HTMLElement {
    setConfig(c) { this._c = c || {}; }
    getCardSize() { return 8; }
    getGridOptions() { return {columns: 'full', min_rows: 6}; }
    set hass(h) {
      this._hass = h;
      const rs = zeilen(h);
      if (!this._trendT || Date.now() - this._trendT > 5 * 60e3) this._ladeTrend();
      const key = JSON.stringify(rs) + JSON.stringify(this._trend || {}) + Math.floor(Date.now() / 60e3);
      if (key === this._key) return; this._key = key;
      if (!this._root) {
        this._root = this.attachShadow({mode: 'open'}); this._offen = new Set();
        // Zeile antippen → Erklärung + Fachbegriffe ein/aus
        this._root.addEventListener('click', (ev) => {
          const z = ev.composedPath().find((x) => x.dataset && x.dataset.z != null); if (!z) return;
          const i = z.dataset.z; this._offen.has(i) ? this._offen.delete(i) : this._offen.add(i);
          this._key = null; this.hass = this._hass;
        });
      }
      const titel = this._c.titel === false ? '' : (this._c.titel || 'Als Nächstes');
      this._root.innerHTML = `<style>
        ha-card{display:block;padding:12px 16px 8px}   /* display:block für die Anzeigeseite (dort ist ha-card ein unbekanntes Element) */
        [hidden]{display:none!important}
        .kl{flex:1;min-width:0}
        .kt{display:flex;justify-content:space-between;align-items:center;gap:8px;cursor:pointer}
        h2{margin:0;font-size:20px;font-weight:400;color:var(--primary-text-color)}
        .z{padding:10px 0 6px;border-top:1px solid var(--divider-color)}
        .z:first-of-type{border-top:0}
        .kopf{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}
        .t{font-weight:500;color:var(--primary-text-color)}
        .nx{color:var(--primary-text-color);font-size:14px}
        .nx b{font-weight:600}.nx b.bald,.bald{color:#facc15}
        .zs{display:inline-block;font-size:12px;font-weight:600;letter-spacing:.3px;padding:1px 9px;border-radius:10px;background:rgba(127,127,127,.22);color:#9ca3af;vertical-align:1px}.zs.an{background:rgba(34,197,94,.25);color:#86efac}   /* Pille AN/AUS überall gleich (Nutzer 06.10.2026) */
        .f{color:var(--secondary-text-color);font-size:12px;font-weight:400}
        .st{font-size:12px;padding:1px 8px;border-radius:10px;background:var(--divider-color);color:var(--secondary-text-color);white-space:nowrap}
        .st.an{background:rgba(34,197,94,.22);color:#22c55e}   /* läuft = grün (Nutzer 05.10.2026) */
        .st.wart{background:rgba(120,120,120,.15)}
        .spur{position:relative;height:10px;margin:30px 4px 0;border-radius:5px;background:rgba(127,127,127,.12)}
        .zone{position:absolute;top:0;bottom:0}
        .zone.an{background:rgba(255,140,0,.32);border-radius:5px 0 0 5px}.zone.an.inv{border-radius:0 5px 5px 0}
        .zone.halt{background:repeating-linear-gradient(135deg,rgba(127,127,127,.22) 0 4px,transparent 4px 8px)}
        .mark{position:absolute;top:-6px;bottom:-6px;width:0;border-left:2px solid var(--secondary-text-color)}
        .mark span{position:absolute;top:22px;left:0;padding:0 3px;font-size:11px;white-space:nowrap;color:var(--secondary-text-color)}
        .mark.m-ein{border-color:#ff9800}.mark.m-ein span{color:#ff9800}
        .mark.m-aus2{border-left-style:dashed}
        .pkt{position:absolute;top:50%;box-sizing:border-box;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:var(--secondary-text-color);border:2px solid var(--card-background-color,#1c1c1c)}
        .pkt{z-index:2}.pkt.haupt{z-index:3;width:16px;height:16px;margin:-8px 0 0 -8px;background:#e53935}
        .pkt span{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);font-size:11px;white-space:nowrap;color:var(--secondary-text-color)}
        .pkt.haupt span{font-size:12px;font-weight:600;color:var(--primary-text-color)}
        .spur.folge{margin-top:12px}
        .pf{position:absolute;top:50%;margin-top:-6px;display:block;overflow:visible;color:var(--secondary-text-color);pointer-events:none}
        .pf path{fill:currentColor;stroke:var(--card-background-color,#1c1c1c);stroke-width:2.5px;stroke-linejoin:round;paint-order:stroke}
        .pf.r{left:calc(100% + 2px)}.pf.l{right:calc(100% + 2px)}
        .pf.zu{color:#ff9800}
        .lane{cursor:pointer;padding:6px 0 2px 10px;border-left:2px solid var(--divider-color);margin-top:6px}
        .t.lt{font-size:13px}
        .abst{height:22px}
        .lane .skala{margin-top:24px}
        .skala{display:flex;justify-content:space-between;font-size:10px;color:var(--secondary-text-color);margin:18px 4px 0;opacity:.7}
        .i{font-size:12px;color:var(--secondary-text-color);margin-top:4px;line-height:1.4}
        .ib{cursor:pointer;color:var(--secondary-text-color);font-size:13px;padding:0 4px}.z{cursor:pointer}.tech{opacity:.7;font-size:11px}
        .leg{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:var(--secondary-text-color);margin:4px 0}
        .leg i{display:inline-block;width:14px;height:8px;border-radius:2px;margin-right:4px;vertical-align:middle}
      </style><ha-card>
        <div class="kt" data-z="leg">${titel ? `<h2>${esc(titel)}</h2>` : '<span></span>'}<span class="ib">${this._offen.has('leg') ? 'Legende ▴' : 'ⓘ Legende'}</span></div>
        <div class="leg" ${this._offen.has('leg') ? '' : 'hidden'}><span><i style="background:rgba(255,140,0,.32)"></i>hier schaltet es ein</span><span><i style="background:repeating-linear-gradient(135deg,rgba(127,127,127,.35) 0 3px,transparent 3px 6px)"></i>dazwischen bleibt es, wie es ist</span><span><i style="background:#e53935;border-radius:50%;width:8px"></i>entscheidende Temperatur / Feuchte</span><span><b style="color:#ff9800">▸</b> Tendenz 30 min: orange = auf den Schaltpunkt zu, grau = davon weg (▸▸ ≥ 1 K/h)</span><span>Uhrzeit = Prognose aus sensor.naechster_start, gelb = in &lt; 30 min</span><span>ⓘ / Zeile antippen = Erklärung</span></div>
        ${this._bloecke(rs)}`;
    }

    async _ladeTrend() {
      this._trendT = Date.now();
      try {
        const jetzt = Date.now();
        const res = await this._hass.callWS({type: 'history/history_during_period', start_time: new Date(jetzt - 31 * 60e3).toISOString(),
          entity_ids: TREND_E, minimal_response: true, no_attributes: true});
        const tr = {};
        for (const e of TREND_E) { const m = steigung(res[e], jetzt); if (m != null) tr[e] = Math.round(m * 100) / 100; }
        this._trend = tr; this._key = null; this.hass = this._hass;
      } catch (e) { this._trendT = Date.now() - 4 * 60e3; }   // Fehler: in 1 min erneut
    }

    _zeile(r, i) {
      const k = String(i);
      return `<div class="z" data-z="${k}">
          <div class="kopf">${kopfNx(r.titel, r.nx, '<span class="ib">ⓘ</span>')}</div>
          ${leiste(r, null, this._trend)}
          ${infoBlock(this._offen.has(k), [r.nx && r.nx.info, '→ ' + naechstes(r, this._trend) + (r.extra ? ' · ' + r.extra : ''), r.info, r.kurveTxt, 'Kriterium: ' + r.fuehler], r.tech, this._offen.has(k) ? r.grafik : '')}</div>`;
    }

    // BWWP-Gruppe (Nutzer 05.10.2026): alle Stufen am selben Speicherfühler → ein Block, gemeinsame Skala, Temperatur nur einmal
    _bloecke(rs) {
      let out = '', i = 0;
      while (i < rs.length) {
        const gr = rs[i].gruppe;
        if (!gr) { out += this._zeile(rs[i], i); i++; continue; }
        const idx = []; while (i < rs.length && rs[i].gruppe === gr) idx.push(i++);
        const [lo, hi] = bereich(idx.flatMap((k) => werte(rs[k])));
        const r0 = rs[idx[0]], gk = 'g' + idx[0];
        out += `<div class="z grp"><div class="kopf" data-z="${gk}">${kopfNx('🚿 BWWP', r0.nx, '<span class="ib">ⓘ</span>')}</div>
          ${infoBlock(this._offen.has(gk), [r0.nx && r0.nx.info, 'Alle Stufen hängen am selben Speicherfühler – fällt er, springt zuerst die obere Stufe ein.'], '')}`;
        idx.forEach((k, j) => { const r = rs[k];
          out += `<div class="lane" data-z="${k}"><div class="kopf"><span class="t lt">${esc(r.kurz || r.titel)} <span class="ib">ⓘ</span></span>
            ${r.an ? '<span class="zs an">AN</span>' : '<span class="zs">AUS</span>'}</div>
            ${leiste(r, {lo, hi, erste: j === 0, letzte: j === idx.length - 1}, this._trend)}
            ${infoBlock(this._offen.has(String(k)), ['→ ' + naechstes(r, this._trend) + (r.aus2 != null ? ` · gestrichelt: mit PV aus > ${z(r.aus2)} °C` : '') + (r.extra ? ' · ' + r.extra : ''), r.info], r.tech)}</div>`; });
        out += '</div>';
      }
      return out + '</ha-card>';
    }
  }
  customElements.define('vgs-schwellen-card', VgsSchwellen);
  window.customCards = window.customCards || [];
  window.customCards.push({type: 'vgs-schwellen-card', name: 'VGS Als Nächstes / Wer schaltet wann?'});
})();

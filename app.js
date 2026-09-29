// Nur-Lese-Anzeige der HA-Übersicht. Daten: geheimer Gist, von HA jede Minute aktualisiert.
const DATEN = "https://gist.githubusercontent.com/RoyalTarget/f9832b91288808b13a203ac1635b6232/raw/data.json";
const TAKT_MS = 30000;

let slots = [], overlays = [];
const $ = (id) => document.getElementById(id);

// ---------- Formatierung ----------
const zahl = (v, dec) => Number(v).toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const zeitpunkt = (t) => new Date(String(t).replace(/(\.\d{3})\d+/, "$1")).getTime();   // Safari kennt keine Mikrosekunden
const num = (s, e) => { const v = parseFloat(s[e]); return Number.isFinite(v) ? v : null; };
function watt(v) {
  if (v === null) return "–";
  return Math.abs(v) >= 1000 ? zahl(v / 1000, 2) + " kW" : zahl(v, 0) + " W";
}

// ---------- Schema ----------
function baueSchema() {
  const w = $("werte");
  for (const s of slots) {
    const beschriftung = !s.entity && s.id.endsWith("_l");
    if (!s.entity && !beschriftung) continue;
    const el = document.createElement("div");
    if (beschriftung) el.textContent = s.prefix;
    el.className = "wert " + s.anchor + (s.id.startsWith("rl_") ? " rl" : "");
    el.style.left = s.left + "%";
    el.style.top = s.top + "%";
    el.style.color = s.color;
    el.id = "slot_" + s.id;
    w.appendChild(el);
  }
  const o = $("overlays");
  overlays.forEach((ov, i) => {
    const img = document.createElement("img");
    img.src = "img/" + ov.img;
    img.alt = "";
    img.hidden = true;
    img.id = "ov_" + i;
    o.appendChild(img);
  });
}

function bedingung(c, s) {
  if (c.length === 2) return s[c[0]] === c[1];
  const v = num(s, c[0]);
  if (v === null) return false;
  if (c[1] !== null && !(v > c[1])) return false;
  if (c[2] !== null && !(v < c[2])) return false;
  return true;
}

function zeigeSchema(s) {
  for (const sl of slots) {
    if (!sl.entity) continue;
    let v = num(s, sl.entity), unit = sl.unit, dec = sl.dec;
    // elektrische WP-Leistung kommt in W
    if (sl.entity === "sensor.cmi_wp_leistung_elektrisch") { unit = "W"; dec = 0; }
    const txt = v === null ? "—" : zahl(v, dec) + (unit ? " " + unit : "");
    $("slot_" + sl.id).textContent = (sl.prefix || "") + txt;
  }
  overlays.forEach((ov, i) => { $("ov_" + i).hidden = !ov.conds.every((c) => bedingung(c, s)); });
}

// ---------- Energiefluss ----------
const P = { pv: [200, 48], netz: [58, 150], haus: [342, 150], batt: [200, 252] };
const LINIEN = {
  pv_haus: "M200,82 C200,138 260,143 308,143",
  pv_netz: "M200,82 C200,138 140,143 92,143",
  pv_batt: "M200,82 L200,218",
  netz_haus: "M92,150 L308,150",
  batt_haus: "M200,218 C200,162 260,157 308,157",
  netz_batt: "M92,157 C140,157 200,162 200,218",
};
const FARBE = { pv: "#ff9800", netz: "#488fc2", export: "#a280db", batt: "#4db6ac", entladen: "#f06292", haus: "#5bc0de" };

function zeigeFluss(s) {
  const pv = Math.max(num(s, "sensor.pv_gesamt") ?? 0, 0);
  const netz = num(s, "sensor.em_540_netzmessgeraet_leistung") ?? 0;
  const batt = num(s, "sensor.venus_dc_batterie_leistung") ?? 0;
  const haus = num(s, "sensor.hausverbrauch") ?? 0;
  const soc = num(s, "sensor.venus_dc_batterie_ladestand");
  const bezug = Math.max(netz, 0), einsp = Math.max(-netz, 0);
  const laden = Math.max(batt, 0), entl = Math.max(-batt, 0);
  let rest = pv;
  const pvHaus = Math.min(rest, haus); rest -= pvHaus;
  const pvBatt = Math.min(rest, laden); rest -= pvBatt;
  const pvNetz = Math.min(rest, einsp);
  const netzBatt = Math.max(laden - pvBatt, 0);
  const netzHaus = Math.max(bezug - netzBatt, 0);
  const fluesse = [["pv_haus", pvHaus, FARBE.pv], ["pv_netz", pvNetz, FARBE.pv], ["pv_batt", pvBatt, FARBE.pv],
    ["netz_haus", netzHaus, FARBE.netz], ["batt_haus", entl, FARBE.entladen], ["netz_batt", netzBatt, FARBE.netz]];

  let svg = "";
  for (const [k, d] of Object.entries(LINIEN)) svg += `<path class="linie" d="${d}" stroke="#6b7280"/>`;
  for (const [k, w, f] of fluesse) {
    if (w < 10) continue;
    const dauer = Math.max(0.6, 4 - w / 1000).toFixed(2);
    svg += `<path class="punkt" d="${LINIEN[k]}" stroke="${f}" style="animation-duration:${dauer}s"/>`;
  }
  const knoten = (key, farbe, zeilen, name) => {
    const [x, y] = P[key];
    let t = `<g class="knoten"><circle cx="${x}" cy="${y}" r="34" stroke="${farbe}"/>`;
    zeilen.forEach((z, i) => { t += `<text x="${x}" y="${y + 4 + (i - (zeilen.length - 1) / 2) * 14}">${z}</text>`; });
    t += `<text class="klein" x="${x}" y="${key === "pv" ? y - 40 : y + 48}">${name}</text></g>`;
    return t;
  };
  svg += knoten("pv", FARBE.pv, [watt(pv)], "PV");
  svg += knoten("netz", einsp > bezug ? FARBE.export : FARBE.netz,
    [bezug >= einsp ? "→ " + watt(bezug) : "← " + watt(einsp)], bezug >= einsp ? "Netz (Bezug)" : "Netz (Einspeisung)");
  svg += knoten("haus", FARBE.haus, [watt(haus)], "Haus");
  svg += knoten("batt", entl > laden ? FARBE.entladen : FARBE.batt,
    [soc === null ? "–" : zahl(soc, 0) + " %", (entl > laden ? "↑ " + watt(entl) : "↓ " + watt(laden))], "Batterie");
  $("fluss").innerHTML = svg;

  const geraete = [["Wärmepumpe", "sensor.cmi_wp_leistung_elektrisch"], ["BWWP", "sensor.keller_bwwp_shelly_leistung"],
    ["Klima ≈", "sensor.klima_leistung_geschatzt"], ["Entfeuchter", "sensor.keller_entfeuchter_power"],
    ["Spülmaschine", "sensor.kuche_spulmaschine_shelly_leistung"], ["Waschmaschine", "sensor.keller_miele_waschmaschine_leistung"],
    ["Trockner", "sensor.keller_miele_trockner_leistung"], ["Kühlschrank", "sensor.kuche_kuhlschrank_shelly_leistung"]]
    .map(([n, e]) => [n, num(s, e)]).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  $("verbraucher").innerHTML = geraete.map(([n, v]) =>
    `<span class="chip${(v ?? 0) < 10 ? " aus" : ""}">${n} ${watt(v)}</span>`).join("");
}

// ---------- Batterie ----------
function bogen(a0, a1, r) {
  const p = (a) => [100 + r * Math.cos(a * Math.PI / 180), 100 - r * Math.sin(a * Math.PI / 180)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}`;
}
function zeigeBatterie(s, ap) {
  const soc = num(s, "sensor.venus_dc_batterie_ladestand");
  const w = (p) => 180 - p * 1.8;
  let svg = `<path d="${bogen(w(0), w(20), 80)}" stroke="#db4437" stroke-width="18" fill="none"/>`
    + `<path d="${bogen(w(20), w(50), 80)}" stroke="#ffa600" stroke-width="18" fill="none"/>`
    + `<path d="${bogen(w(50), w(100), 80)}" stroke="#43a047" stroke-width="18" fill="none"/>`;
  if (soc !== null) {
    const a = w(Math.min(Math.max(soc, 0), 100)) * Math.PI / 180;
    // Nadel nur im Bogen, damit sie die Zahl in der Mitte nicht überdeckt
    const pt = (r) => `${(100 + r * Math.cos(a)).toFixed(1)},${(100 - r * Math.sin(a)).toFixed(1)}`;
    svg += `<polyline points="${pt(66)} ${pt(94)}" stroke="#e5e7eb" stroke-width="4" stroke-linecap="round"/>`;
  }
  svg += `<text x="100" y="96" text-anchor="middle" fill="#e5e7eb" font-size="26">${soc === null ? "–" : zahl(soc, 1) + " %"}</text>`;
  // Energie im Akku (30 kWh) und über der Reserve (28.09.2026)
  const res = num(s, "sensor.venus_aktiver_soc_grenzwert");
  if (soc !== null) svg += `<text x="100" y="126" text-anchor="middle" fill="#9ca3af" font-size="10.5">${zahl(soc * 0.3, 1)} von 30 kWh</text>`
    + (res !== null ? `<text x="100" y="140" text-anchor="middle" fill="#9ca3af" font-size="10.5">${zahl(Math.max(soc - res, 0) * 0.3, 1)} kWh über Reserve (${zahl(res, 0)} %)</text>` : "");
  // Akku-Zeiten (29.09.2026): Text aus sensor.akku_prognose, in HA fertig formatiert (d.ap)
  if (ap) svg += `<text x="100" y="156" text-anchor="middle" fill="#9ca3af" font-size="10.5">⏱ ${ap.replace(/[<>&]/g, "")}</text>`;
  $("tacho").innerHTML = svg;
  const b = num(s, "sensor.venus_dc_batterie_leistung");
  $("batt_laden").hidden = !(b > 50);
  $("batt_entladen").hidden = !(b < -50);
  $("batt_w").textContent = b === null ? "–" : zahl(b, 1) + " W";

  $("phasen").innerHTML = [1, 2, 3].map((i) =>
    `<div class="phase"><div class="name">L${i}</div><div class="zahl">${watt(num(s, "sensor.venus_verbrauchsleistung_l" + i))}</div></div>`).join("");
  const kwh = (e) => { const v = num(s, e); return v === null ? "–" : zahl(v, 0) + " kWh"; };
  $("zaehler").innerHTML =
    `<div class="kachel"><div class="name">Bezug</div><div class="zahl">${kwh("sensor.stromzahler_bezug")}</div></div>`
    + `<div class="kachel"><div class="name">Einspeisung</div><div class="zahl">${kwh("sensor.stromzahler_einspeisung")}</div></div>`;
}

// ---------- Klima ----------
const MODUS = { off: ["Aus", ""], heat: ["Heizen", "heat"], cool: ["Kühlen", "cool"], heat_cool: ["Auto", "an"],
  dry: ["Entfeuchten", "an"], fan_only: ["Lüften", "an"] };
function zeigeKlima(s, a) {
  const g = [["Wintergarten", "wintergarten"], ["Emil", "emil"], ["Dachspitz", "dachspitz"]];
  $("klima").innerHTML = g.map(([n, k]) => {
    const e = `climate.${k}_room_temperature`, at = a[e] || {};
    const [txt, cls] = MODUS[s[e]] || [s[e] ?? "–", ""];
    const heute = num(s, `sensor.klima_${k}_betrieb_heute`);
    return `<div class="kachel klima ${cls}"><div class="name">${n}</div><div class="modus">${txt}</div>`
      + `<div class="temp">${at.ist == null ? "–" : zahl(at.ist, 0) + " °C"}</div>`
      + `<div class="sub">Soll ${at.soll == null ? "–" : zahl(at.soll, 1) + " °C"} · heute ${heute === null ? "–" : zahl(heute, 1) + " kWh"}</div></div>`;
  }).join("");
}

// ---------- Wasser ----------
function zeigeWasser(s) {
  const zv = num(s, "sensor.wasserzahler_stadtwerke"), hv = num(s, "sensor.wasser_heute_liter");
  const alarm = s["sensor.syr_connect_245124253_getala"];
  const ventil = { open: "Geöffnet", closed: "Geschlossen", opening: "Öffnet", closing: "Schließt" }[s["valve.syr_connect_245124253_getab"]] ?? "–";
  const k = (n, z, farbe) => `<div class="kachel"><div class="name">${n}</div><div class="zahl"${farbe ? ` style="color:${farbe}"` : ""}>${z}</div></div>`;
  $("wasser").innerHTML = k("Wasserzähler", zv === null ? "–" : zahl(zv, 0) + " m³")
    + k("Heute", hv === null ? "–" : zahl(hv, 0) + " L")
    + (alarm === "no_alarm" ? k("Alarm", "Kein Alarm", "var(--gruen)") : k("Alarm", alarm ?? "–", "var(--vl)"))
    + k("Ventil", ventil);
}

// ---------- Großverbraucher & PV je Fläche ----------
function zeigeTabellen(s, k, lp) {
  {
  // Großverbraucher gegliedert wie im Dashboard (29.09.2026): Gruppen mit Summe, € (Bezugspreis live), Ø/Tag über Tage mit Messung
  // (ab Folgemonat inkl. Vormonat lp), Jahr ≈ = Ø/Tag × 365; grüne Zeile = Anteil aus PV/Akku, Haus-€ = nur Netzbezug
  const preis = (num(s, "input_number.strompreis_bezug") ?? 0) / 100;
  const jetztMs = Date.now(), ms = new Date(); ms.setDate(1); ms.setHours(0, 0, 0, 0);
  const pms = new Date(ms); pms.setMonth(pms.getMonth() - 1);
  const avg = (m, l, start) => {
    if (m === null || m === undefined) return null;
    const st = start ? new Date(start).getTime() : null;
    const tage = (jetztMs - Math.max(ms.getTime(), st ?? 0)) / 864e5;
    const pt = (l || 0) > 0 ? (ms.getTime() - Math.max(pms.getTime(), st ?? 0)) / 864e5 : 0;
    return tage + Math.max(pt, 0) < 0.5 ? null : (m + (l || 0)) / (tage + Math.max(pt, 0));
  };
  const G = [
    ["🔥 Heizen", [["Wärmepumpe", "sensor.cmi_wp_leistung_elektrisch", "sensor.cmi_wp_energie_heute", "sensor.wp_energie_monat", "2026-09-22T17:14"],
      ["Klima Wintergarten ≈", "sensor.klima_wintergarten_leistung_geschatzt", "sensor.klima_wintergarten_heute", "sensor.klima_wintergarten_monat", null],
      ["Klima Emil ≈", "sensor.klima_emil_leistung_geschatzt", "sensor.klima_emil_heute", "sensor.klima_emil_monat", null],
      ["Klima Dachspitz ≈", "sensor.klima_dachspitz_leistung_geschatzt", "sensor.klima_dachspitz_heute", "sensor.klima_dachspitz_monat", null]]],
    ["🚿 Warmwasser", [["BWWP", "sensor.keller_bwwp_shelly_leistung", "sensor.keller_bwwp_shelly_bwwp_energie_heute", "sensor.bwwp_energie_monat", "2026-09-22T17:14"],
      ["↳ Verdichter", "sensor.bwwp_verdichter_leistung", "sensor.bwwp_verdichter_energie_heute", "verdichter", "2026-09-22T17:14", "teil"],
      ["↳ Heizstab ⚡", "sensor.bwwp_heizstab_leistung", "sensor.bwwp_heizstab_energie_heute", "sensor.bwwp_heizstab_energie_monat", "2026-09-22T17:14", "teil hz"]]],
    ["🏠 Haushaltsgeräte", [["Spülmaschine", "sensor.kuche_spulmaschine_shelly_leistung", "sensor.spulmaschine_energie_heute", "sensor.spulmaschine_energie_monat", "2026-09-22T17:37"],
      ["Waschmaschine", "sensor.keller_miele_waschmaschine_leistung", "sensor.waschmaschine_energie_heute", "sensor.waschmaschine_energie_monat", "2026-09-24T02:30"],
      ["Trockner", "sensor.keller_miele_trockner_leistung", "sensor.trockner_energie_heute", "sensor.trockner_energie_monat", "2026-09-24T02:30"],
      ["Kühlschrank", "sensor.kuche_kuhlschrank_shelly_leistung", "sensor.kuhlschrank_energie_heute", "sensor.kuhlschrank_energie_monat", "2026-09-24T12:34"],
      ["Kühlschrank Garage", "sensor.garage_kuhlschrank_shelly_leistung", "sensor.kuhlschrank_garage_energie_heute", "sensor.kuhlschrank_garage_energie_monat", "2026-09-24T17:59"]]],
    ["🔌 Sonstiges", [["Entfeuchter", "sensor.keller_entfeuchter_power", "sensor.entfeuchter_energie_heute", "sensor.entfeuchter_energie_monat", "2026-09-24T02:30"],
      ["Nerdaxe", "sensor.smart_switch_23022384462303510d0248e1e9bb5091_power", "sensor.nerdaxe_energie_heute", "sensor.nerdaxe_energie_monat", "2026-09-24T02:30"],
      ["Iceriver", "sensor.keller_iceriver_miner_power", "sensor.iceriver_energie_heute", "sensor.iceriver_energie_monat", "2026-09-24T02:30"]]]];
  const kv = (e) => (k[e] === undefined ? null : k[e]);
  const w0 = (v) => (v === null ? "–" : zahl(v, 0) + " W");
  const eur = (v) => zahl(v, 2) + " €";
  const zelle = (v, n = 2, e) => v === null ? "–" : `${zahl(v, n)}<span class="eur">${eur(e ?? v * preis)}</span>`;
  const jahr = (a, e) => a === null ? "–" : `${zahl(a * 365, 0)}<span class="eur">${zahl((e ?? a * preis) * 365, 0)} €</span>`;
  const zeile = (cls, n, p, h, m, av, eh, em, ea) => `<tr class="${cls}"><td>${n}</td><td>${w0(p)}</td><td>${zelle(h, 2, eh)}</td><td>${zelle(m, 2, em)}</td><td>${zelle(av, 2, ea)}</td><td>${jahr(av, ea)}</td></tr>`;
  let html = "<tr><th></th><th>jetzt</th><th>heute</th><th>Monat</th><th>Ø/Tag</th><th>Jahr ≈</th></tr>";
  let sp = 0, sh = 0, sa = 0; const gruppen = [];
  for (const [gn, items] of G) {
    let gp = 0, gh = 0, gm = 0, ga = 0, zeilen = "";
    for (const [n, p, h, m, st, cls] of items) {
      let mv, l;
      if (m === "verdichter") { const b = kv("sensor.bwwp_energie_monat"), z = kv("sensor.bwwp_heizstab_energie_monat");
        mv = b === null || z === null ? null : Math.max(b - z, 0); l = (lp["sensor.bwwp_energie_monat"] || 0) - (lp["sensor.bwwp_heizstab_energie_monat"] || 0);
      } else { mv = kv(m); l = lp[m] || 0; }
      const pv = num(s, p), hv = kv(h), av = avg(mv, l, st);
      if (!cls) { gp += pv ?? 0; gh += hv ?? 0; gm += mv ?? 0; ga += av ?? 0; }
      zeilen += zeile((cls || "") + (cls && cls.includes("hz") && s["binary_sensor.bwwp_heizstab"] === "on" ? " an" : ""), n, pv, hv, mv, av);
    }
    gruppen.push([gn, gp, gh, gm, ga, zeilen]); sp += gp; sh += gh; sa += ga;
  }
  const hp = num(s, "sensor.hausverbrauch"), hh = kv("sensor.hausverbrauch_heute"), hm = kv("sensor.hausverbrauch_monat");
  const haStart = "2026-09-22T15:00", ha = avg(hm, lp["sensor.hausverbrauch_monat"] || 0, haStart);
  const ra = ha === null ? null : Math.max(ha - sa, 0), rh = hh === null ? null : Math.max(hh - sh, 0);
  const rm = ra === null ? null : ra * (jetztMs - Math.max(ms.getTime(), new Date(haStart).getTime())) / 864e5;
  const rp = num(s, "sensor.rest_ungemessen");
  for (const [gn, gp, gh, gm, ga, zeilen] of gruppen) {
    const x = gn.includes("Sonstiges");
    html += zeile("gruppe", gn, gp + (x ? rp ?? 0 : 0), gh + (x ? rh ?? 0 : 0), gm + (x ? rm ?? 0 : 0), ga + (x ? ra ?? 0 : 0)) + zeilen
      + (x ? zeile("", "Rest (ungemessen)", rp, rh, rm, ra) : "");
  }
  // Netzbezug: heute = EM540 − Mitternachtsstand, Monat = utility_meter
  const np = Math.max(num(s, "sensor.em_540_netzmessgeraet_leistung") ?? 0, 0);
  const nh = Math.max((num(s, "sensor.em_540_netzmessgeraet_verbrauch") ?? 0) - (num(s, "input_number.em540_bezug_mitternacht") ?? 0), 0);
  const nm = kv("sensor.netzbezug_monat"), na = avg(nm, lp["sensor.netzbezug_monat"] || 0, haStart);
  const g = (a, b) => (a === null || b === null ? null : Math.max(a - b, 0));
  const gh2 = g(hh, nh), gm2 = g(hm, nm), ga2 = g(ha, na);
  html += zeile("pvabzug", "☀️ davon aus PV/Akku<span class=\"eur\">kostet nichts</span>", hp === null ? null : Math.max(hp - np, 0),
      gh2, gm2, ga2, gh2 === null ? null : -gh2 * preis, gm2 === null ? null : -gm2 * preis, ga2 === null ? null : -ga2 * preis)
    + zeile("haus", "Haus gesamt<span class=\"eur\">€ = nur Netzbezug</span>", hp, hh, hm, ha, nh * preis, nm === null ? null : nm * preis, na === null ? null : na * preis);
  $("gross").innerHTML = html;
  $("gross_fuss").innerHTML = `kWh · € = kWh × ${zahl(preis * 100, 2)} ct (je Gerät ohne PV-Abzug) · Ø/Tag nur über Tage mit Messung · Jahr ≈ = Ø/Tag × 365 – Heizen ist saisonal, die Hochrechnung aus wenigen Tagen ist dafür zu niedrig · ≈ geschätzt`;

  }
  const kw = (e) => (k[e] == null ? "–" : zahl(k[e], 2));
  const w0 = (e) => { const v = num(s, e); return v === null ? "–" : zahl(v, 0) + " W"; };
  const F = [
    ["Dach Ost", "MPPT1", "sensor.mppt1_1_dach_ost_leistung_pv_ertrag", "sensor.mppt1_1_dach_ost_ertrag_heute", "sensor.mppt1_1_dach_ost_maximalleistung_heute"],
    ["Dach West", "MPPT3", "sensor.mppt3_6_dach_west_leistung_pv_ertrag", "sensor.mppt3_6_dach_west_ertrag_heute", "sensor.mppt3_6_dach_west_maximalleistung_heute"],
    ["Fassade Süd oben", "RS 450 #3", "sensor.mppt2_leistung_pv_tracker_3_sued_oben", "sensor.mppt2_ertrag_tracker_3_sued_oben_heute", "sensor.mppt2_maximalleistung_tracker_3_sued_oben_heute"],
    ["Fassade Süd unten", "RS 450 #4", "sensor.mppt2_leistung_pv_tracker_4_sued_unten", "sensor.mppt2_ertrag_tracker_4_sued_unten_heute", "sensor.mppt2_maximalleistung_tracker_4_sued_unten_heute"],
    ["Gaube Ost", "RS 450 #2", "sensor.mppt2_leistung_pv_tracker_2_gaube_ost", "sensor.mppt2_ertrag_tracker_2_gaube_ost_heute", "sensor.mppt2_maximalleistung_tracker_2_gaube_ost_heute"],
    ["Gaube West", "RS 450 #5", "sensor.mppt2_leistung_pv_tracker_5_gaube_west", "sensor.mppt2_ertrag_tracker_5_gaube_west_heute", "sensor.mppt2_maximalleistung_tracker_5_gaube_west_heute"],
  ];
  const sw = F.reduce((a, f) => a + (num(s, f[2]) ?? 0), 0);
  const sh = F.reduce((a, f) => a + (k[f[3]] ?? 0), 0);
  $("pvflaeche").innerHTML = "<tr><th>Fläche</th><th>jetzt</th><th>heute kWh</th><th>max heute</th></tr>"
    + F.map(([n, m, p, h, mx]) => `<tr><td>${n} <span class="klein">${m}</span></td><td>${w0(p)}</td><td>${kw(h)}</td><td>${w0(mx)}</td></tr>`).join("")
    + `<tr class="summe"><td>Summe</td><td>${zahl(sw, 0)} W</td><td>${zahl(sh, 2)}</td><td></td></tr>`;
}

// ---------- Wärmepumpen – Strom pro Tag (26.09.2026) ----------
// d.h = Tageswerte aus HA (gratis.yaml), heute wird mit Live-Werten ersetzt. wpg/bwg = PV/Akku („gratis“).
const f1 = (v) => zahl(v, 1);
function tagesListe(s, k, h) {
  const heute = new Date(), key = heute.getFullYear() + "-" + String(heute.getMonth() + 1).padStart(2, "0") + "-" + String(heute.getDate()).padStart(2, "0");
  const l = (h || []).filter((t) => t.d !== key);
  l.push({ d: key, wp: k["sensor.cmi_wp_energie_heute"] ?? 0, wpg: num(s, "sensor.wp_strom_gratis_heute") ?? 0,
    bw: k["sensor.keller_bwwp_shelly_bwwp_energie_heute"] ?? 0, bwg: num(s, "sensor.bwwp_strom_gratis_heute") ?? 0 });
  return l.map((t) => { const wpg = Math.min(t.wpg, t.wp), bwg = Math.min(t.bwg, t.bw);
    return { d: t.d, teile: [wpg, t.wp - wpg, bwg, t.bw - bwg], gratis: wpg + bwg, summe: t.wp + t.bw }; });
}
function kreis(cx, cy, r, p) {
  if (p >= 0.999) return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#22c55e"/>`;
  let t = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ef4444"/>`;
  if (p > 0.001) { const a = 2 * Math.PI * p, x2 = cx + r * Math.sin(a), y2 = cy - r * Math.cos(a);
    t += `<path d="M${cx},${cy} L${cx},${cy - r} A${r},${r} 0 ${p > 0.5 ? 1 : 0} 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="#22c55e"/>`; }
  return t;
}
function zeigeTage(s, k, h) {
  const alle = tagesListe(s, k, h), tage = alle.slice(-(window.innerWidth < 600 ? 7 : 10));
  const W = 700, H = 330, L = 34, R = 10, O = 78, U = 28, ph = H - O - U;
  const max = Math.max(4, ...tage.map((t) => t.summe)), schritt = max > 12 ? 4 : 2, ymax = Math.ceil(max / schritt) * schritt;
  const y = (v) => O + ph - v / ymax * ph, bw = (W - L - R) / tage.length, FARB = ["#3b82f6", "#1d4ed8", "#f87171", "#dc2626"];
  let svg = "";
  for (let v = 0; v <= ymax; v += schritt) svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#374151" stroke-dasharray="3 3"/>`
    + `<text x="${L - 6}" y="${y(v) + 4}" fill="#9ca3af" font-size="11" text-anchor="end">${v}</text>`;
  tage.forEach((t, i) => {
    const x0 = L + i * bw + bw * 0.2, b = bw * 0.6, cx = x0 + b / 2;
    let acc = 0;
    t.teile.forEach((v, j) => { if (v <= 0) return; const y1 = y(acc + v), y0 = y(acc); acc += v;
      svg += `<rect x="${x0.toFixed(1)}" y="${y1.toFixed(1)}" width="${b.toFixed(1)}" height="${(y0 - y1).toFixed(1)}" fill="${FARB[j]}"/>`; });
    const d = new Date(t.d + "T12:00:00");
    svg += `<text x="${cx}" y="${H - 8}" fill="#9ca3af" font-size="12" text-anchor="middle">${d.getDate()}.${d.getMonth() + 1}.</text>`;
    if (t.summe > 0) {
      const top = y(t.summe), lw = 40;
      svg += `<rect x="${cx - lw / 2}" y="${top - 24}" width="${lw}" height="18" rx="3" fill="#111827" stroke="#e5e7eb"/>`
        + `<text x="${cx}" y="${top - 10.5}" fill="#fff" font-size="13" font-weight="700" text-anchor="middle">${f1(t.summe)}</text>`;
      if (t.gratis >= 0.05) svg += `<text x="${cx}" y="${top - 30}" fill="#22c55e" font-size="13" font-weight="700" text-anchor="middle">${f1(t.gratis)}</text>`;
      svg += `<g>${kreis(cx, top - 56, 13, t.gratis / t.summe)}<title>PV/Akku ${f1(t.gratis)} kWh (${Math.round(t.gratis / t.summe * 100)} %) · Netz ${f1(t.summe - t.gratis)} kWh</title></g>`;
    }
  });
  $("tage").innerHTML = svg;

  // 30-Tage-Kreis
  const m = alle.slice(-30), g = m.reduce((a, t) => a + t.gratis, 0), sum = m.reduce((a, t) => a + t.summe, 0), p = sum > 0 ? g / sum : 0;
  const r = 90, u = 2 * Math.PI * r;
  $("donut").innerHTML = `<circle cx="110" cy="110" r="${r}" fill="none" stroke="#ef4444" stroke-width="30"/>`
    + `<circle cx="110" cy="110" r="${r}" fill="none" stroke="#22c55e" stroke-width="30" stroke-dasharray="${(u * p).toFixed(1)} ${u.toFixed(1)}" transform="rotate(-90 110 110)"/>`
    + `<text x="110" y="102" fill="#9ca3af" font-size="14" text-anchor="middle">gesamt</text>`
    + `<text x="110" y="128" fill="#e5e7eb" font-size="22" text-anchor="middle">${f1(sum)} kWh</text>`;
  $("donut_text").innerHTML = `<b>Letzte ${m.length} Tage</b> (WP + BWWP)<br>`
    + `<span style="color:#22c55e">●</span> PV / Akku (gratis): <b>${f1(g)} kWh</b> · ${Math.round(p * 100)} %<br>`
    + `<span style="color:#ef4444">●</span> Netz: <b>${f1(sum - g)} kWh</b> · ${Math.round((1 - p) * 100)} %`;
}

// ---------- PV-Überschuss (wie Übersicht, Stand 26.09.2026) ----------
function zeigePV(s) {
  const u = Math.max(num(s, "sensor.pv_uberschuss_verfugbar") ?? 0, 0), netz = num(s, "sensor.em_540_netzmessgeraet_leistung") ?? 0;
  const e = Math.max(-netz, 0), bez = Math.max(netz, 0), pv = num(s, "sensor.pv_gesamt") ?? 0;
  const soc = num(s, "sensor.venus_dc_batterie_ladestand") ?? 0, res = num(s, "sensor.venus_aktiver_soc_grenzwert") ?? 0;
  const ab = num(s, "sensor.venus_dc_batterie_leistung") ?? 0, akku = Math.max(ab, 0), ent = Math.max(-ab, 0);
  const kw = (w) => zahl(w / 1000, 1);
  // Tacho 0–4000 W
  const w = (v) => 180 - Math.min(v, 4000) / 4000 * 180;
  let t = [[0, 300, "#22c55e"], [300, 800, "#facc15"], [800, 2000, "#f97316"], [2000, 4000, "#ef4444"]]
    .map(([a, b, c]) => `<path d="${bogen(w(a), w(b), 80)}" stroke="${c}" stroke-width="18" fill="none"/>`).join("");
  const a = w(u) * Math.PI / 180, pt = (r) => `${(100 + r * Math.cos(a)).toFixed(1)},${(100 - r * Math.sin(a)).toFixed(1)}`;
  t += `<polyline points="${pt(66)} ${pt(94)}" stroke="#e5e7eb" stroke-width="4" stroke-linecap="round"/>`
    + `<text x="100" y="96" text-anchor="middle" fill="#e5e7eb" font-size="26">${watt(u)}</text>`
    + `<text x="100" y="124" text-anchor="middle" fill="#9ca3af" font-size="13">ungenutzt</text>`;
  $("pvtacho").innerHTML = t;
  const soctxt = "Akku " + zahl(soc, 0) + " %" + (res > 0 && soc <= res + 3 ? " (Reserve)" : "");
  const kopf = (farbe, txt, zeile) => `<h3 style="color:${farbe}">${txt}</h3><div class="grau">${zeile}</div>`;
  let h;
  if (u >= 300) {
    const col = u >= 2000 ? "#ef4444" : u >= 800 ? "#f97316" : "#facc15";
    h = kopf(col, kw(e) + " kW gehen ins Netz", soc >= 90 && akku > 50 ? `Akku fast voll (${zahl(soc, 0)} %), lädt noch ${kw(akku)} kW` : "");
    const G = [["🧺 Waschmaschine", "binary_sensor.waschmaschine_lauft", 2200], ["🍽️ Spülmaschine", "binary_sensor.spulmaschine_lauft", 2000],
      ["🌀 Trockner", "binary_sensor.trockner_lauft", 1000], ["❄️ Klima Wintergarten", "climate.wintergarten_room_temperature", 500],
      ["❄️ Klima Emil", "climate.emil_room_temperature", 500], ["❄️ Klima Dachspitz", "climate.dachspitz_room_temperature", 500]];
    const l = G.filter(([, ent, wt]) => s[ent] === "off" && wt <= u + 300).map(([n, , wt]) => `${n} <span class="grau">~${kw(wt)} kW</span>`);
    h += l.length ? `<div style="margin-top:8px"><b>Jetzt einschalten:</b><br>${l.join("<br>")}</div>` : `<div class="grau" style="margin-top:8px">Alle passenden Geräte laufen schon.</div>`;
  } else if (pv < 30) {
    h = bez > 150 ? kopf("#60a5fa", "🌙 Keine Sonne – Strom aus dem Netz", `Netz ${kw(bez)} kW · ${soctxt}`)
      : kopf("#60a5fa", "🌙 Keine Sonne – Haus läuft aus dem Akku", `Akku gibt ${kw(ent)} kW · ${soctxt}` + (res > 0 ? `, Reserve ${zahl(res, 0)} %` : ""));
  } else if (bez > 150) h = kopf("#f59e0b", "⛅ PV reicht nicht – Rest aus dem Netz", `PV ${kw(pv)} kW · Netz ${kw(bez)} kW · ${soctxt}`);
  else if (ent > 100) h = kopf("#f59e0b", "⛅ PV reicht nicht – Rest aus dem Akku", `PV ${kw(pv)} kW · Akku gibt ${kw(ent)} kW · ${soctxt}`);
  else if (akku > 100 && soc < 97) h = kopf("#22c55e", "🔋 Sonne lädt den Akku", `+${kw(akku)} kW in den Akku · ${soctxt} – ins Netz geht erst etwas, wenn er voll ist`);
  else h = kopf("#22c55e", "✓ Alles wird selbst verbraucht", `PV ${kw(pv)} kW · Einspeisung ${zahl(e, 0)} W · ${soctxt}`);
  $("pvtext").innerHTML = h + netzHeute(s, bez, e, akku, ent, soc);
}

// „Netz heute“ im VSI-Stil (29.09.2026, wie Dashboard): Säule von 0 bis Wert, oben Bezug, unten Einspeisung, log bis 40 kWh;
// rechts Symbol der aktuellen Lage (Strommast/Akku/Haus)
function netzHeute(s, bez, e, akku, ent, soc) {
  const bz = Math.max((num(s, "sensor.em_540_netzmessgeraet_verbrauch") ?? 0) - (num(s, "input_number.em540_bezug_mitternacht") ?? 0), 0);
  const ez = Math.max((num(s, "sensor.em_540_netzmessgeraet_einspeisung") ?? 0) - (num(s, "input_number.em540_einspeisung_mitternacht") ?? 0), 0);
  const pb = (num(s, "input_number.strompreis_bezug") ?? 0) / 100, pe = (num(s, "input_number.einspeiseverguetung") ?? 0) / 100;
  const c = 105, hh = 92, f = (v) => Math.min(Math.log(1 + v) / Math.log(41), 1);
  const farbe = (v) => (v < 2 ? "#22c55e" : v < 5 ? "#facc15" : v < 10 ? "#f97316" : "#ef4444");
  let g = `<rect x="30" y="${c - hh - 4}" width="24" height="${2 * hh + 8}" rx="6" fill="#262626" stroke="#3f3f46"/>`;
  for (const [v, sg] of [[bz, -1], [ez, 1]]) { const d = hh * f(v); g += `<rect x="42" y="${sg < 0 ? c - d : c}" width="12" height="${d}" fill="${farbe(v)}"/>`; }
  for (const m of [1, 2, 5, 10, 20, 40]) for (const y of [c - hh * f(m), c + hh * f(m)])
    g += `<line x1="30" x2="38" y1="${y}" y2="${y}" stroke="#d4d4d8" stroke-width="1.5"/><text x="25" y="${y + 4}" font-size="11" fill="#a1a1aa" text-anchor="end">${m}</text>`;
  g += `<line x1="26" x2="58" y1="${c}" y2="${c}" stroke="#fafafa" stroke-width="2.5"/><text x="22" y="${c + 4}" font-size="12" font-weight="700" fill="#fafafa" text-anchor="end">0</text>`;
  const txt = (y, t, sz, col, w = 400) => `<text x="90" y="${y}" font-size="${sz}" font-weight="${w}" fill="${col}">${t}</text>`;
  g += txt(40, "▲ Netzbezug heute", 15, "#a1a1aa") + txt(74, zahl(bz, 1) + " kWh", 30, farbe(bz), 700) + txt(96, "≈ " + zahl(bz * pb, 2) + " € Kosten", 16, "#d4d4d8")
    + txt(130, "▼ Einspeisung heute", 15, "#a1a1aa") + txt(164, zahl(ez, 1) + " kWh", 30, farbe(ez), 700) + txt(186, "≈ " + zahl(ez * pe, 2) + " € Vergütung", 16, "#d4d4d8");
  // Lage-Symbol
  const cx = 380; let lage, sc, cap;
  if (bez > 150) [lage, sc, cap] = ["netz", "#f97316", "aus dem Netz"];
  else if (e > 150) [lage, sc, cap] = ["netz", "#facc15", "ins Netz"];
  else if (akku > 100) [lage, sc, cap] = ["akku", "#22c55e", "Akku lädt"];
  else if (ent > 100) [lage, sc, cap] = ["akku", "#60a5fa", "Akku entlädt"];
  else [lage, sc, cap] = ["haus", "#22c55e", "alles selbst verbraucht"];
  g += `<style>@keyframes vp{0%,100%{opacity:1}50%{opacity:.35}}.vp{animation:vp 1.6s ease-in-out infinite}</style>`;
  if (lage === "netz") {
    const up = bez > 150;
    g += `<g fill="none" stroke="${sc}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M${cx - 18},150 L${cx - 5},62 L${cx},50 L${cx + 5},62 L${cx + 18},150"/>`
      + `<path d="M${cx - 30},80 H${cx + 30} M${cx - 22},98 H${cx + 22}"/><path d="M${cx - 8},80 L${cx + 10},98 M${cx + 8},80 L${cx - 10},98 M${cx - 11},98 L${cx + 14},125 M${cx + 11},98 L${cx - 14},125 M${cx - 14},125 L${cx + 17},148 M${cx + 14},125 L${cx - 17},148"/>`
      + `<path d="M${cx - 30},80 v8 M${cx + 30},80 v8 M${cx - 22},98 v8 M${cx + 22},98 v8" stroke-width="2"/></g>`
      + `<g class="vp" fill="${sc}"><path d="M${cx + 42},${up ? 70 : 130} l-9,${up ? 14 : -14} h6 v${up ? 26 : -26} h6 v${up ? -26 : 26} h6 z"/></g>`;
  } else if (lage === "akku") {
    const h = 80 * Math.min(Math.max(soc, 0), 100) / 100;
    g += `<rect x="${cx - 10}" y="52" width="20" height="8" rx="2" fill="${sc}"/><rect x="${cx - 26}" y="60" width="52" height="92" rx="8" fill="none" stroke="${sc}" stroke-width="3"/>`
      + `<rect x="${cx - 20}" y="${146 - h}" width="40" height="${h}" rx="4" fill="${sc}" opacity="0.35"/>`
      + (akku > 100 ? `<path class="vp" d="M${cx + 4},72 L${cx - 10},108 L${cx + 1},108 L${cx - 4},138 L${cx + 12},98 L${cx + 1},98 Z" fill="${sc}"/>`
        : `<g class="vp" fill="${sc}"><path d="M${cx + 44},130 l-9,-14 h6 v-26 h6 v26 h6 z"/></g>`);
  } else {
    g += `<g fill="none" stroke="${sc}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M${cx - 34},98 L${cx},66 L${cx + 34},98"/><path d="M${cx - 26},92 V150 H${cx + 26} V92"/><path d="M${cx - 12},122 l8,9 l17,-19" stroke-width="3.5"/></g>`
      + `<g class="vp"><circle cx="${cx + 30}" cy="52" r="8" fill="#facc15"/><path d="M${cx + 30},38 v-5 M${cx + 44},52 h5 M${cx + 40},42 l4,-4 M${cx + 20},42 l-4,-4 M${cx + 40},62 l4,4" stroke="#facc15" stroke-width="2.5" stroke-linecap="round"/></g>`;
  }
  g += `<text x="${cx}" y="182" font-size="13" fill="#a1a1aa" text-anchor="middle">${cap}</text>`;
  return `<svg viewBox="0 0 460 210" style="width:100%;display:block;margin-top:10px" font-family="-apple-system,Helvetica,Arial,sans-serif">${g}</svg>`;
}

// ---------- Wasser-Grafiken (29.09.2026, wie Dashboard) ----------
function zeigeWasserGrafik(d) {
  const s = d.s || {}, j = new Date().getFullYear();
  const breite = (id) => { const W = Math.max(Math.round($(id).getBoundingClientRect().width) || 1000, 300); return [W, W < 600]; };
  // 1) Zapfungen heute: Balken je Zapfung, Höhe = Liter, rot warm / blau kalt, Tooltip per <title>
  {
    const [W, schmal] = breite("wheute"), H = 200, L = 40, R = W - 10, T = 12, B = H - 26;
    $("wheute").setAttribute("viewBox", `0 0 ${W} ${H}`);
    const t0 = new Date(); t0.setHours(0, 0, 0, 0); const x0 = t0.getTime(), x1 = x0 + 864e5;
    const X = (t) => L + (t - x0) / (x1 - x0) * (R - L);
    const z = (d.zp || []).map((p) => { const m = /^(\d+)\.(\d+)\. (\d+):(\d+)/.exec(p[0] || ""); if (!m) return null;
      return [new Date(j, m[2] - 1, m[1], m[3], m[4]).getTime() + (p[1] || 0) * 3e4, p]; }).filter((e) => e && e[0] >= x0 && e[0] < x1);
    const max = Math.max(20, ...z.map((e) => e[1][2] || 0)), top = Math.ceil(max / 20) * 20, Y = (v) => B - v / top * (B - T);
    let g = "";
    for (let v = 0; v <= top; v += top / 4) g += `<line x1="${L}" x2="${R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#374151" stroke-dasharray="3 4"/><text x="${L - 6}" y="${Y(v) + 4}" fill="#9ca3af" font-size="11" text-anchor="end">${Math.round(v)}</text>`;
    for (let hh = 0; hh <= 24; hh += schmal ? 6 : 2) g += `<text x="${X(x0 + hh * 36e5)}" y="${H - 8}" fill="#9ca3af" font-size="11" text-anchor="${hh === 24 ? "end" : hh === 0 ? "start" : "middle"}">${String(hh).padStart(2, "0")}:00</text>`;
    const jetzt = Date.now(); g += `<line x1="${X(jetzt)}" x2="${X(jetzt)}" y1="${T}" y2="${B}" stroke="#9ca3af" stroke-dasharray="4 4"/>`;
    const bw = schmal ? 4 : 7;
    for (const [t, p] of z) { const col = p[3] ? "#ef4444" : "#3b82f6";
      g += `<rect x="${X(t) - bw / 2}" y="${Y(p[2] || 0)}" width="${bw}" height="${Math.max(B - Y(p[2] || 0), 1.5)}" fill="${col}"><title>${p[0]} · ${p[1]} min · ${p[4] || (p[3] ? "warm" : "kalt")} · ${p[2]} l ${p[3] ? "warm" : "kalt"}${p[5] ? " · max " + p[5] + " l/h" : ""}</title></rect>`; }
    g += `<line x1="${L}" x2="${R}" y1="${B}" y2="${B}" stroke="#6b7280"/><text x="${L - 6}" y="${T - 2}" fill="#9ca3af" font-size="10" text-anchor="end">l</text>`;
    $("wheute").innerHTML = g;
  }
  // 2) Liter pro Tag, 14 Tage: gesamt aus Zählerstand-Differenz, warm/Duschen aus BWWP-Tageswerten, heute live
  {
    const [W, schmal] = breite("wtage"), H = 240, L = 44, R = W - 10, T = 28, B = H - 40;
    $("wtage").setAttribute("viewBox", `0 0 ${W} ${H}`);
    const key = (dt) => dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(dt.getDate()).padStart(2, "0");
    const wd = d.wd || [], stand = {}; for (const [k, v] of wd) stand[k] = v;
    const warm = {}, dusch = {}; for (const [k, w, n] of d.bt || []) { warm[k] = w; dusch[k] = n; }
    const heute = key(new Date()); warm[heute] = num(s, "sensor.warmwasser_heute_liter") ?? 0; dusch[heute] = num(s, "sensor.duschen_heute") ?? 0;
    const tage = []; for (let i = 13; i >= 0; i--) { const dt = new Date(); dt.setHours(12, 0, 0, 0); dt.setDate(dt.getDate() - i); tage.push(dt); }
    const vals = tage.map((dt) => { const k = key(dt), vk = new Date(dt); vk.setDate(vk.getDate() - 1); const kv = key(vk);
      let v1 = stand[k]; if (k === heute) v1 = num(s, "sensor.syr_connect_245124253_getvol") ?? v1;
      const ges = v1 !== undefined && stand[kv] !== undefined ? Math.max((v1 - stand[kv]) * 1000, 0) : null;
      const w = ges === null || warm[k] === undefined ? null : Math.min(warm[k], ges);
      return { dt, k, ges, w, n: dusch[k] }; });
    const max = Math.max(100, ...vals.map((v) => v.ges || 0)), top = Math.ceil(max / 200) * 200, Y = (v) => B - v / top * (B - T);
    const sw = (R - L) / 14, bw = sw * 0.6;
    let g = "";
    for (let v = 0; v <= top; v += top / 4) g += `<line x1="${L}" x2="${R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#374151" stroke-dasharray="3 4"/><text x="${L - 6}" y="${Y(v) + 4}" fill="#9ca3af" font-size="11" text-anchor="end">${Math.round(v)}</text>`;
    vals.forEach((v, i) => {
      const x = L + i * sw + (sw - bw) / 2, cx = x + bw / 2;
      if (v.ges !== null) {
        const tip = `<title>${v.dt.getDate()}.${v.dt.getMonth() + 1}.: ${Math.round(v.ges)} l${v.w !== null ? " (warm " + Math.round(v.w) + " l)" : ""}${v.n ? " · " + v.n + " Duschen" : ""}</title>`;
        if (v.w === null) g += `<rect x="${x}" y="${Y(v.ges)}" width="${bw}" height="${B - Y(v.ges)}" rx="3" fill="#6b7280">${tip}</rect>`;
        else g += `<rect x="${x}" y="${Y(v.w)}" width="${bw}" height="${B - Y(v.w)}" fill="#ef4444">${tip}</rect><rect x="${x}" y="${Y(v.ges)}" width="${bw}" height="${Y(v.w) - Y(v.ges)}" fill="#3b82f6">${tip}</rect>`;
        if (!schmal || i % 2 === 0 || i === 13) g += `<text x="${cx}" y="${Y(v.ges) - 6}" fill="#e5e7eb" font-size="${schmal ? 10 : 12}" font-weight="700" text-anchor="middle">${Math.round(v.ges)}</text>`;
      }
      if (!schmal || i % 2 === 1) g += `<text x="${cx}" y="${B + 16}" fill="#9ca3af" font-size="11" text-anchor="middle">${v.dt.getDate()}.${v.dt.getMonth() + 1}.</text>`;
      if (v.n) g += `<text x="${cx}" y="${B + 32}" fill="#e5e7eb" font-size="11" text-anchor="middle">🚿${v.n}</text>`;
    });
    g += `<line x1="${L}" x2="${R}" y1="${B}" y2="${B}" stroke="#6b7280"/><text x="${L - 6}" y="${T - 10}" fill="#9ca3af" font-size="10" text-anchor="end">l</text>`;
    $("wtage").innerHTML = g;
  }
}

// ---------- „Wann starten?“ (29.09.2026, wie Dashboard) ----------
function zeigeWann(d) {
  const s = d.s || {}, w = d.ws || [], eur = (v) => (v === null || v === undefined ? "–" : zahl(v, 2) + " €");
  let egal = true, html = "<tr><th></th><th>Empfehlung</th><th>jetzt</th><th>am besten</th><th>spart</th></tr>";
  const heute = new Date().toDateString();
  for (const [n, st, kj, kb, er, start, spanne, kwh] of w) {
    if (spanne > 0.05) egal = false;
    const morgen = start && new Date(zeitpunkt(start)).toDateString() !== heute ? " (morgen)" : "";
    let emp;
    if (st === "läuft") emp = "▶️ läuft";
    else if (st === "jetzt") emp = `<span style="color:#22c55e">✓ jetzt</span>` + (spanne <= 0.02 ? ` <span class="grau">egal wann</span>` : "");
    else if (!st || st === "unavailable" || st === "unknown") emp = "–";
    else emp = `<span style="color:#f59e0b">🕒 ab ${st}${morgen}</span>` + ((er || 0) <= 0.02 ? ` <span class="grau">gleich teuer, mehr Sonne</span>` : "");
    html += `<tr><td>${n}</td><td>${emp}</td><td>${eur(kj)}</td><td>${eur(kb)}</td><td>${(er || 0) > 0.005 ? eur(er) : "–"}</td></tr>`;
  }
  $("wann").innerHTML = html;
  $("wann_fuss").innerHTML = (egal ? "Der Akku wird voraussichtlich nicht voll – die Kosten sind fast gleich, mittags ist trotzdem sicherer. · " : "")
    + `Mehrkosten je Lauf · Strom ${zahl(num(s, "input_number.strompreis_bezug") ?? 0, 2)} ct, Einspeisung ${zahl(num(s, "input_number.einspeiseverguetung") ?? 0, 0)} ct · Verbrauch je Lauf wie der letzte (${w.map((x) => zahl(x[7] ?? 0, 2)).join(" / ")} kWh)`;
}

// ---------- Zeitleisten 48 h mit Verschieben über 14 Tage (29.09.2026) ----------
// d.zl = [Kürzel, Unix-s, 1/0] aus dem SQL-Helfer (15 Tage). Oben 48 h, darunter 14-Tage-Leiste: ziehen/tippen verschiebt,
// „Jetzt“ springt zurück. Tag hell (d.sn), Mitternacht Linie + Datum mittig, Tooltips per <title>.
const ZL = {
  zeitleiste: [["WP", ["wp"], ["#3b82f6"]], ["BWWP", ["bw", "hz"], ["#f87171", "#dc2626"], ["", " Heizstab"]], ["LLWP", ["ll"], ["#facc15"]]],
  zeitleiste2: [["Waschmaschine", ["wa"], ["#06b6d4"]], ["Trockner", ["tr"], ["#a855f7"]], ["Spülmaschine", ["sp"], ["#22c55e"]], ["Entfeuchter", ["en"], ["#f59e0b"]]],
};
const zlEnde = {};            // Fensterende je Leiste (ms), null = live
let zlSeg = {};               // Kürzel → [[von, bis, läuft]]
function zeigeZeitleiste(d) {
  const z = (d.zl || []).slice().sort((a, b) => a[1] - b[1]), jetzt = Date.now(), seg = {};
  const codes = [...new Set(z.map((r) => r[0]))];
  for (const c of codes) {
    const ev = z.filter((r) => r[0] === c).map((r) => [r[1] * 1000, r[2]]);
    const st = ev.length ? [[ev[0][0] - 1, ev[0][1] ? 0 : 1]].concat(ev) : [];
    seg[c] = [];
    for (let j = 0; j < st.length; j++) {
      if (!st[j][1] || (j > 0 && st[j - 1][1])) continue;
      let b = jetzt, lauf = true;
      for (let m = j + 1; m < st.length; m++) if (!st[m][1]) { b = st[m][0]; lauf = false; break; }
      seg[c].push([st[j][0], b, lauf]);
    }
  }
  zlSeg = seg; window.__zlSonne = d.sn;
  for (const id of Object.keys(ZL)) if ($(id)) zeichneZL(id);
}
function zeichneZL(id) {
  const Q = ZL[id], jetzt = Date.now(), ende = zlEnde[id] ?? jetzt, x0 = ende - 48 * 36e5;
  const svgEl = $(id), W = Math.max(Math.round(svgEl.getBoundingClientRect().width) || 1000, 300), schmal = W < 600;
  const H = 34, T = 30, hoehe = T + Q.length * (H + 10) + 26;
  svgEl.setAttribute("viewBox", `0 0 ${W} ${hoehe}`);
  const L = 8, R = W - 8, X = (t) => L + (t - x0) / (ende - x0) * (R - L), y2 = T + Q.length * (H + 10);
  const hm = (t) => new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const tg = (t) => new Date(t).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  const dau = (ms) => { const m = Math.round(ms / 6e4); return m >= 60 ? Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") + " min" : m + " min"; };
  let svg = "";
  const sn = window.__zlSonne;
  if (sn && sn[0] && sn[1]) {   // Tag hell
    const auf = zeitpunkt(sn[0]); let unter = zeitpunkt(sn[1]); if (unter < auf) unter += 864e5; const dauer = unter - auf;
    for (let a = auf - 16 * 864e5; a < ende + 864e5; a += 864e5) { const u = a + dauer; if (u < x0 || a > ende) continue;
      svg += `<rect x="${X(Math.max(a, x0))}" y="${T - 4}" width="${X(Math.min(u, ende)) - X(Math.max(a, x0))}" height="${Q.length * (H + 10) + 4}" fill="#cbd5e1" opacity="0.10"/>`; }
  }
  Q.forEach(([name, codes, farben, zus], i) => {
    const y = T + i * (H + 10);
    svg += `<rect x="${L}" y="${y + 6}" width="${R - L}" height="${H - 12}" fill="#4b5563"/>`;
    codes.forEach((c, k) => {
      for (const [a, b, lauf] of zlSeg[c] || []) {
        if (b <= x0 || a >= ende) continue;
        const aa = Math.max(a, x0), bb = Math.min(b, ende);
        svg += `<rect x="${X(aa)}" y="${y + 6}" width="${Math.max(X(bb) - X(aa), 1.5)}" height="${H - 12}" fill="${farben[k]}"><title>${name}${zus ? zus[k] : ""}: ${tg(a)} ${hm(a)}–${lauf ? "läuft" : hm(b)} (${dau(b - a)})</title></rect>`;
      }
    });
  });
  const schritt = (schmal ? 6 : 3) * 36e5, t = new Date(x0); t.setMinutes(0, 0, 0); t.setHours(Math.ceil(t.getHours() / (schmal ? 6 : 3)) * (schmal ? 6 : 3));
  for (let v = t.getTime(); v <= ende; v += schritt) { const h = new Date(v).getHours();
    svg += `<line x1="${X(v)}" x2="${X(v)}" y1="${y2 - 4}" y2="${y2 + 2}" stroke="#6b7280"/><text x="${X(v)}" y="${y2 + 18}" fill="#9ca3af" font-size="${schmal ? 11 : 12}" text-anchor="middle">${String(h).padStart(2, "0")}:00</text>`; }
  const mn = new Date(x0); mn.setHours(24, 0, 0, 0);
  for (let v = mn.getTime(); v < ende; v += 864e5) svg += `<line x1="${X(v)}" x2="${X(v)}" y1="${T - 8}" y2="${y2}" stroke="#e5e7eb" stroke-width="1.2" opacity="0.8"/>`;
  for (let t0 = mn.getTime() - 864e5; t0 < ende; t0 += 864e5) { const a = Math.max(t0, x0), b = Math.min(t0 + 864e5, ende);
    if (X(b) - X(a) >= 70) svg += `<text x="${(X(a) + X(b)) / 2}" y="${T - 12}" fill="#e5e7eb" font-size="12" font-weight="700" text-anchor="middle">${tg(t0 + 432e5)}</text>`; }
  if (ende >= jetzt - 6e4) svg += `<line x1="${X(jetzt)}" x2="${X(jetzt)}" y1="${T - 4}" y2="${y2}" stroke="#9ca3af" stroke-dasharray="4 4"/>`;
  svgEl.innerHTML = svg;
  // 14-Tage-Leiste unter dem Feld: antippen/ziehen = Fenster dorthin (29.09.2026)
  const u = $(id + "_ueb");
  if (u) {
    const UW = Math.max(Math.round(u.getBoundingClientRect().width) || 1000, 300), UH = 6 + Q.length * 6;
    u.setAttribute("viewBox", `0 0 ${UW} ${UH + 18}`);
    const u0 = jetzt - 14 * 864e5, UX = (tt) => 8 + (tt - u0) / (jetzt - u0) * (UW - 16);
    let g = `<rect x="8" y="2" width="${UW - 16}" height="${UH}" fill="#27272a" rx="3"/>`;
    Q.forEach(([, codes, farben], i) => codes.forEach((c, k) => { for (const [a, b] of zlSeg[c] || []) { if (b < u0) continue;
      g += `<rect x="${UX(Math.max(a, u0))}" y="${5 + i * 6}" width="${Math.max(UX(b) - UX(Math.max(a, u0)), 1)}" height="4" fill="${farben[k]}"/>`; } }));
    for (let v = new Date(u0).setHours(24, 0, 0, 0); v < jetzt; v += 864e5) { const dt = new Date(v);
      g += `<line x1="${UX(v)}" x2="${UX(v)}" y1="2" y2="${UH + 2}" stroke="#52525b"/>`;
      if (!schmal || dt.getDate() % 2 === 0) g += `<text x="${UX(v + 432e5)}" y="${UH + 15}" fill="#9ca3af" font-size="10" text-anchor="middle">${dt.getDate()}.${dt.getMonth() + 1}.</text>`; }
    g += `<rect x="${UX(x0)}" y="1" width="${UX(ende) - UX(x0)}" height="${UH + 2}" fill="#e5e7eb" fill-opacity="0.12" stroke="#e5e7eb" stroke-width="1.5" rx="3"/>`;
    u.innerHTML = g;
    if (!u.__zl) { u.__zl = true; let zieht = false;
      const setze = (ev) => { const r = u.getBoundingClientRect(), j2 = Date.now(), v0 = j2 - 14 * 864e5, tt = v0 + (ev.clientX - r.left - 8) / (r.width - 16) * (j2 - v0);
        const erst = Math.min(...Object.values(zlSeg).flat().map((s) => s[0]), j2);
        const e2 = Math.min(Math.max(tt + 24 * 36e5, j2 - 13 * 864e5, erst + 48 * 36e5), j2); zlEnde[id] = e2 >= j2 - 30 * 6e4 ? null : e2;
        const b = $(id + "_jetzt"); if (b) b.hidden = zlEnde[id] === null; zeichneZL(id); };
      u.addEventListener("pointerdown", (ev) => { zieht = true; u.setPointerCapture(ev.pointerId); setze(ev); });
      u.addEventListener("pointermove", (ev) => { if (zieht) setze(ev); });
      u.addEventListener("pointerup", () => { zieht = false; }); u.addEventListener("pointercancel", () => { zieht = false; }); }
  }
  // Ziehen/Wischen im Feld verschiebt das Fenster (29.09.2026), begrenzt auf Datenbeginn und jetzt
  if (!svgEl.__zl) {
    svgEl.__zl = true; svgEl.style.touchAction = "pan-y"; svgEl.style.cursor = "grab"; let dr = null;
    svgEl.addEventListener("pointerdown", (ev) => { dr = { x: ev.clientX, ende: zlEnde[id] ?? Date.now(), moved: false }; svgEl.setPointerCapture(ev.pointerId); });
    svgEl.addEventListener("pointermove", (ev) => { if (!dr) return; const dx = ev.clientX - dr.x; if (Math.abs(dx) > 5) dr.moved = true; if (!dr.moved) return;
      const breite = svgEl.getBoundingClientRect().width - 16, jetzt2 = Date.now();
      const erst = Math.min(...Object.values(zlSeg).flat().map((s) => s[0]), jetzt2);
      const e2 = Math.min(Math.max(dr.ende - dx / breite * 48 * 36e5, erst + 48 * 36e5, jetzt2 - 14 * 864e5), jetzt2);
      zlEnde[id] = e2 >= jetzt2 - 6e4 ? null : e2; const b = $(id + "_jetzt"); if (b) b.hidden = zlEnde[id] === null;
      if (!svgEl.__raf) svgEl.__raf = requestAnimationFrame(() => { svgEl.__raf = null; zeichneZL(id); }); });
    const aus = () => { dr = null; };
    svgEl.addEventListener("pointerup", aus); svgEl.addEventListener("pointercancel", aus);
    svgEl.addEventListener("dblclick", () => { zlEnde[id] = null; const b = $(id + "_jetzt"); if (b) b.hidden = true; zeichneZL(id); });
    const b = $(id + "_jetzt"); if (b) b.addEventListener("click", () => { zlEnde[id] = null; b.hidden = true; zeichneZL(id); });
  }
}


// ---------- PV-Prognose (VRM) + Ist, vorgestern bis übermorgen ----------
function zeigePrognose(d) {
  const pr = d.pr || [], pi = d.pi || [], pz = d.pz || {};
  const f = (v, n = 1) => (v === undefined || v === null || isNaN(parseFloat(v))) ? "–" : zahl(parseFloat(v), n);
  // Tabelle + Hinweis
  const m = parseFloat(pz.morgen), rest = parseFloat(pz.rest);
  let spitze = "mittags";
  if (pz.spitze_morgen && !isNaN(Date.parse(pz.spitze_morgen)))
    spitze = new Date(pz.spitze_morgen).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr";
  let hinweis = "⛅ Morgen mittelmäßig – große Verbraucher in die Mittagsstunden legen.";
  if (m >= 18) hinweis = `☀️ <b>Morgen sonnig</b> – Wäsche, Trockner & Spülmaschine am besten mittags (Spitze ${spitze}).`;
  else if (m < 8) hinweis = `☁️ <b>Morgen wenig Sonne</b> – große Verbraucher lieber heute laufen lassen${rest >= 5 ? " (heute noch " + f(rest) + " kWh)" : ""}.`;
  $("progtext").innerHTML = `<table class="tab"><tr><th></th><th>PV erwartet</th><th>davon noch</th><th>bisher</th><th>Verbrauch ≈</th></tr>`
    + `<tr><td><b>Heute</b></td><td><b>${f(pz.heute)} kWh</b></td><td>${f(pz.rest)}</td><td>${f(pz.ist)}</td><td>${f(pz.vb_heute, 0)}</td></tr>`
    + `<tr><td><b>Morgen</b></td><td><b>${f(pz.morgen)} kWh</b></td><td></td><td></td><td>${f(pz.vb_morgen, 0)}</td></tr></table>`
    + `<p class="hinweis">${hinweis}</p>`;
  // Kurve
  const W = 1000, H = 330, L = 44, R = 956, T = 12, B = 290;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0); const x0 = t0.getTime() - 2 * 864e5, x1 = x0 + 5 * 864e5;
  const X = (t) => L + (t - x0) / (x1 - x0) * (R - L);
  const halb = 18e5;
  const fp = pr.filter((p) => p[0] + halb >= x0 && p[0] + halb <= x1);
  const ip = pi.filter((p) => p[0] + halb >= x0 && p[0] + halb <= x1);
  let max = 1;
  fp.forEach((p) => { max = Math.max(max, p[1] / 1000, p[2] / 1000); });
  ip.forEach((p) => { max = Math.max(max, p[1], p[2]); });
  max = Math.ceil(max);
  const Y = (v) => B - v / max * (B - T), Ys = (v) => B - v / 100 * (B - T);
  const linie = (pts) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");
  let svg = "";
  for (let i = 0; i <= max; i += (max > 6 ? 2 : 1))
    svg += `<line x1="${L}" x2="${R}" y1="${Y(i)}" y2="${Y(i)}" stroke="#374151" stroke-dasharray="3 4"/>`
      + `<text x="${L - 6}" y="${Y(i) + 4}" fill="#9ca3af" font-size="12" text-anchor="end">${i}</text>`;
  for (let v = 0; v <= 100; v += 20)
    svg += `<text x="${R + 6}" y="${Ys(v) + 4}" fill="#9ca3af" font-size="12">${v}</text>`;
  svg += `<text x="${L - 6}" y="${T - 2}" fill="#9ca3af" font-size="11" text-anchor="end">kW</text>`
    + `<text x="${R + 6}" y="${T - 2}" fill="#9ca3af" font-size="11">%</text>`;
  const tage = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  for (let i = 0; i <= 5; i++) {
    const t = x0 + i * 864e5, dt = new Date(t);
    svg += `<line x1="${X(t)}" x2="${X(t)}" y1="${T}" y2="${B}" stroke="#4b5563"/>`;
    if (i < 5) svg += `<text x="${X(t + 432e5)}" y="${B + 22}" fill="#9ca3af" font-size="13" text-anchor="middle">${tage[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}.</text>`;
  }
  const flaeche = (idx, farbe, deck) => {
    if (!ip.length) return "";
    const pts = ip.map((p) => [X(p[0] + halb), Y(p[idx])]);
    return `<path d="${linie(pts)}L${pts[pts.length - 1][0]},${B}L${pts[0][0]},${B}Z" fill="${farbe}" fill-opacity="${deck}"/>`
      + `<path d="${linie(pts)}" fill="none" stroke="${farbe}" stroke-width="2"/>`;
  };
  svg += flaeche(2, "#ef4444", 0.25) + flaeche(1, "#f59e0b", 0.35);
  if (fp.length) {
    // Verbrauch: Victron (VRM) rot gestrichelt; eigene Prognose grün gestrichelt – Vergangenheit aus dem Archiv d.va
    // (Stand Vorabend 23:08), ab der laufenden Stunde aktuell d.ve (29.09.2026)
    svg += `<path d="${linie(fp.map((p) => [X(p[0] + halb), Y(p[2] / 1000)]))}" fill="none" stroke="#f87171" stroke-width="2" stroke-dasharray="7 5"/>`;
    { const h0 = Math.floor(Date.now() / 36e5) * 36e5, em = new Map();
      (d.va || []).forEach((p) => { if (p[0] < h0) em.set(p[0], p[1]); });
      (d.ve || []).forEach((p) => { if (p[0] >= h0) em.set(p[0], p[1]); });
      const ep = [...em.entries()].sort((a, b) => a[0] - b[0]).filter((p) => p[0] + halb >= x0 && p[0] + halb <= x1);
      if (ep.length > 1) svg += `<path d="${linie(ep.map((p) => [X(p[0] + halb), Y(p[1] / 1000)]))}" fill="none" stroke="#22c55e" stroke-width="2" stroke-dasharray="7 5"/>`; }
    svg += `<path d="${linie(fp.map((p) => [X(p[0] + halb), Y(p[1] / 1000)]))}" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="7 5"/>`;
  }
  if (ip.length) svg += `<path d="${linie(ip.map((p) => [X(p[0] + halb), Ys(p[3])]))}" fill="none" stroke="#3b82f6" stroke-width="2.5"/>`;
  // Akku-Prognose (29.09.2026, wie im Dashboard): PV-Prognose (heute mit Tageskorrektur) − eigene Verbrauchsprognose d.ve
  // (sonst VRM), 30 kWh, Wirkungsgrad 0,95 je Richtung, Reserve live; gestrichelt hellblau
  {
    const s = d.s || {}, soc = num(s, "sensor.venus_dc_batterie_ladestand"), res = num(s, "sensor.venus_aktiver_soc_grenzwert") ?? 50;
    const pvm = new Map(pr.map((p) => [p[0], p[1]])), ve = d.ve || [], vbm = new Map(ve.length >= 24 ? ve : pr.map((p) => [p[0], p[2]]));
    if (soc !== null) {
      const cap = 30, eta = 0.95, emin = res / 100 * cap, jn = Date.now(), h0 = Math.floor(jn / 36e5) * 36e5, tt0 = new Date(); tt0.setHours(0, 0, 0, 0);
      let prog = 0; for (const [t, w] of pvm) if (t >= tt0.getTime() && t < h0) prog += w || 0; prog += (pvm.get(h0) || 0) * ((jn - h0) / 36e5);
      const ist = Math.max(num(s, "sensor.pv_ertrag_heute") ?? 0, num(s, "sensor.pv_ertrag_tag_max") ?? 0);
      const k = prog >= 2000 ? Math.min(Math.max(ist * 1000 / prog, 0.5), 1.3) : 1, morgen = tt0.getTime() + 864e5;
      let e = soc / 100 * cap; const pts = [[X(jn), Ys(soc)]];
      for (let i = 0; i < 96; i++) { const ms = h0 + i * 36e5, l = i === 0 ? (h0 + 36e5 - jn) / 36e5 : 1; if (!vbm.has(ms) || ms + 36e5 > x1) break;
        const dd = ((pvm.get(ms) || 0) * (ms < morgen ? k : 1) - (vbm.get(ms) || 0)) / 1000 * l;
        e = dd >= 0 ? Math.min(e + dd * eta, cap) : Math.max(e + dd / eta, emin); pts.push([X(ms + 36e5), Ys(e / cap * 100)]); }
      if (pts.length > 1) svg += `<path d="${linie(pts)}" fill="none" stroke="#93c5fd" stroke-width="2.2" stroke-dasharray="7 5"/>`;
    }
  }
  const jetzt = Date.now();
  if (jetzt > x0 && jetzt < x1) svg += `<line x1="${X(jetzt)}" x2="${X(jetzt)}" y1="${T}" y2="${B}" stroke="#9ca3af" stroke-dasharray="4 4"/>`;
  $("progkurve").innerHTML = svg;
}

// ---------- Temperaturen innen/außen + Vorhersage, vorgestern bis übermorgen ----------
function zeigeTemperaturen(d) {
  const pi = (d.pi || []).filter((p) => p.length >= 6), wt = d.wt || [];
  const L = 44, R = 956, T = 26, B = 260;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0); const x0 = t0.getTime() - 2 * 864e5, x1 = x0 + 5 * 864e5;
  const X = (t) => L + (t - x0) / (x1 - x0) * (R - L), halb = 18e5;
  const ip = pi.filter((p) => p[0] + halb >= x0 && p[0] + halb <= x1);
  const jetzt = Date.now();
  const fp = wt.filter((p) => p[0] >= jetzt - 36e5 && p[0] <= x1);
  const werte = ip.flatMap((p) => [p[4], p[5]]).concat(fp.map((p) => p[1])).filter((v) => typeof v === "number");
  if (!werte.length) { $("tempkurve").innerHTML = ""; return; }
  const lo = Math.min(0, Math.floor(Math.min(...werte) / 5) * 5), hi = Math.max(30, Math.ceil(Math.max(...werte) / 5) * 5);   // ab 0 °C (29.09.2026)
  const Y = (v) => B - (v - lo) / (hi - lo || 1) * (B - T);
  const linie = (pts) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");
  let svg = "";
  for (let v = lo; v <= hi; v += 5)
    svg += `<line x1="${L}" x2="${R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#374151" stroke-dasharray="3 4"/>`
      + `<text x="${L - 6}" y="${Y(v) + 4}" fill="#9ca3af" font-size="12" text-anchor="end">${v}</text>`;
  svg += `<text x="${L - 6}" y="${T - 12}" fill="#9ca3af" font-size="11" text-anchor="end">°C</text>`;
  const tage = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  for (let i = 0; i <= 5; i++) {
    const t = x0 + i * 864e5, dt = new Date(t);
    svg += `<line x1="${X(t)}" x2="${X(t)}" y1="${T}" y2="${B}" stroke="#4b5563"/>`;
    if (i < 5) svg += `<text x="${X(t + 432e5)}" y="${B + 22}" fill="#9ca3af" font-size="13" text-anchor="middle">${tage[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}.</text>`;
  }
  if (ip.length) {
    const au = ip.map((p) => [X(p[0] + halb), Y(p[4])]);
    svg += `<path d="${linie(au)}L${au[au.length - 1][0]},${B}L${au[0][0]},${B}Z" fill="#3b82f6" fill-opacity="0.2"/>`
      + `<path d="${linie(au)}" fill="none" stroke="#3b82f6" stroke-width="2.2"/>`;
  }
  if (fp.length) svg += `<path d="${linie(fp.map((p) => [X(p[0]), Y(p[1])]))}" fill="none" stroke="#93c5fd" stroke-width="2.2" stroke-dasharray="7 5"/>`;
  if (ip.length) svg += `<path d="${linie(ip.map((p) => [X(p[0] + halb), Y(p[5])]))}" fill="none" stroke="#ef4444" stroke-width="2.5"/>`;
  if (jetzt > x0 && jetzt < x1) svg += `<line x1="${X(jetzt)}" x2="${X(jetzt)}" y1="${T}" y2="${B}" stroke="#9ca3af" stroke-dasharray="4 4"/>`;
  if (lo < 0) svg += `<line x1="${L}" x2="${R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#d4d4d8" stroke-width="1.5"/>`;
  // aktueller Außenwert (OAT) als Punkt am Ende der Außen-Kurve
  const oat = num(d.s || {}, "sensor.cmi_t_aussen");
  if (oat !== null && jetzt > x0 && jetzt < x1) { const ax = X(jetzt), ay = Y(oat);
    if (ip.length) { const l = ip[ip.length - 1]; svg += `<line x1="${X(l[0] + halb)}" y1="${Y(l[4])}" x2="${ax}" y2="${ay}" stroke="#3b82f6" stroke-width="2.2"/>`; }
    svg += `<circle cx="${ax}" cy="${ay}" r="19" fill="#3b82f6" stroke="#fff" stroke-width="2"/><text x="${ax}" y="${ay + 4}" fill="#fff" font-size="11.5" font-weight="700" text-anchor="middle">${zahl(oat, 1)}°</text>`; }
  $("tempkurve").innerHTML = svg;
}

// ---------- Laden ----------
async function holen() {
  try {
    const r = await fetch(DATEN + "?t=" + Date.now(), { cache: "no-store" });
    const d = await r.json();
    const s = d.s || {}, a = d.a || {};
    zeigeSchema(s); zeigeFluss(s); zeigeBatterie(s, d.ap); zeigeKlima(s, a); zeigeWasser(s); zeigeTabellen(s, d.k || {}, d.lp || {});
    zeigeTage(s, d.k || {}, d.h); zeigePV(s); zeigePrognose(d); zeigeTemperaturen(d); zeigeZeitleiste(d); zeigeWann(d); zeigeWasserGrafik(d);
    const t = new Date(d.t), alt = (Date.now() - t) / 60000;
    $("stand").textContent = "Stand " + t.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
      + (alt > 5 ? " · Daten veraltet" : "");
    $("stand").classList.toggle("alt", alt > 5);
  } catch (e) {
    $("stand").textContent = "Keine Verbindung – neuer Versuch läuft";
    $("stand").classList.add("alt");
  }
}

(async () => {
  [slots, overlays] = await Promise.all([fetch("slots.json").then((r) => r.json()), fetch("overlays.json").then((r) => r.json())]);
  baueSchema();
  holen();
  setInterval(holen, TAKT_MS);
})();

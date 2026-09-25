// Nur-Lese-Anzeige der HA-Übersicht. Daten: geheimer Gist, von HA jede Minute aktualisiert.
const DATEN = "https://gist.githubusercontent.com/RoyalTarget/f9832b91288808b13a203ac1635b6232/raw/data.json";
const TAKT_MS = 30000;

let slots = [], overlays = [];
const $ = (id) => document.getElementById(id);

// ---------- Formatierung ----------
const zahl = (v, dec) => Number(v).toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const num = (s, e) => { const v = parseFloat(s[e]); return Number.isFinite(v) ? v : null; };
function watt(v) {
  if (v === null) return "–";
  return Math.abs(v) >= 1000 ? zahl(v / 1000, 2) + " kW" : zahl(v, 0) + " W";
}

// ---------- Schema ----------
function baueSchema() {
  const w = $("werte");
  for (const s of slots) {
    if (!s.entity) continue;
    const el = document.createElement("div");
    el.className = "wert " + s.anchor;
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
function zeigeBatterie(s) {
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
function zeigeTabellen(s, k) {
  const kw = (e) => (k[e] == null ? "–" : zahl(k[e], 2));
  const G = [
    ["Wärmepumpe", "sensor.cmi_wp_leistung_elektrisch", "sensor.cmi_wp_energie_heute", "sensor.wp_energie_monat", "–"],
    ["BWWP", "sensor.keller_bwwp_shelly_leistung", "sensor.keller_bwwp_shelly_bwwp_energie_heute", "sensor.bwwp_energie_monat", "L2"],
    ["Entfeuchter", "sensor.keller_entfeuchter_power", "sensor.entfeuchter_energie_heute", "sensor.entfeuchter_energie_monat", "L2"],
    ["Spülmaschine", "sensor.kuche_spulmaschine_shelly_leistung", "sensor.spulmaschine_energie_heute", "sensor.spulmaschine_energie_monat", "L1"],
    ["Waschmaschine", "sensor.keller_miele_waschmaschine_leistung", "sensor.waschmaschine_energie_heute", "sensor.waschmaschine_energie_monat", "–"],
    ["Trockner", "sensor.keller_miele_trockner_leistung", "sensor.trockner_energie_heute", "sensor.trockner_energie_monat", "–"],
    ["Kühlschrank", "sensor.kuche_kuhlschrank_shelly_leistung", "sensor.kuhlschrank_energie_heute", "sensor.kuhlschrank_energie_monat", "L2"],
    ["Kühlschrank Garage", "sensor.garage_kuhlschrank_shelly_leistung", "sensor.kuhlschrank_garage_energie_heute", "sensor.kuhlschrank_garage_energie_monat", "–"],
    ["Klima Wintergarten ≈", "sensor.klima_wintergarten_leistung_geschatzt", "sensor.klima_wintergarten_heute", "sensor.klima_wintergarten_monat", "L2"],
    ["Klima Emil ≈", "sensor.klima_emil_leistung_geschatzt", "sensor.klima_emil_heute", "sensor.klima_emil_monat", "L2"],
    ["Klima Dachspitz ≈", "sensor.klima_dachspitz_leistung_geschatzt", "sensor.klima_dachspitz_heute", "sensor.klima_dachspitz_monat", "L2"],
    ["Nerdaxe", "sensor.smart_switch_23022384462303510d0248e1e9bb5091_power", "sensor.nerdaxe_energie_heute", "sensor.nerdaxe_energie_monat", "L2"],
    ["Iceriver", "sensor.keller_iceriver_miner_power", "sensor.iceriver_energie_heute", "sensor.iceriver_energie_monat", "–"],
  ];
  const w0 = (e) => { const v = num(s, e); return v === null ? "–" : zahl(v, 0) + " W"; };
  $("gross").innerHTML = "<tr><th></th><th>jetzt</th><th>heute</th><th>Monat</th><th>Phase</th></tr>"
    + G.map(([n, p, h, m, ph]) => `<tr><td>${n}</td><td>${w0(p)}</td><td>${kw(h)}</td><td>${kw(m)}</td><td>${ph}</td></tr>`).join("")
    + `<tr><td>Rest (ungemessen)</td><td>${w0("sensor.rest_ungemessen")}</td><td></td><td></td><td></td></tr>`
    + `<tr class="summe"><td>Haus gesamt</td><td>${w0("sensor.hausverbrauch")}</td><td></td><td></td><td></td></tr>`;

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

// ---------- Laden ----------
async function holen() {
  try {
    const r = await fetch(DATEN + "?t=" + Date.now(), { cache: "no-store" });
    const d = await r.json();
    const s = d.s || {}, a = d.a || {};
    $("sonne").hidden = s["binary_sensor.pv_uberschuss"] !== "on";
    zeigeSchema(s); zeigeFluss(s); zeigeBatterie(s); zeigeKlima(s, a); zeigeWasser(s); zeigeTabellen(s, d.k || {});
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

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
    img.src = "img/" + ov.img + "?v=50";   // Cache-Kennung der Schema-Grafiken (wie ?vN im Dashboard, 30.09.2026)
    img.alt = "";
    img.hidden = true;
    img.id = "ov_" + i;
    o.appendChild(img);
  });
  // Schaltkriterien (30.09.2026): unsichtbare Zonen über den Geräten, Text per Mouse-over/Antippen (data-tip, Payload sk)
  const Y0 = 62, SW = 1200, SH = 658;
  for (const [k, x0, y0, x1, y1] of [["wp", 40, 80, 200, 200], ["puffer", 290, 128, 402, 402], ["hk", 718, 338, 802, 462],
      ["bwwp", 898, 488, 1012, 702], ["entf", 288, 606, 442, 702], ["zirk", 1030, 595, 1060, 625]]) {
    const z = document.createElement("div"); z.className = "sk-zone"; z.id = "sk_" + k;
    Object.assign(z.style, { left: x0 / SW * 100 + "%", top: (y0 - Y0) / SH * 100 + "%", width: (x1 - x0) / SW * 100 + "%", height: (y1 - y0) / SH * 100 + "%" });
    w.appendChild(z); }
}

function bedingung(c, s) {
  if (c.length === 2) return s[c[0]] === c[1];
  const v = num(s, c[0]);
  if (v === null) return false;
  if (c[1] !== null && !(v > c[1])) return false;
  if (c[2] !== null && !(v < c[2])) return false;
  return true;
}

function zeigeSchema(s, sk) {
  for (const sl of slots) {
    if (!sl.entity) continue;
    let v = num(s, sl.entity), unit = sl.unit, dec = sl.dec;
    // elektrische WP-Leistung kommt in W
    if (sl.entity === "sensor.wp_leistung_elektrisch_gesamt") { unit = "W"; dec = 0; }
    const txt = v === null ? "—" : zahl(v, dec) + (unit ? " " + unit : "");
    $("slot_" + sl.id).textContent = (sl.prefix || "") + txt;
  }
  overlays.forEach((ov, i) => { $("ov_" + i).hidden = !ov.conds.every((c) => bedingung(c, s)); });
  for (const [k, t] of Object.entries(sk || {})) { const z = $("sk_" + k); if (z && t) z.setAttribute("data-tip", escH(t).replace(/\n/g, "<br>")); }
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

  const geraete = [["Wärmepumpe", "sensor.wp_leistung_elektrisch_gesamt"], ["BWWP", "sensor.keller_bwwp_shelly_leistung"],
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
}

// ---------- Stadtwerke-Zähler (06.10.2026, Nostalgie) ----------
// Gleiche Karte wie im Dashboard (lib/vgs_zaehler.js), hass-Ersatz aus data.json (s); Ablesung (input_number) fehlt hier → ohne „seit Ablesung“.
function zeigeZaehler(s) {
  if (!customElements.get("vgs-zaehler-card")) return;
  const st = {}; for (const [e, x] of Object.entries(s)) st[e] = { state: String(x), attributes: {} };
  for (const [id, art] of [["zaehler_strom", "strom"], ["zaehler_wasser", "wasser"]]) {
    const el = $(id); if (!el) continue;
    if (!el._cfg) { el.setConfig({ art }); el._cfg = true; }
    el.hass = { states: st };
  }
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
  $("wasser").innerHTML = k("Heute", hv === null ? "–" : zahl(hv, 0) + " L")
    + (alarm === "no_alarm" ? k("Alarm", "Kein Alarm", "var(--gruen)") : k("Alarm", alarm ?? "–", "var(--vl)"))
    + k("Ventil", ventil);
}

// ---------- Großverbraucher & PV je Fläche ----------
function gvModus() { try { return localStorage.getItem("gv_modus") === "ohne" ? "ohne" : "echt"; } catch (e) { return "echt"; } }
function zeigeTabellen(s, k, lp, gh) {
  window.__gvArgs = [s, k, lp, gh];
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
      ["Iceriver", "sensor.keller_iceriver_miner_power", "sensor.iceriver_energie_heute", "sensor.iceriver_energie_monat", "2026-09-24T02:30"],
      ["TV Sony", "sensor.tv_sony_power", "sensor.tv_sony_energie_heute", "sensor.tv_sony_energie_monat", "2026-09-29T22:44"]]]];
  const kv = (e) => (k[e] === undefined ? null : k[e]);
  // „echt bezahlt“ / „ohne PV“ (01.10.2026, wie im Dashboard): € je Gerät = kWh × Preis × Netzanteil des Geräts (Payload gh aus
  // sensor.geraete_herkunft: {h|m: {Leistungs-Entität: [kWh, davon Netz]}}); Ø/Jahr in den ersten 7 Monatstagen mit dem Ø-Netzanteil des Hauses
  const echt = gvModus() === "echt", GH = (gh && gh.h) || {}, GM = (gh && gh.m) || {};
  const hp = num(s, "sensor.hausverbrauch"), hh = kv("sensor.hausverbrauch_heute"), hm = kv("sensor.hausverbrauch_monat");
  const haStart = "2026-09-22T15:00", ha = avg(hm, lp["sensor.hausverbrauch_monat"] || 0, haStart);
  const np = Math.max(num(s, "sensor.em_540_netzmessgeraet_leistung") ?? 0, 0);
  const nh = Math.max((num(s, "sensor.em_540_netzmessgeraet_verbrauch") ?? 0) - (num(s, "input_number.em540_bezug_mitternacht") ?? 0), 0);
  const nm = kv("sensor.netzbezug_monat"), na = avg(nm, lp["sensor.netzbezug_monat"] || 0, haStart);
  const fh = hh > 0.05 ? Math.min(nh / hh, 1) : 0.5, fm = hm > 0.05 && nm !== null ? Math.min(nm / hm, 1) : 0.5, fa = ha > 0.05 && na !== null ? Math.min(na / ha, 1) : 0.5;
  const mTage = (jetztMs - ms.getTime()) / 864e5;
  const ant = (dd, key, fb) => { const x = dd[key]; return x && x[0] > 0.005 ? x[1] / x[0] : fb; };
  const anteile = (key) => echt ? [ant(GH, key, fh), ant(GM, key, fm), mTage >= 7 ? ant(GM, key, fm) : fa] : [1, 1, 1];
  const w0 = (v) => (v === null ? "–" : zahl(v, 0) + " W");
  const eur = (v) => zahl(v, 2) + " €";
  const zelle = (v, n = 2, e) => v === null ? "–" : `${zahl(v, n)}<span class="eur">${eur(e ?? v * preis)}</span>`;
  const jahr = (a, e) => a === null ? "–" : `${zahl(a * 365, 0)}<span class="eur">${zahl((e ?? a * preis) * 365, 0)} €</span>`;
  const zeile = (cls, n, p, h, m, av, eh, em, ea) => `<tr class="${cls}"><td>${n}</td><td>${w0(p)}</td><td>${zelle(h, 2, eh)}</td><td>${zelle(m, 2, em)}</td><td>${zelle(av, 2, ea)}</td><td>${jahr(av, ea)}</td></tr>`;
  let html = "<tr><th></th><th>jetzt</th><th>heute</th><th>Monat</th><th>Ø/Tag</th><th>Jahr ≈</th></tr>";
  let sp = 0, sh = 0, sa = 0; const gruppen = [];
  for (const [gn, items] of G) {
    let gp = 0, gh = 0, gm = 0, ga = 0, geh = 0, gem = 0, gea = 0, zeilen = "";
    for (const [n, p, h, m, st, cls] of items) {
      let mv, l;
      if (m === "verdichter") { const b = kv("sensor.bwwp_energie_monat"), z = kv("sensor.bwwp_heizstab_energie_monat");
        mv = b === null || z === null ? null : Math.max(b - z, 0); l = (lp["sensor.bwwp_energie_monat"] || 0) - (lp["sensor.bwwp_heizstab_energie_monat"] || 0);
      } else { mv = kv(m); l = lp[m] || 0; }
      const pv = num(s, p), hv = kv(h), av = avg(mv, l, st), [ah, am, aa] = anteile(p);
      const eh = (hv ?? 0) * preis * ah, em = (mv ?? 0) * preis * am, ea = (av ?? 0) * preis * aa;
      if (!cls) { gp += pv ?? 0; gh += hv ?? 0; gm += mv ?? 0; ga += av ?? 0; geh += eh; gem += em; gea += ea; }
      zeilen += zeile((cls || "") + (cls && cls.includes("hz") && s["binary_sensor.bwwp_heizstab"] === "on" ? " an" : ""), n, pv, hv, mv, av, eh, em, ea);
    }
    gruppen.push([gn, gp, gh, gm, ga, zeilen, geh, gem, gea]); sp += gp; sh += gh; sa += ga;
  }
  const ra = ha === null ? null : Math.max(ha - sa, 0), rh = hh === null ? null : Math.max(hh - sh, 0);
  const rm = ra === null ? null : ra * (jetztMs - Math.max(ms.getTime(), new Date(haStart).getTime())) / 864e5;
  const rp = num(s, "sensor.rest_ungemessen"), [rah, ram, raa] = anteile("sensor.rest_ungemessen");
  const reh = (rh ?? 0) * preis * rah, rem = (rm ?? 0) * preis * ram, rea = (ra ?? 0) * preis * raa;
  for (const [gn, gp, gh, gm, ga, zeilen, geh, gem, gea] of gruppen) {
    const x = gn.includes("Sonstiges");
    html += zeile("gruppe", gn, gp + (x ? rp ?? 0 : 0), gh + (x ? rh ?? 0 : 0), gm + (x ? rm ?? 0 : 0), ga + (x ? ra ?? 0 : 0), geh + (x ? reh : 0), gem + (x ? rem : 0), gea + (x ? rea : 0)) + zeilen
      + (x ? zeile("", "Rest (ungemessen)", rp, rh, rm, ra, reh, rem, rea) : "");
  }
  // Bilanz (01.10.2026): Haus gesamt (Wert ohne PV) − davon aus PV/Akku = aus dem Netz bezogen (echte Kosten)
  // 09.10.2026: + Victron-Anlage aus dem Netz (Netzbezug über dem Hausverbrauch, haus_herkunft.yaml, ab 01.10.) → Bilanz geht auf;
  // PV/Akku = Haus + Victron − Netz, nie negativ (Rundungsrest EM540 0,1 kWh trägt die Victron-Zeile) – wie im Dashboard
  const neg = (v) => (v === null ? null : -v);
  const vp = hp === null ? null : Math.max(np - hp, 0);
  const vh0 = kv("sensor.netz_an_victron_heute") ?? 0, vm0 = kv("sensor.netz_an_victron_monat") ?? 0, va0 = avg(vm0, 0, "2026-10-01T00:00") ?? 0;
  const gg = (h, v, n) => (h === null || n === null ? null : Math.max(h + v - n, 0));
  const gh2 = gg(hh, vh0, nh), gm2 = gg(hm, vm0, nm), ga2 = gg(ha, va0, na);
  const vv = (h, n, g2, v) => (g2 === null ? v : n - h + g2);
  html += zeile("haus", "Haus gesamt verbraucht<span class=\"eur\">€ = Wert, wenn alles aus dem Netz käme</span>", hp, hh, hm, ha)
    + zeile("victron", "+ Victron-Anlage aus dem Netz<span class=\"eur\">Eigenverbrauch Wechselrichter, Akku nachladen</span>", vp,
      vv(hh, nh, gh2, vh0), vv(hm, nm, gm2, vm0), vv(ha, na, ga2, va0))
    + zeile("pvabzug", "− davon aus PV/Akku<span class=\"eur\">gratis = gespart</span>", hp === null ? null : Math.max(hp + (vp ?? 0) - np, 0),
      neg(gh2), neg(gm2), neg(ga2))
    + zeile("netz", "= aus dem Netz bezogen<span class=\"eur\">das wird bezahlt</span>", np, nh, nm, na);
  $("gross").innerHTML = html;
  $("gross_fuss").innerHTML = (echt ? `kWh · € = echt bezahlt: nur der Anteil, der beim Lauf aus dem Netz kam (minütlich je Gerät, Akku zählt als PV; ab 01.10.2026 gemessen; Ø/Tag und Jahr in den ersten 7 Monatstagen mit dem Ø-Netzanteil des Hauses = ${zahl(fa * 100, 0)} %), × ${zahl(preis * 100, 2)} ct`
      : `kWh · € = ohne PV: kWh × ${zahl(preis * 100, 2)} ct je Gerät, als käme alles aus dem Netz`)
    + ` · Bilanz unten: Haus gesamt + Victron-Anlage (Netzbezug über dem Hausverbrauch: Wechselrichter-Eigenverbrauch, Akku-Nachladen; ab 01.10.2026) − PV/Akku = aus dem Netz · Ø/Tag nur über Tage mit Messung · Jahr ≈ = Ø/Tag × 365 – Heizen ist saisonal · ≈ geschätzt`;
  const um = $("gv_um");
  if (um && !um.__an) { um.__an = true;
    um.addEventListener("click", (ev) => { const b = ev.target.closest("button"); if (!b) return;
      try { localStorage.setItem("gv_modus", b.dataset.m); } catch (e) {}
      um.querySelectorAll("button").forEach((x) => x.classList.toggle("an", x === b)); if (window.__gvArgs) zeigeTabellen(...window.__gvArgs); }); }
  if (um) um.querySelectorAll("button").forEach((x) => x.classList.toggle("an", x.dataset.m === gvModus()));

  }
  const kw = (e) => (k[e] == null ? "–" : zahl(k[e], 2));
  const w0 = (e) => { const v = num(s, e); return v === null ? "–" : zahl(v, 0) + " W"; };
  const F = [
    ["Dach Ost", "RS 450 #2", "sensor.mppt2_leistung_pv_tracker_2_dach_ost", "sensor.mppt2_ertrag_tracker_2_dach_ost_heute", "sensor.mppt2_maximalleistung_tracker_2_dach_ost_heute"],
    ["Dach West", "RS 450 #5", "sensor.mppt2_leistung_pv_tracker_5_dach_west", "sensor.mppt2_ertrag_tracker_5_dach_west_heute", "sensor.mppt2_maximalleistung_tracker_5_dach_west_heute"],
    ["Fassade Süd oben", "RS 450 #3", "sensor.mppt2_leistung_pv_tracker_3_sued_oben", "sensor.mppt2_ertrag_tracker_3_sued_oben_heute", "sensor.mppt2_maximalleistung_tracker_3_sued_oben_heute"],
    ["Fassade Süd unten", "RS 450 #4", "sensor.mppt2_leistung_pv_tracker_4_sued_unten", "sensor.mppt2_ertrag_tracker_4_sued_unten_heute", "sensor.mppt2_maximalleistung_tracker_4_sued_unten_heute"],
    ["Gaube Ost", "MPPT1 250/70", "sensor.mppt1_gaube_ost_leistung_pv_ertrag", "sensor.mppt1_gaube_ost_ertrag_heute", "sensor.mppt1_gaube_ost_maximalleistung_heute"],
    ["Gaube West", "MPPT3 250/70", "sensor.mppt3_gaube_west_leistung_pv_ertrag", "sensor.mppt3_gaube_west_ertrag_heute", "sensor.mppt3_gaube_west_maximalleistung_heute"],
    ["Balkonkraftwerk", "EM111, Windfang West", "sensor.em111_bkw_gesamtleistung", "sensor.pv_balkonkraftwerk_heute", null],
  ];
  const sw = F.reduce((a, f) => a + (num(s, f[2]) ?? 0), 0);
  const sh = F.reduce((a, f) => a + (k[f[3]] ?? 0), 0);
  if ($("pvflaeche")) $("pvflaeche").innerHTML = "<tr><th>Fläche</th><th>jetzt</th><th>heute kWh</th><th>max heute</th></tr>"
    + F.map(([n, m, p, h, mx]) => `<tr><td>${n} <span class="klein">${m}</span></td><td>${w0(p)}</td><td>${kw(h)}</td><td>${mx ? w0(mx) : "–"}</td></tr>`).join("")
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
  // blätterbar (30.09.2026): Standard die letzten 10 (Handy 7) Tage, Leiste darunter über alle Tage (bis 35), Griffe = zoomen
  window.__tageArgs = [s, k, h];
  const alle = tagesListe(s, k, h), N = alle.length, STD = Math.min(window.innerWidth < 600 ? 7 : 10, N), tw = window.__tageWin || { std: true };
  const nT = tw.std ? STD : Math.min(Math.max(Math.round(tw.n), 3), N), eT = tw.std ? N : Math.min(Math.max(Math.round(tw.e), nT), N);
  const tage = alle.slice(eT - nT, eT), WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
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
    const d = new Date(t.d + "T12:00:00"), jede = Math.ceil(36 / bw);
    if ((tage.length - 1 - i) % jede === 0) svg += `<text x="${cx}" y="${H - 8}" fill="#9ca3af" font-size="12" text-anchor="middle">${d.getDate()}.${d.getMonth() + 1}.</text>`;
    // Mouse-over je Tag (ganze Spalte)
    svg += `<rect x="${(L + i * bw).toFixed(1)}" y="${O - 70}" width="${bw.toFixed(1)}" height="${ph + 70}" fill="transparent"><title>${WT[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.\n`
      + `WP ${f1(t.teile[0] + t.teile[1])} kWh (PV/Akku ${f1(t.teile[0])} · Netz ${f1(t.teile[1])})\nBWWP ${f1(t.teile[2] + t.teile[3])} kWh (PV/Akku ${f1(t.teile[2])} · Netz ${f1(t.teile[3])})\n`
      + `Gesamt ${f1(t.summe)} kWh · gratis ${f1(t.gratis)} kWh${t.summe > 0 ? " (" + Math.round(t.gratis / t.summe * 100) + " %)" : ""}</title></rect>`;
    if (t.summe > 0 && bw >= 30) {
      const top = y(t.summe), lw = 40;
      svg += `<rect x="${cx - lw / 2}" y="${top - 24}" width="${lw}" height="18" rx="3" fill="#111827" stroke="#e5e7eb"/>`
        + `<text x="${cx}" y="${top - 10.5}" fill="#fff" font-size="13" font-weight="700" text-anchor="middle">${f1(t.summe)}</text>`;
      if (t.gratis >= 0.05) svg += `<text x="${cx}" y="${top - 30}" fill="#22c55e" font-size="13" font-weight="700" text-anchor="middle">${f1(t.gratis)}</text>`;
      svg += `<g>${kreis(cx, top - 56, 13, t.gratis / t.summe)}<title>PV/Akku ${f1(t.gratis)} kWh (${Math.round(t.gratis / t.summe * 100)} %) · Netz ${f1(t.summe - t.gratis)} kWh</title></g>`;
    }
  });
  if ($("tage")) $("tage").innerHTML = svg;   // Tagesbalken ersetzt durch das WP-Fenster (03.10.2026), Kreis bleibt
  if ($("tage")) { let u = $("tage_ueb");
    if (!u) { u = document.createElementNS("http://www.w3.org/2000/svg", "svg"); u.id = "tage_ueb"; u.setAttribute("class", "zeitleiste zl-ueb");
      u.style.cssText = "display:block;width:100%;height:auto;margin-top:4px"; $("tage").after(u);
      doppel($("tage"), () => { window.__tageWin = { std: true }; zeigeTage(...window.__tageArgs); }); }
    const mx = Math.max(1, ...alle.map((t) => t.summe));
    leiste(u, { lo: 0, hi: N, a: eT - nT, b: eT, minw: 3, UH: 24,
      inhalt: (UX, UW, UH) => alle.map((t, i) => { const x = UX(i) + 1, w = Math.max(UX(i + 1) - UX(i) - 2, 1), hg = (UH - 4) * t.summe / mx, hp = t.summe > 0 ? hg * t.gratis / t.summe : 0, dt = new Date(t.d + "T12:00:00");
        return `<rect x="${x}" y="${UH + 1 - hg}" width="${w}" height="${hg - hp}" fill="#ef4444" fill-opacity="0.8"/><rect x="${x}" y="${UH + 1 - hp}" width="${w}" height="${hp}" fill="#22c55e" fill-opacity="0.8"/>`
          + (dt.getDay() === 1 || i === N - 1 ? `<text x="${x + w / 2}" y="${UH + 15}" fill="#9ca3af" font-size="10" text-anchor="middle">${dt.getDate()}.${dt.getMonth() + 1}.</text>` : ""); }).join(""),
      setze: (a, b) => { window.__tageWin = { std: false, n: b - a, e: b }; zeigeTage(...window.__tageArgs); },
      std: () => { window.__tageWin = { std: true }; zeigeTage(...window.__tageArgs); } }); }

  // 30-Tage-Kreis
  if (!$("donut")) return;   // 30-Tage-Kreis ersetzt durch die Torte unter dem WP-Fenster (03.10.2026)
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
  } else if (bez > 150 && akku > 100 && res > 0 && soc <= res + 3) h = kopf("#60a5fa", "🔋 Akku an der Reserve – PV lädt ihn, Haus aus dem Netz",
      `PV ${kw(pv)} kW · +${kw(akku)} kW in den Akku · Netz ${kw(bez)} kW · ${soctxt} – der Victron gibt erst ab ≈ ${zahl(res + 3, 0)} % wieder Strom ans Haus`);
  else if (bez > 150) h = kopf("#f59e0b", "⛅ PV reicht nicht – Rest aus dem Netz", `PV ${kw(pv)} kW · Netz ${kw(bez)} kW · ${soctxt}`);
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
  if (!$("wheute")) return;   // ersetzt durch das Wasser-Fenster (03.10.2026)
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

// ---------- Fenster-Grafiken (03.10.2026, wie Dashboard /local/vgs_fenster.js) ----------
// Fenster über die geladenen Tage (Standard 5 Tage, Handy 2), im Feld ziehen = blättern, Leiste mit Griffen = zoomen,
// Doppeltippen = Standard; Dämmerung + Sonnenband, Mitternacht + Tageskopf (Datum + Wert), Tooltip über kreuz({html}).
// Konfiguration je SVG in FW[id] = {zurueck, vor, std, stdSchmal, hoehe, links, rechts, daten(), kopf(), leiste(), tip()}.
const FW = {};
const fwKey = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const fwNice = (m, n) => { const roh = Math.max(m, 1e-9) / n, p = Math.pow(10, Math.floor(Math.log10(roh))), f = roh / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p * n; };
function fensterZeichnen(id) {
  const c = FW[id], svgEl = $(id); if (!c || !svgEl) return;
  const W = Math.max(Math.round(svgEl.getBoundingClientRect().width) || 1000, 300), schmal = W < 600;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0); const h0 = t0.getTime(), lo = h0 - c.zurueck * 864e5, hi = h0 + (c.vor + 1) * 864e5;
  const sd = schmal ? c.stdSchmal : c.std, std = [h0 + sd[0] * 864e5, h0 + sd[1] * 864e5];
  let [x0, x1] = c.win && !c.win.std ? [c.win.von, c.win.bis] : std;
  const w = Math.min(Math.max(x1 - x0, 6 * 36e5), hi - lo); x1 = x0 + w; if (x0 < lo) { x0 = lo; x1 = lo + w; } if (x1 > hi) { x1 = hi; x0 = hi - w; }
  c.x0 = x0; c.x1 = x1; c.lo = lo; c.hi = hi;
  const H = c.hoehe, T = 80, B = H - 26, L = 44, R = W - 44;
  svgEl.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const X = (t) => L + (t - x0) / (x1 - x0) * (R - L), jetzt = Date.now();
  const hm = (t) => new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const mL = fwNice(c.links.max() * 1.05, 4), mR = fwNice(c.rechts.max() * 1.05, 4);
  const YL = (v) => B - Math.max(v, 0) / mL * (B - T), YR = (v) => B - Math.max(v, 0) / mR * (B - T);
  let svg = zlHimmel(id, x0, x1, L, R, T + 10, B, X, hm);   // Hintergrund ab T, Sonnenband T−16 … T
  for (let i = 0; i <= 4; i++) { const y = B - i / 4 * (B - T);
    svg += `<line x1="${L}" x2="${R}" y1="${y}" y2="${y}" stroke="#e5e7eb" stroke-opacity="0.12" stroke-dasharray="3 4"/>`
      + `<text x="${L - 6}" y="${y + 4}" fill="#9ca3af" font-size="11" text-anchor="end">${zahl(mL * i / 4, c.links.dec || 0)}</text>`
      + `<text x="${R + 6}" y="${y + 4}" fill="#9ca3af" font-size="11">${zahl(mR * i / 4, c.rechts.dec || 0)}</text>`; }
  svg += `<text x="${L - 6}" y="${T - 14}" fill="#9ca3af" font-size="10" text-anchor="end">${c.links.e}</text><text x="${R + 4}" y="${T - 14}" fill="#9ca3af" font-size="10">${c.rechts.e}</text>`;
  // Mitternacht hinter den Daten, Daten im Plotbereich beschnitten
  const mn = new Date(x0); mn.setHours(24, 0, 0, 0);
  for (let v = mn.getTime(); v < x1; v += 864e5) svg += `<line x1="${X(v)}" x2="${X(v)}" y1="${T - 64}" y2="${B}" stroke="#e5e7eb" stroke-width="1.2" opacity="0.7"/>`;
  if (jetzt > x0 && jetzt < x1) svg += `<line x1="${X(jetzt)}" x2="${X(jetzt)}" y1="${T}" y2="${B}" stroke="#9ca3af" stroke-dasharray="4 4"/>`;
  svg += `<defs><clipPath id="${id}_clip"><rect x="${L}" y="${T - 12}" width="${R - L}" height="${B - T + 12}"/></clipPath></defs>`;
  svg += `<g clip-path="url(#${id}_clip)">${c.daten({ X, YL, YR, x0, x1, T, B, schmal })}</g>` + (c.oben ? c.oben({ X, YL, YR, x0, x1, T, B, schmal, L, R }) : "");
  // Stunden unten, Datum + Kopf oben je Tag
  const pxh = (R - L) / Math.max((x1 - x0) / 36e5, 0.1), sh = [1, 2, 3, 6, 12, 24].find((h) => h * pxh >= (schmal ? 50 : 45)) || 24;
  const st = new Date(x0); st.setMinutes(0, 0, 0); st.setHours(Math.ceil(st.getHours() / sh) * sh);
  for (let v = st.getTime(); v <= x1; v += sh * 36e5) { const h = new Date(v).getHours(); if (sh >= 24 || h === 0) continue;
    svg += `<text x="${X(v)}" y="${B + 16}" fill="#9ca3af" font-size="11" text-anchor="middle">${String(h).padStart(2, "0")}:00</text>`; }
  const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  for (let a0 = mn.getTime() - 864e5; a0 < x1; a0 += 864e5) { const a = Math.max(a0, x0), b = Math.min(a0 + 864e5, x1), bw = X(b) - X(a);
    if (bw < 46) continue; const dt = new Date(a0 + 432e5), xm = (X(a) + X(b)) / 2, heute = a0 === h0;
    svg += `<text x="${xm}" y="${T - 52}" fill="${heute ? "#fff" : "#e5e7eb"}" font-size="12" font-weight="700" text-anchor="middle">${bw >= 90 ? WT[dt.getDay()] + " " : ""}${dt.getDate()}.${dt.getMonth() + 1}.</text>`;
    const k = c.kopf(a0, bw); if (k) svg += `<text x="${xm}" y="${T - 37}" fill="#9ca3af" font-size="11" text-anchor="middle">${k}</text>`;
    if (bw >= 70) svg += `<text x="${X(a0 + 864e5 > x1 ? x1 : a0 + 864e5) - (a0 + 864e5 > x1 ? 2 : 0)}" y="${B + 16}" fill="#9ca3af" font-size="11" text-anchor="${a0 + 864e5 > x1 ? "end" : "middle"}"></text>`; }
  svgEl.innerHTML = svg;
  kreuz(svgEl, { L, R, T: T - 10, B, x0, x1, html: (t) => c.tip(t, { x0, x1 }) });
  // Leiste
  let u = $(id + "_ueb");
  if (!u) { u = document.createElementNS("http://www.w3.org/2000/svg", "svg"); u.id = id + "_ueb"; u.setAttribute("class", "zeitleiste zl-ueb"); svgEl.after(u); }
  const tage = []; for (let t = lo; t < hi; t += 864e5) tage.push(t);
  const st2 = tage.map((t) => c.leiste(t) || []), mx = Math.max(1e-9, ...st2.map((l) => l.reduce((x, e) => x + (e.v > 0 ? e.v : 0), 0)));
  leiste(u, { lo, hi, a: x0, b: x1, minw: 6 * 36e5, UH: 34,
    inhalt: (UX, UW, UH) => tage.map((t, i) => { const x = UX(t) + 1.5, bw = Math.max(UX(t + 864e5) - UX(t) - 3, 1), dt = new Date(t); let sum = 0, g = "";
      for (const e of st2[i]) { if (!(e.v > 0)) continue; const hh = (UH - 4) * e.v / mx; g += `<rect x="${x}" y="${UH + 1 - (sum + hh)}" width="${bw}" height="${Math.max(hh, 0.5)}" fill="${e.farbe}"/>`; sum += hh; }
      if (UW > 700 || dt.getDate() % 2 === 0) g += `<text x="${x + bw / 2}" y="${UH + 15}" fill="${t === h0 ? "#e5e7eb" : "#9ca3af"}" font-size="10" text-anchor="middle"${t === h0 ? ' font-weight="700"' : ""}>${UW > 900 ? WT[dt.getDay()] + " " : ""}${dt.getDate()}.</text>`;
      return g; }).join("") + (jetzt < hi ? `<line x1="${UX(jetzt)}" x2="${UX(jetzt)}" y1="1" y2="${UH + 3}" stroke="#e5e7eb" stroke-width="1.5"/>` : ""),
    setze: (a, b) => { c.win = { std: false, von: a, bis: b }; fensterZeichnen(id); },
    std: () => { c.win = { std: true }; fensterZeichnen(id); } });
  fwTorte(id);
  // Ziehen im Feld = verschieben (einmal anmelden)
  if (!svgEl.__fw) { svgEl.__fw = true; svgEl.style.touchAction = "pan-y"; svgEl.style.cursor = "grab"; let dr = null;
    svgEl.addEventListener("pointerdown", (ev) => { dr = { x: ev.clientX, a: FW[id].x0, b: FW[id].x1, moved: false }; });
    svgEl.addEventListener("pointermove", (ev) => { if (!dr) return; const dx = ev.clientX - dr.x; if (Math.abs(dx) > 5) dr.moved = true; if (!dr.moved) return;
      const r = svgEl.getBoundingClientRect(), vb = svgEl.viewBox.baseVal.width || r.width, pw = r.width * (vb - 88) / vb, dt = -dx / pw * (dr.b - dr.a);
      FW[id].win = { std: false, von: dr.a + dt, bis: dr.b + dt }; tipWeg();
      if (!svgEl.__raf) svgEl.__raf = requestAnimationFrame(() => { svgEl.__raf = null; fensterZeichnen(id); }); });
    const aus = () => { dr = null; }; svgEl.addEventListener("pointerup", aus); svgEl.addEventListener("pointercancel", aus); svgEl.addEventListener("pointerleave", aus);
    doppel(svgEl, () => { FW[id].win = { std: true }; fensterZeichnen(id); }); }
}
const fwKreis = (cx, cy, txt, torte) => `${torte !== undefined ? (torte === null ? `<circle cx="${cx}" cy="${cy}" r="7" fill="#6b7280"/>` : kreis(cx, cy, 7, torte)) : `<circle cx="${cx}" cy="${cy}" r="7" fill="#1c1c1c"/>`}`
  + `<circle cx="${cx}" cy="${cy}" r="7.5" fill="none" stroke="#e5e7eb" stroke-width="2"/>`
  + `<rect x="${cx - txt.length * 3.4 - 5}" y="${cy - 30}" width="${txt.length * 6.8 + 10}" height="18" rx="3" fill="#27272a" stroke="#9ca3af"/>`
  + `<text x="${cx}" y="${cy - 17}" fill="#f3f4f6" font-size="11" font-weight="700" text-anchor="middle">${txt}</text>`;
const fwBox = (s) => `<div style="line-height:1.55">${s}</div>`;

// ---------- Torte unter den Fenster-Grafiken (03.10.2026, wie Dashboard) ----------
// FW[id].torte = {start, einheit, dec, ringnamen, rechne(von, bis, modus) → {ringe: [[{n, v, f}]…], hinweis}}
// Knöpfe Fenster (= sichtbarer Bereich) · 7 Tage · 30 Tage · 365 Tage · Alles; Langzeitwerte aus verlauf.json „tl“.
const FW_TK = [["fenster", "Fenster"], ["woche", "7 Tage"], ["monat", "30 Tage"], ["jahr", "365 Tage"], ["alles", "Alles"]];   // 04.10.2026: rollierend → „x Tage“
let TL = {};   // Datum → {Kürzel: Wert} aus der Langzeitstatistik
// Spalten von „tl“ (SQL „Tageswerte lang“, 03.10.2026): [Datum, …] in dieser Reihenfolge; Liter bzw. kWh
const TL_K = ["a_dusche", "a_badewanne", "a_abspuelen", "a_warm_kurz", "a_wc", "a_kalt", "a_waschmaschine", "a_spuelmaschine", "vol",
  "cmi_wp", "keller_bwwp_shelly_energie", "klima_betrieb_heute", "wp_strom_gratis_heute", "bwwp_strom_gratis_heute",
  "haus", "netz", "einsp", "akku_ent", "akku_lad", "g_waschmaschine", "g_trockner", "g_spulmaschine", "g_kuhlschrank", "g_kuhlschrank_garage",
  "g_entfeuchter", "g_nerdaxe", "g_iceriver", "g_tv_sony",
  "h_pv", "h_akku", "h_netz", "ak_pv", "ak_netz"];   // 04.10.2026: haus_herkunft.yaml (Haus aus PV/Akku/Netz, Akku aus PV/Netz), ab 24.09.
function tlSetzen(v) { TL = {}; for (const r of (v && v.tl) || []) { if (!Array.isArray(r)) continue; const x = TL[r[0]] = {}; TL_K.forEach((k, i) => { if (r[i + 1] != null) x[k] = r[i + 1]; }); } }
const fwBogen = (cx, cy, r0, r1, a0, a1) => { if (a1 - a0 >= 2 * Math.PI - 1e-6) a1 = a0 + 2 * Math.PI - 1e-4;
  const p = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)], g = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(r1, a0), [x1, y1] = p(r1, a1), [x2, y2] = p(r0, a1), [x3, y3] = p(r0, a0);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r1} ${r1} 0 ${g} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${r0} ${r0} 0 ${g} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`; };
function fwTorte(id, cc) {
  const c = cc || FW[id], svgEl = $(id); if (!c || !c.torte || !svgEl) return;
  let box = $(id + "_torte");
  if (!box) { box = document.createElement("div"); box.id = id + "_torte"; box.className = "fw-torte";
    box.innerHTML = `<div class="fw-knoepfe">${FW_TK.map(([m, n]) => `<button data-m="${m}">${n}</button>`).join("")}<span class="fw-zeit"></span><button class="fw-det"></button></div>`
      + `<svg class="fw-tsvg" viewBox="0 0 200 200"></svg><div class="fw-liste"></div>`;
    ($(id + "_ueb") || svgEl).after(box);
    box.querySelectorAll("button[data-m]").forEach((b) => b.addEventListener("click", () => { c.tModus = b.dataset.m; fwTorte(id, cc); }));
    try { c.tOffen = localStorage.getItem("torte_" + id) === "1"; } catch (e) {}
    const um = () => { c.tOffen = !c.tOffen; try { localStorage.setItem("torte_" + id, c.tOffen ? "1" : "0"); } catch (e) {} fwTorte(id, cc); };
    box.querySelector(".fw-det").addEventListener("click", um); box.querySelector(".fw-tsvg").addEventListener("click", um); }
  const m = c.tModus || "alles", jetzt = Date.now(), h0 = new Date(); h0.setHours(0, 0, 0, 0);
  box.querySelectorAll("button[data-m]").forEach((b) => b.classList.toggle("an", b.dataset.m === m));
  const n = { woche: 7, monat: 30, jahr: 365 }[m];
  const [von, bis] = m === "fenster" ? [Math.max(c.x0, c.torte.start), Math.min(c.x1, jetzt)]
    : [n ? Math.max(h0.getTime() - (n - 1) * 864e5, c.torte.start) : c.torte.start, jetzt];
  const erg = c.torte.rechne(von, bis, m) || {}, e = c.torte.einheit, dec = c.torte.dec || 0;
  // Ring 1 = Gesamtbild, Ring 2 = Detail außen nur aufgeklappt (Klick auf Torte/„Details“, gemerkt je Grafik)
  const alle = (erg.ringe || []).map((r) => r.filter((x) => x.v > 0)), offen = !!c.tOffen;
  const ringe = alle.slice(0, offen ? 2 : 1).filter((r) => r.length), sum = (r) => r.reduce((a, x) => a + x.v, 0);
  const det = box.querySelector(".fw-det"); det.hidden = !(alle.length > 1 && alle[1].length);
  det.textContent = offen ? "Details ▴" : "Details: " + ((c.torte.ringnamen || [])[1] || "") + " ▾";
  const R = ringe.length > 1 ? [[46, 64], [68, 92]] : [[56, 92]];
  let svg = "";
  ringe.forEach((r, i) => { const t = sum(r); let a = 0;
    for (const x of r) { const w = x.v / t * 2 * Math.PI, [r0, r1] = R[i];
      svg += `<path d="${fwBogen(100, 100, r0, r1, a, a + w)}" fill="${x.f}" stroke="#1c1c1c" stroke-width="1.2"><title>${x.n}: ${zahl(x.v, dec)} ${e} (${Math.round(x.v / t * 100)} %)</title></path>`;
      if (x.v / t >= 0.07) { const am = a + w / 2, rm = (r0 + r1) / 2;
        svg += `<text x="${(100 + rm * Math.sin(am)).toFixed(1)}" y="${(100 - rm * Math.cos(am) + 4).toFixed(1)}" fill="#fff" font-size="${i ? 11 : 10}" font-weight="700" text-anchor="middle" pointer-events="none" style="paint-order:stroke" stroke="rgba(0,0,0,.45)" stroke-width="2.5">${Math.round(x.v / t * 100)} %</text>`; }
      a += w; } });
  if (!ringe.length) svg += `<circle cx="100" cy="100" r="74" fill="none" stroke="#3f3f46" stroke-width="36"/>`;
  svg += `<text x="100" y="96" fill="#e5e7eb" font-size="17" font-weight="700" text-anchor="middle">${ringe.length ? zahl(sum(ringe[0]), dec) : "–"}</text><text x="100" y="114" fill="#9ca3af" font-size="11" text-anchor="middle">${e}</text>`;
  box.querySelector(".fw-tsvg").innerHTML = svg;
  box.querySelector(".fw-liste").innerHTML = ringe.map((r, i) => { const t = sum(r);
    return `<div class="fw-rname">${(c.torte.ringnamen || [])[i] || ""}</div>`
      + r.map((x) => `<div class="fw-zeile"><i style="background:${x.f}"></i><span>${x.n}</span><b>${zahl(x.v, dec)} ${e}</b><em>${Math.round(x.v / t * 100)} %</em></div>`).join(""); }).join("")
    + (erg.hinweis ? `<div class="fw-hinweis">${erg.hinweis}</div>` : "");
  const f = (t) => new Date(t).toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }), hm = (t) => new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  box.querySelector(".fw-zeit").textContent = f(von) === f(bis - 1) ? f(von) + (bis - von < 864e5 - 6e4 ? " " + hm(von) + "–" + hm(bis) : "")
    : `${f(von)} – ${f(bis - 1)} (${Math.max(Math.round((bis - von) / 864e5), 1)} Tage)`;
}
// Tage zwischen von und bis (lokale Mitternacht), mit Anteil des Tages im Bereich
function fwTage(von, bis) { const l = [], d = new Date(von), jetzt = Date.now(); d.setHours(0, 0, 0, 0);
  // Anteil bezogen auf den schon vergangenen Teil des Tages (heute stehen in den Tageswerten nur die bisherigen Stunden)
  for (let t = d.getTime(); t < bis; t += 864e5) { const a = Math.max(t, von), b = Math.min(t + 864e5, bis), voll = Math.min(t + 864e5, jetzt) - t;
    if (b > a) l.push([fwKey(t), a, b, Math.min((b - a) / Math.max(voll, 6e4), 1)]); }
  return l; }
const WF_ART = [["Dusche", "Dusche", "#ef4444", 1, "a_dusche"], ["Badewanne?", "Badewanne", "#f97316", 1, "a_badewanne"], ["Abspülen / Becken?", "Abspülen", "#fb7185", 1, "a_abspuelen"],
  ["warm kurz", "warm kurz", "#fca5a5", 1, "a_warm_kurz"], ["WC?", "WC", "#60a5fa", 0, "a_wc"], ["kalt", "kalt sonst", "#2563eb", 0, "a_kalt"],
  ["Waschmaschine", "Waschmaschine", "#a78bfa", 0, "a_waschmaschine"], ["Spülmaschine", "Spülmaschine", "#2dd4bf", 0, "a_spuelmaschine"]];
// 08.10.2026 (Nutzer): Heißwasser ab Speicher je Zapfung – gemeinsam für Torte, Tagesbalken, Tooltip.
// heiß = warm_l aus dem Zapf-Protokoll, sonst Liter × (T_Nutzung − T_kalt) / (T_Speicher − T_kalt); T_Nutzung = Helfer (wwt), T = Median aus dem Protokoll
function wfT() { const evs = (WF && WF.ev) || []; if (WF && WF.__T && WF.__T.ev === evs) return WF.__T;
  const med = (a, d) => { a = a.filter((x) => typeof x === "number" && isFinite(x)).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : d; };
  const wt = (WF && WF.wwt) || [38, 40, 42], Tw = med(evs.map((e) => e.p && e.p.t_ww), 50), Tk = med(evs.map((e) => e.p && e.p.t_kw), 15);
  const T = { ev: evs, wt, Tw, Tk, fa: (a) => { const tn = Math.min(a === "Dusche" ? wt[0] : a === "Badewanne?" ? wt[1] : wt[2], Tw); return Tw - Tk > 5 ? Math.min(Math.max((tn - Tk) / (Tw - Tk), 0), 1) : 1; } };
  if (WF) WF.__T = T; return T; }
function wfHeiss(e) { return e.warm !== true ? 0 : e.p && e.p.warm_l > 0 ? Math.min(e.p.warm_l, e.l) : e.l * wfT().fa(e.art); }
function wfTag(k) { const r = { heiss: 0, misch: 0, kalt: 0, n: 0 };
  for (const e of (WF && WF.ev) || []) { if (e.warm == null || fwKey(e.t) !== k) continue; r.n++; if (e.warm) { const h = wfHeiss(e); r.heiss += h; r.misch += e.l - h; } else r.kalt += e.l; }
  return r.n ? r : null; }
function wfTagText(x, h) { const ges = x.ges || 0, r = Math.round;
  return `<br><span style="color:#ef4444">●</span> heiß ${r(h.heiss)} l (${ges ? r(h.heiss / ges * 100) : 0} %) · <span style="color:#93c5fd">●</span> zugemischt ${r(h.misch)} l · <span style="color:#2563eb">●</span> kalt ${r(Math.max(ges - h.heiss - h.misch, 0))} l`; }
// 08.10.2026 (Nutzer): am SYR vorbei – Garten (Gießplan, garten.yaml) + Küche kalt (Annahme) je Tag, verlauf.json „ga“ (t = abgeschlossene Tage, g/k = heute live)
function wfGK(k) { const ga = WF && WF.ga; if (!ga) return null; if (k === fwKey(Date.now())) return { g: ga.g || 0, k: ga.k || 0, s: ga.s || 0 };   // 09.10.2026: + Spülmaschine (geschätzt, am SYR vorbei)
  const x = (ga.t || {})[k], sp = (ga.st || {})[k] || 0; return x ? { g: x[0] || 0, k: x[1] || 0, s: sp } : sp ? { g: 0, k: 0, s: sp } : null; }
function wfTorteRechne(von, bis) {
  // Einzel-Zapfungen, soweit vorhanden (genau); davor Tageswerte der Langzeitstatistik (ganze Tage), Rest = ohne Aufteilung
  // 08.10.2026 (Nutzer): innen echtes Heißwasser ab Speicher (wie Dashboard): heiß = warm_l aus dem Protokoll, sonst Liter × (T_Nutzung − T_kalt) / (T_Speicher − T_kalt)
  const ab = WF && WF.kum.length ? WF.kum[0][0] : bis, art = {}, ring = { heiss: 0, misch: 0, kalt: 0, unb: 0 }; let ohne = 0;
  const evs = (WF && WF.ev) || [], { wt, Tw, fa } = wfT();
  for (const e of evs) { if (e.t < Math.max(von, ab) || e.t >= bis) continue; const a = WF_ART.find((x) => x[0] === e.art);
    if (a) art[a[1]] = (art[a[1]] || 0) + e.l; else ohne += e.l;
    if (e.warm === true) { const h = wfHeiss(e); ring.heiss += h; ring.misch += e.l - h; }
    else ring[e.warm === false ? "kalt" : "unb"] += e.l; }
  for (const [k, a, b, anteil] of fwTage(von, Math.min(ab, bis))) { const x = TL[k]; if (!x) continue;
    let s = 0; for (const q of WF_ART) { const v = (x[q[4]] || 0) * anteil; art[q[1]] = (art[q[1]] || 0) + v; if (q[3]) { const h = v * fa(q[0]); ring.heiss += h; ring.misch += v - h; } else ring.kalt += v; s += v; }
    const rest = Math.max((x.vol || 0) * anteil - s, 0); ohne += rest; ring.unb += rest; }
  for (const [k, , , anteil] of fwTage(von, bis)) { const x = wfGK(k); if (!x) continue;   // Garten + Küche kalt → kalt direkt
    art["Garten"] = (art["Garten"] || 0) + x.g * anteil; art["Küche kalt (Annahme)"] = (art["Küche kalt (Annahme)"] || 0) + x.k * anteil; art["Spülmaschine (geschätzt)"] = (art["Spülmaschine (geschätzt)"] || 0) + (x.s || 0) * anteil; ring.kalt += (x.g + x.k + (x.s || 0)) * anteil; }
  const gp = (WF && WF.ga && WF.ga.p) || [5.4, 10.5, 20], dz = (x) => String(x).replace(".", ",");
  const rd = (r) => r.map((x) => ({ ...x, v: Math.round(x.v) }));
  return { ringe: [rd([{ n: "heiß (Speicher)", v: ring.heiss, f: "#ef4444" }, { n: "kalt zugemischt", v: ring.misch, f: "#93c5fd" }, { n: "kalt direkt", v: ring.kalt, f: "#2563eb" }, { n: "ohne Aufteilung", v: ring.unb, f: "#6b7280" }]),
    rd(WF_ART.map((a) => ({ n: a[1], v: art[a[1]] || 0, f: a[2] })).concat([{ n: "Garten", v: art["Garten"] || 0, f: "#22c55e" }, { n: "Küche kalt (Annahme)", v: art["Küche kalt (Annahme)"] || 0, f: "#0ea5e9" }, { n: "Spülmaschine (geschätzt)", v: art["Spülmaschine (geschätzt)"] || 0, f: "#a78bfa" }]).sort((x, y) => y.v - x.v).concat([{ n: "ohne Aufteilung", v: ohne, f: "#6b7280" }]))],
    hinweis: "heiß = ab Speicher (~" + Math.round(Tw) + " °C); zugemischt = Kaltwasser in Dusche/Wanne/Becken (Annahme " + wt.join("/") + " °C)" + (ohne >= 1 ? " · grau = ohne Zuordnung (Warm-Erkennung ab 25.09.2026)" : "")
      + " · Garten = Eve-Laufzeit × l/min, vor 08.10. Gießplan (vorne " + dz(gp[0]) + " / hinten " + dz(gp[1]) + " l/min), Küche kalt = Annahme " + dz(gp[2]) + " l/Tag, Spülmaschine = " + dz(gp[3] ?? 9) + " l je Spülgang (Miele am Küchen-Kaltwasser) – alle am SYR vorbei" };
}
function wpTorteRechne(von, bis) {
  // je Tag: ganze Tage aus den Tageswerten (WPF.tage, davor Langzeitstatistik), angeschnittene Tage anteilig nach der Leistungskurve
  let wp = 0, bw = 0, ll = 0, gr = 0, unb = 0;
  const integ = (n, a, b) => { let s = 0; for (const [t, p] of (WPF && WPF.kw[n]) || []) { const x = Math.max(t, a), y = Math.min(t + 9e5, b); if (y > x) s += p * (y - x) / 36e5; } return s; };
  for (const [k, a, b, anteil] of fwTage(von, bis)) {
    const tg = (WPF && WPF.tage[k]) || null, x = TL[k] || {};
    const d = tg ? { wp: tg.wp || 0, bw: tg.bw || 0, ll: tg.ll || 0, gwp: tg.gwp, gbw: tg.gbw }
      : { wp: x.cmi_wp || 0, bw: x.keller_bwwp_shelly_energie || 0, ll: x.klima_betrieb_heute || 0, gwp: x.wp_strom_gratis_heute ?? null, gbw: x.bwwp_strom_gratis_heute ?? null };
    let f = { wp: 1, bw: 1, ll: 1 };
    if (anteil < 0.999) { const t0 = new Date(a); t0.setHours(0, 0, 0, 0); const ganz = t0.getTime() + 864e5;
      for (const n of ["wp", "bw", "ll"]) { const g = integ(n, t0.getTime(), Math.min(ganz, Date.now())), s = integ(n, a, b); f[n] = g > 0.01 ? s / g : anteil; } }
    wp += d.wp * f.wp; bw += d.bw * f.bw; ll += d.ll * f.ll;
    if (d.gwp == null && d.gbw == null) unb += d.wp * f.wp + d.bw * f.bw; else gr += Math.min((d.gwp || 0) * f.wp + (d.gbw || 0) * f.bw, d.wp * f.wp + d.bw * f.bw); }
  unb += ll; const rd = (v) => Math.round(v * 10) / 10;
  return { ringe: [[{ n: "PV/Akku", v: rd(gr), f: "#22c55e" }, { n: "Netz", v: rd(Math.max(wp + bw + ll - gr - unb, 0)), f: "#ef4444" }, { n: "LLWP / ohne Aufteilung", v: rd(unb), f: "#6b7280" }],
    [{ n: "WP", v: rd(wp), f: "#3b82f6" }, { n: "BWWP", v: rd(bw), f: "#f87171" }, { n: "LLWP (Daikin)", v: rd(ll), f: "#facc15" }]],
    hinweis: unb > 0.05 ? "grau = LLWP bzw. Tage ohne PV/Netz-Aufteilung" : "" };
}


// Torten an Grafiken mit eigener Fensterlogik (03.10.2026): Stromherkunft (#herkunft) und Haushaltsgeräte (#zeitleiste2)
const FW_FREMD = {};
function fwTorteFremd(id, torte, x0, x1) { const c = FW_FREMD[id] = FW_FREMD[id] || { torte }; c.x0 = x0; c.x1 = x1; fwTorte(id, c); }
const rd1 = (v) => Math.round(v * 10) / 10;
const HK_TORTE = { start: new Date(2026, 8, 22).getTime(), einheit: "kWh", dec: 1, ringnamen: ["Haus bezieht", "PV-Strom geht"],
  rechne: (von, bis, m) => { let pv = 0, akku = 0, netz = 0, lad = 0, einsp = 0, nl = 0;
    if (m === "fenster") for (const r of hkDaten) { const a = Math.max(r[0], von), b = Math.min(r[0] + r[8], bis); if (b <= a) continue; const f = (b - a) / 3.6e9;
      pv += r[1] * f; akku += r[2] * f; netz += r[3] * f; lad += r[4] * f; einsp += r[5] * f; }
    else for (const [k, , , an] of fwTage(von, bis)) { const x = TL[k]; if (!x) continue;
      if (x.h_netz != null) { pv += (x.h_pv || 0) * an; akku += (x.h_akku || 0) * an; netz += x.h_netz * an; lad += (x.ak_pv || 0) * an; nl += (x.ak_netz || 0) * an; einsp += (x.einsp || 0) * an; continue; }
      const h = (x.haus || 0) * an, n = (x.netz || 0) * an, ak = Math.min((x.akku_ent || 0) * an, Math.max(h - n, 0));   // vor 24.09.2026: alte Näherung
      netz += n; akku += ak; pv += Math.max(h - n - ak, 0); lad += (x.akku_lad || 0) * an; einsp += (x.einsp || 0) * an; }
    return { ringe: [[{ n: "PV direkt", v: rd1(pv), f: "#facc15" }, { n: "Akku", v: rd1(akku), f: "#3b82f6" }, { n: "Netz", v: rd1(netz), f: "#f97316" }],
      [{ n: "ins Haus", v: rd1(pv), f: "#facc15" }, { n: "in den Akku", v: rd1(lad), f: "#93c5fd" }, { n: "Einspeisung", v: rd1(einsp), f: "#22c55e" }]],
      hinweis: "Akku = was im Haus ankommt (nach Wandlerverlust)" + (nl >= 0.05 ? ` · zusätzlich Netz → Akku ${rd1(nl).toFixed(1).replace(".", ",")} kWh (Nachladen an der Reserve)` : "") }; } };
const GER_TORTE = { start: new Date(2026, 8, 22).getTime(), einheit: "kWh", dec: 1, ringnamen: ["Gruppen", "je Gerät"],
  rechne: (von, bis) => {
    const G = [["Waschmaschine", "g_waschmaschine", "Wäsche", "#06b6d4"], ["Trockner", "g_trockner", "Wäsche", "#a855f7"], ["Spülmaschine", "g_spulmaschine", "Küche & Kühlen", "#22c55e"],
      ["Kühlschrank", "g_kuhlschrank", "Küche & Kühlen", "#86efac"], ["Kühlschrank Garage", "g_kuhlschrank_garage", "Küche & Kühlen", "#4ade80"], ["Entfeuchter", "g_entfeuchter", "Entfeuchter", "#f59e0b"],
      ["Nerdaxe", "g_nerdaxe", "Miner", "#f472b6"], ["Iceriver", "g_iceriver", "Miner", "#db2777"], ["TV", "g_tv_sony", "TV", "#94a3b8"]];
    const FG = { "Wäsche": "#06b6d4", "Küche & Kühlen": "#22c55e", "Entfeuchter": "#f59e0b", "Miner": "#ec4899", "TV": "#94a3b8" }, je = {}, gr = {};
    for (const [k, , , an] of fwTage(von, bis)) { const x = TL[k]; if (!x) continue; for (const g of G) { const v = (x[g[1]] || 0) * an; je[g[0]] = (je[g[0]] || 0) + v; gr[g[2]] = (gr[g[2]] || 0) + v; } }
    return { ringe: [Object.entries(gr).map(([n, v]) => ({ n, v: rd1(v), f: FG[n] })).sort((a, b) => b.v - a.v),
      G.map((g) => ({ n: g[0], v: rd1(je[g[0]] || 0), f: g[3] })).sort((a, b) => b.v - a.v)],
      hinweis: "Tageswerte (stündlich aktualisiert); im Fenster anteilig nach Zeit" }; } };

// --- Wasser: jede Zapfung (Protokoll; davor aus dem SYR-Zählerverlauf rekonstruiert, Regeln wie zapfungen.yaml) ---
let WF = null;
function wasserFensterDaten(d, v) {
  const s = d.s || {}, jetzt = Date.now(), jahr = new Date().getFullYear(), mn = (t) => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
  // Tage: gesamt aus Zählerstand am Tagesende (heute live), warm/Duschen aus BWWP-Tageswerten (heute live)
  const tage = {}, stand = {}; for (const [k, vv] of d.wd || []) stand[k] = vv;
  for (let t = mn(jetzt) - 14 * 864e5; t <= mn(jetzt); t += 864e5) { const k = fwKey(t), kv = fwKey(t - 864e5 + 36e5 * 2 - 36e5 * 2);
    const vk = fwKey(mn(t) - 1); let v1 = stand[k]; if (k === fwKey(jetzt)) v1 = num(s, "sensor.syr_connect_245124253_getvol") ?? v1;
    if (v1 !== undefined && stand[vk] !== undefined) tage[k] = { ges: Math.max(Math.round((v1 - stand[vk]) * 1000), 0) }; }
  for (const [k, wl, n] of d.bt || []) if (tage[k]) { tage[k].warm = wl; tage[k].dusch = n; }
  const hk = fwKey(jetzt); tage[hk] = { ges: Math.round(num(s, "sensor.wasser_heute_liter") ?? (tage[hk] || {}).ges ?? 0),
    warm: Math.round(num(s, "sensor.warmwasser_heute_liter") ?? 0), dusch: num(s, "sensor.duschen_heute") ?? 0 };
  // Protokoll
  const ev = [];
  // Binärsensoren → An-Phasen
  const ph = {}; for (const c of ["w", "m", "s"]) ph[c] = { ab: Infinity, an: [] };
  const bn = ((v && v.wv && v.wv.bn) || []).slice().sort((a, b) => a[1] - b[1]), offen = {};
  for (const [c, t, o] of bn) { const p = ph[c]; if (!p) continue; const ms = t * 1000; if (p.ab === Infinity) p.ab = ms;
    if (o && offen[c] == null) offen[c] = ms; else if (!o && offen[c] != null) { p.an.push([offen[c], ms]); offen[c] = null; } }
  for (const c in offen) if (offen[c] != null) ph[c].an.push([offen[c], jetzt]);
  const an = (p, a, b) => p.an.some(([x, y]) => x < b && y > a);
  // Warm-Regel (03.10.2026, wie zapfungen.yaml): warm nur mit Anstieg T.Warmwasser ≥ 0,5 K; Maschine läuft, nicht warm,
  // ≤ 25 l Waschmaschine → Maschine (3 min Toleranz; Spülmaschine seit 09.10.2026 nicht mehr – hängt am Küchen-Kaltwasser, am SYR vorbei); gilt auch für ältere Protokolleinträge ohne dww
  const T = []; if (v && v.wv && v.wv.ts) { let [t, x] = v.wv.ts; T.push([t * 1000, x / 10]); for (const [dt, dx] of v.wv.tw || []) { t += dt; x += dx; T.push([t * 1000, x / 10]); } }
  const anstieg = (a, b) => { let t0 = null, mx = null; for (const [t, x] of T) { if (t <= a) t0 = x; else if (t <= b + 12e4) mx = Math.max(mx ?? x, x); else break; }
    return t0 == null ? null : Math.max((mx ?? t0) - t0, 0); };
  const einordnen = (t0, t1, l, dauer, wBin) => { const b = t1 + 18e4, dw = wBin ? anstieg(t0, t1) : null, warm = wBin === null ? null : !!wBin && (dw === null || dw >= 0.5);
    const g = t0 >= ph.m.ab && an(ph.m, t0 - 6e4, b) ? "Waschmaschine" : "";
    const art = warm === null ? "" : g && !warm && l <= 25 ? g : warm && l >= 100 && l / dauer >= 11 ? "Badewanne?" : warm && l >= 30 && dauer >= 3 ? "Dusche"
      : warm && dauer >= 3 ? "Abspülen / Becken?" : warm ? "warm kurz" : l >= 3 && l <= 12 && dauer <= 3 ? "WC?" : "kalt";
    return { warm, art }; };
  for (const p of (v && v.zp) || d.zp || []) { const m = /^(\d+)\.(\d+)\. (\d+):(\d+)/.exec(p[0] || ""); if (!m) continue;
    const dt = new Date(jahr, m[2] - 1, m[1], m[3], m[4]); if (dt.getTime() > jetzt + 864e5) dt.setFullYear(jahr - 1);
    const a0 = dt.getTime(), a1 = a0 + Math.max((p[1] || 1) - 1, 0) * 6e4, e = p[6] != null ? { warm: !!p[3], art: p[4] } : einordnen(a0, a1, p[2], p[1] || 1, !!p[3]);
    ev.push({ t: a0 + (p[1] || 0) * 3e4, l: p[2], warm: e.warm, art: e.art, p: { start: p[0], dauer_min: p[1], max_lh: p[5], warm_l: p[7], t_ww: p[8], t_kw: p[9] } }); }
  const ab = ev.length ? Math.min(...ev.map((e) => e.t)) - 3e5 : Infinity;
  // Zählerverlauf → Rekonstruktion + Liter seit 0:00
  const pts = []; if (v && v.wv && v.wv.vs) { let [t, l] = v.wv.vs; pts.push([t * 1000, l]); for (const [dt, dl] of v.wv.vd || []) { t += dt; l += dl; pts.push([t * 1000, l]); } }
  const kum = [], ende = []; let basis = null, tag = null, prev = null, akt = null;
  const schliesse = () => { if (!akt || akt.l < 1 || akt.t1 >= ab) { akt = null; return; }
    const l = Math.round(akt.l), dauer = Math.max(Math.round((akt.t1 - akt.t0) / 6e4 + 1), 1), b = akt.t1 + 6e4;
    const { warm, art } = einordnen(akt.t0, akt.t1, l, dauer, akt.t0 >= ph.w.ab ? an(ph.w, akt.t0, b) : null);
    ev.push({ t: (akt.t0 + akt.t1) / 2, l, warm, art, nach: true, p: { dauer_min: dauer } }); akt = null; };
  for (const [t, vl] of pts) { const m = mn(t);
    if (m !== tag) { if (tag !== null && prev) { const w = Math.max(prev[1] - basis, 0); kum.push([m - 1, w], [m - 0.5, null]); ende.push([m - 1, w]); }
      tag = m; basis = prev ? prev[1] : vl; kum.push([m, 0]); }
    kum.push([t, Math.max(vl - basis, 0)]);
    if (prev) { const dv = vl - prev[1];
      if (dv > 0 && dv < 2000) { if (akt && t - akt.t1 <= 15e4) { akt.t1 = t; akt.l += dv; } else { schliesse(); akt = { t0: t - 6e4, t1: t, l: dv }; } }
      else if (akt && t - akt.t1 > 15e4) schliesse(); }
    prev = [t, vl]; }
  schliesse(); if (prev) { const w = Math.max(prev[1] - basis, 0); kum.push([jetzt, w]); ende.push([jetzt, w]); }
  ev.sort((a, b) => a.t - b.t);
  for (const e of ev) { const k = fwKey(e.t), x = tage[k] = tage[k] || { ges: 0 }; x.arten = x.arten || {};
    if (e.art) { const a = x.arten[e.art] = x.arten[e.art] || { n: 0, l: 0 }; a.n++; a.l += e.l; }
    if (e.warm !== null) x.ev_warm = (x.ev_warm || 0) + (e.warm ? e.l : 0); }
  for (const x of Object.values(tage)) if (x.warm == null && x.ev_warm != null) x.warm = Math.min(x.ev_warm, x.ges);
  // 08.10.2026 (Nutzer): Gartenwasser (am SYR vorbei) als grüne Säulen + in Linie/Tageskreis, wie Dashboard.
  // gev: Vortage aus ga.l {d, t, l, was}, heute aus ga.h {t, l, was}; Tage nur mit Tagessumme (ga.t, vor 08.10.) → geschätzt 07:00 + 18:45
  const ga = (v && v.ga) || null, gev = [], hk2 = fwKey(jetzt);
  const gz = (dd, hm) => { const [y, mo, da] = dd.split("-").map(Number), [h, mi] = (hm || "12:00").split(":").map(Number); return new Date(y, mo - 1, da, h, mi).getTime(); };
  if (ga) { for (const x of ga.l || []) gev.push({ t: gz(x.d, x.t), l: x.l, was: x.was });
    for (const x of ga.h || []) gev.push({ t: gz(hk2, x.t), l: x.l, was: x.was });
    const mit = new Set(gev.map((e) => fwKey(e.t)));
    for (const [k, x] of Object.entries(ga.t || {})) { if (mit.has(k) || !(x && x[0] > 0)) continue;
      gev.push({ t: gz(k, "07:00"), l: x[0] / 2, was: "Gießplan morgens", est: true }, { t: gz(k, "18:45"), l: x[0] / 2, was: "Gießplan abends", est: true }); }
    gev.sort((a, b) => a.t - b.t); }
  for (const e of gev) { const x = tage[fwKey(e.t)]; if (x) x.gl = (x.gl || 0) + e.l; }
  let kumG = kum, endeG = ende;
  if (gev.length) { const gOff = (t) => { let sm = 0; const k = fwKey(t); for (const e of gev) if (e.t <= t && fwKey(e.t) === k) sm += e.l; return sm; };
    const syrBei = (t) => { let w = null; for (const [tt, vv] of kum) { if (tt > t) break; w = vv == null || fwKey(tt) !== fwKey(t) ? null : vv; } return w; };
    const zus = []; for (const e of gev) { const w = syrBei(e.t); if (w != null) zus.push([e.t - 1, w], [e.t, w]); }
    kumG = kum.concat(zus).sort((a, b) => a[0] - b[0]).map(([t, w]) => [t, w == null ? null : Math.round(w + gOff(t))]);
    endeG = ende.map(([t, w]) => [t, w == null ? null : Math.round(w + gOff(t))]); }
  return { tage, ev, kum: kumG, ende: endeG, gev, wwt: (v && v.wwt) || [38, 40, 42], ga };
}
const WF_IC = { "Dusche": "🚿", "Badewanne?": "🛁", "Waschmaschine": "🧺", "Spülmaschine": "🍽️", "WC?": "🚽", "Abspülen / Becken?": "🚰" };
function zeigeWasserFenster(d, v) {
  if (!$("wf")) return;
  WF = wasserFensterDaten(d, v);
  const F = (t) => { const x = new Date(t); return x.toLocaleString("de-DE", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" }); };
  FW.wf = Object.assign(FW.wf || {}, { zurueck: 13, vor: 0, std: [-4, 1], stdSchmal: [-1, 1], hoehe: 330,
    torte: { start: new Date(2026, 8, 25).getTime(), einheit: "l", dec: 0, ringnamen: ["heiß / kalt", "wer hat es verbraucht"], rechne: wfTorteRechne },
    links: { e: "l", max: () => Math.max(20, ...WF.ev.map((e) => e.l), ...WF.gev.map((e) => e.l)) }, rechts: { e: "l", max: () => Math.max(100, ...WF.kum.map((p) => p[1] || 0)) },
    daten: ({ X, YL, YR, x0, x1, schmal }) => { let g = ""; const bw = schmal ? 3 : 4;
      for (const e of WF.ev) { if (e.t < x0 - 36e5 || e.t > x1 + 36e5) continue; const col = e.warm === true ? "#ef4444" : e.warm === false ? "#3b82f6" : "#9ca3af";
        g += `<rect x="${(X(e.t) - bw / 2).toFixed(1)}" y="${YL(e.l).toFixed(1)}" width="${bw}" height="${Math.max(YL(0) - YL(e.l), 1).toFixed(1)}" fill="${col}"/>`; }
      for (const e of WF.gev) { if (e.t < x0 - 36e5 || e.t > x1 + 36e5) continue;   // Garten (08.10.2026), geschätzte hell
        g += `<rect x="${(X(e.t) - bw / 2).toFixed(1)}" y="${YL(e.l).toFixed(1)}" width="${bw}" height="${Math.max(YL(0) - YL(e.l), 1).toFixed(1)}" fill="${e.est ? "#86efac" : "#22c55e"}"${e.est ? ' fill-opacity="0.55"' : ""}/>`; }
      let p = ""; for (const [t, l] of WF.kum) { if (l == null) { p += " "; continue; } p += (p === "" || p.endsWith(" ") ? "M" : "L") + X(t).toFixed(1) + " " + YR(l).toFixed(1); }
      return g + `<path d="${p.replace(/ M/g, "M").trim()}" fill="none" stroke="#e5e7eb" stroke-opacity="0.6" stroke-width="1.5"/>`; },
    oben: ({ X, YR, x0, x1 }) => WF.ende.filter(([t]) => t >= x0 - 5e3 && t <= x1 + 5e3).map(([t, l]) => { const x = WF.tage[fwKey(t - 1000)] || {};
      return fwKreis(X(t), YR(l), (x.ges ? x.ges + Math.round(x.gl || 0) : l) + " l"); }).join(""),
    kopf: (t, b) => { const x = WF.tage[fwKey(t)]; if (!x || !x.ges) return "";
      const IC = [["Dusche", "🚿"], ["Badewanne?", "🛁"], ["Waschmaschine", "🧺"], ["Spülmaschine", "🍽️"]], ar = x.arten || {};
      let ic = IC.filter(([a]) => ar[a]).map(([a, i]) => i + (ar[a].n > 1 && !/maschine/.test(a) ? ar[a].n : "")).join(" ");
      if (!ar["Dusche"] && x.dusch) ic = "🚿" + (x.dusch > 1 ? x.dusch : "") + (ic ? " " + ic : "");
      const gk = wfGK(fwKey(t)); if (gk && gk.g >= 1) ic += (ic ? " " : "") + "🌱";
      const ges = x.ges + Math.round(x.gl || 0);   // inkl. Garten (08.10.2026)
      return b >= 90 ? `${ges} l${ic ? " · " + ic : ""}` : `${ges} l`; },
    leiste: (t) => { const x = WF.tage[fwKey(t)]; if (!x) return []; const h = wfTag(fwKey(t));
      const gk = wfGK(fwKey(t)) || { g: 0, k: 0 }, z = [{ v: gk.k, farbe: "#0ea5e9" }, { v: gk.s || 0, farbe: "#a78bfa" }, { v: gk.g, farbe: "#22c55e" }];   // Küche kalt, Garten (08.10.2026)
      if (h) return [{ v: h.heiss, farbe: "#ef4444" }, { v: h.misch, farbe: "#93c5fd" }, { v: Math.max(x.ges - h.heiss - h.misch, 0), farbe: "#2563eb" }].concat(z);
      return (x.warm != null ? [{ v: Math.min(x.warm, x.ges), farbe: "#ef4444" }, { v: Math.max(x.ges - x.warm, 0), farbe: "#3b82f6" }] : [{ v: x.ges, farbe: "#6b7280" }]).concat(z); },
    tip: (t, { x0, x1 }) => { const tol = (x1 - x0) * 0.012, e0 = WF.ende.find(([te]) => Math.abs(te - t) < tol);
      if (e0) { const k = fwKey(e0[0] - 1000), x = WF.tage[k] || {}, ges = x.ges || 0, heute = k === fwKey(Date.now());
        const gl = Math.round(x.gl || 0);
        let s = `<b>${new Date(e0[0] - 1000).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" })}${heute ? " (bis jetzt)" : ""}: ${ges + gl} l</b>${gl ? ` <span style="color:#9ca3af">(Haus ${ges} l + 🌱 Garten ${gl} l)</span>` : ""}`;
        const h = wfTag(k); if (h) s += wfTagText(x, h);
        else if (x.warm != null) s += `<br><span style="color:#ef4444">●</span> warm ${x.warm} l (${ges ? Math.round(x.warm / ges * 100) : 0} %) · <span style="color:#3b82f6">●</span> kalt ${Math.max(ges - x.warm, 0)} l`;
        const ar = Object.entries(x.arten || {}).filter(([a]) => WF_IC[a]).sort((a, b) => b[1].l - a[1].l);
        if (ar.length) s += "<br>" + ar.map(([a, vv]) => `${WF_IC[a]} ${a.replace("?", "")} ${/maschine/.test(a) ? vv.n + (vv.n === 1 ? " Füllung" : " Füllungen") : vv.n + "×"} · ${vv.l} l`).join("<br>");
        const gk = wfGK(k); if (gk && (gk.g >= 1 || gk.k >= 1 || gk.s >= 1)) s += `<br><span style="color:#22c55e">●</span> 🌱 Garten ${Math.round(gk.g)} l · <span style="color:#0ea5e9">●</span> Küche kalt ≈ ${Math.round(gk.k)} l${gk.s ? ` · <span style="color:#a78bfa">●</span> Spülmaschine ≈ ${Math.round(gk.s)} l` : ""}<br>mit Küche kalt ≈ <b>${Math.round(ges + gk.g + gk.k + (gk.s || 0))} l</b>`;
        return fwBox(s); }
      let gb = null; for (const e of WF.gev) if (!gb || Math.abs(e.t - t) < Math.abs(gb.t - t)) gb = e;   // Garten (08.10.2026)
      let b = null; for (const e of WF.ev) if (!b || Math.abs(e.t - t) < Math.abs(b.t - t)) b = e;
      if (gb && Math.abs(gb.t - t) <= (x1 - x0) * 0.01 && (!b || Math.abs(gb.t - t) < Math.abs(b.t - t)))
        return fwBox(`<b>${F(gb.t)}</b><br><span style="color:#22c55e">●</span> <b>🌱 Garten</b> · ${Math.round(gb.l)} l<br>${gb.was || ""}${gb.est ? '<br><span style="color:#9ca3af;font-size:11px">geschätzt aus der Tagessumme (vor der Eve-Messung)</span>' : ""}`);
      if (!b || Math.abs(b.t - t) > (x1 - x0) * 0.01) { const y = wertBei(WF.kum.filter((p) => p[1] != null), t, 36e5 * 6); return y == null ? "" : fwBox(`${F(t)}<br>seit 0:00: <b>${Math.round(y)} l</b>`); }
      const col = b.warm === true ? "#ef4444" : b.warm === false ? "#3b82f6" : "#9ca3af", art = b.warm === true ? "warm" : b.warm === false ? "kalt" : "warm/kalt unbekannt";
      return fwBox(`<b>${F(b.t)}</b> · ${b.p.dauer_min || "?"} min<br><span style="color:${col}">●</span> <b>${b.art || art}</b> · ${b.l} l ${b.art ? art : ""}${b.p.max_lh ? " · max " + b.p.max_lh + " l/h" : ""}`
        + (b.warm === true ? `<br>davon ≈ ${Math.round(wfHeiss(b))} l heiß ab Speicher, ${Math.round(b.l - wfHeiss(b))} l kalt zugemischt` : "")
        + (b.nach ? '<br><span style="color:#9ca3af;font-size:11px">aus SYR-Verlauf nachträglich bestimmt</span>' : "")); } });
  fensterZeichnen("wf");
}

// --- Wärmepumpen – Strom: Fläche = Leistung (15-min-Mittel), Linie = kWh seit 0:00, Torte = PV/Akku-Anteil am Tagesende ---
let WPF = null;
function wpFensterDaten(d, v, s, k) {
  const jetzt = Date.now(), mn = (t) => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const kw = { wp: [], bw: [], ll: [] };
  for (const [b, a, c, e] of (v && v.pw) || []) { const t = b * 900000;
    if (a != null) kw.wp.push([t, a / 100]); if (c != null) kw.bw.push([t, c / 100]); if (e != null) kw.ll.push([t, e / 100]); }
  const tage = {};
  for (const t of tagesListe(s, k, d.h)) { const x = tage[t.d] = { wp: t.teile[0] + t.teile[1], bw: t.teile[2] + t.teile[3], gwp: t.teile[0], gbw: t.teile[2], ll: 0 }; }   // PV/Netz-Aufteilung je Tag aus warmepumpen_tageswerte (auch 22.–25.09. vorhanden)
  // Integral je Tag (kWh) aus den 15-min-Mitteln; LLWP-Tageswert nur daraus
  const integ = {}; for (const n of ["wp", "bw", "ll"]) for (const [t, p] of kw[n]) { const kk = fwKey(t), x = integ[kk] = integ[kk] || { wp: 0, bw: 0, ll: 0 }; x[n] += p * 0.25; }
  for (const [kk, x] of Object.entries(integ)) { const tg = tage[kk] = tage[kk] || { wp: 0, bw: 0, gwp: null, gbw: null, ll: 0 }; tg.ll = x.ll; }
  // Linie: Integral, je Tag auf die Zählerwerte skaliert (damit Linie und Kreis zur Tagessumme passen)
  const kum = [], ende = [], alle = []; for (const n of ["wp", "bw", "ll"]) for (const [t, p] of kw[n]) alle.push([t, n, p]);
  alle.sort((a, b) => a[0] - b[0]); let tag = null, sum = 0, letzt = null;
  for (const [t, n, p] of alle) { const m = mn(t), kk = fwKey(t), i = integ[kk] || {}, tg = tage[kk] || {};
    if (m !== tag) { if (tag !== null) { kum.push([tag + 864e5 - 1, sum], [tag + 864e5 - 0.5, null]); ende.push([tag + 864e5 - 1, sum]); } tag = m; sum = 0; kum.push([m, 0]); }
    const f = n === "ll" ? 1 : (i[n] > 0.05 && tg[n] > 0 ? tg[n] / i[n] : 1); sum += p * 0.25 * f; letzt = Math.min(t + 9e5, jetzt); kum.push([letzt, sum]); }
  if (tag !== null) { if (tag + 864e5 <= jetzt) ende.push([tag + 864e5 - 1, sum]); else ende.push([letzt, sum]); }
  return { kw, tage, kum, ende };
}
function zeigeWpFenster(d, v) {
  if (!$("wpf")) return;
  const s = d.s || {}, k = d.k || {};
  WPF = wpFensterDaten(d, v, s, k);
  const f1 = (x) => zahl(Math.round((x || 0) * 10) / 10, 1), pct = (a, b) => b > 0 && a != null ? Math.round(Math.min(a / b, 1) * 100) + " %" : "–";
  const FARBE = { wp: "#3b82f6", bw: "#f87171", ll: "#facc15" };
  FW.wpf = Object.assign(FW.wpf || {}, { zurueck: 13, vor: 0, std: [-4, 1], stdSchmal: [-1, 1], hoehe: 330,
    torte: { start: new Date(2026, 8, 22).getTime(), einheit: "kWh", dec: 1, ringnamen: ["woher", "je Gerät"], rechne: wpTorteRechne },
    links: { e: "kW", dec: 1, max: () => Math.max(2.5, ...["wp", "bw", "ll"].flatMap((n) => WPF.kw[n].map((p) => p[1]))) },
    rechts: { e: "kWh", max: () => Math.max(4, ...WPF.kum.map((p) => p[1] || 0)) },
    daten: ({ X, YL, x0, x1 }) => { let g = "";
      for (const n of ["ll", "wp", "bw"]) { const p = WPF.kw[n].filter(([t]) => t >= x0 - 18e5 && t <= x1 + 9e5); if (!p.length) continue;
        let dd = "", offen = false;
        for (let i = 0; i < p.length; i++) { const [t, w] = p[i], nx = i + 1 < p.length ? p[i + 1][0] : t + 9e5, lueck = i > 0 && t - p[i - 1][0] > 9e5 * 1.5;
          if (!offen || lueck) { if (offen) dd += `L${X(p[i - 1][0] + 9e5).toFixed(1)} ${YL(0)}Z`; dd += `M${X(t).toFixed(1)} ${YL(0)}`; offen = true; }
          dd += `L${X(t).toFixed(1)} ${YL(w).toFixed(1)}L${X(Math.min(nx, t + 9e5)).toFixed(1)} ${YL(w).toFixed(1)}`; }
        if (offen) dd += `L${X(p[p.length - 1][0] + 9e5).toFixed(1)} ${YL(0)}Z`;
        g += `<path d="${dd}" fill="${FARBE[n]}" fill-opacity="0.45" stroke="${FARBE[n]}" stroke-width="1.2"/>`; }
      return g; },
    oben: ({ X, YR, x0, x1 }) => { let g = "", p = "";
      for (const [t, l] of WPF.kum) { if (l == null) { p += " "; continue; } if (t < x0 - 864e5 || t > x1 + 864e5) continue; p += (p === "" || p.endsWith(" ") ? "M" : "L") + X(t).toFixed(1) + " " + YR(l).toFixed(1); }
      g += `<g clip-path="url(#wpf_clip)"><path d="${p.replace(/ +/g, " ").replace(/ M/g, "M").trim()}" fill="none" stroke="#e5e7eb" stroke-opacity="0.6" stroke-width="1.5"/></g>`;
      for (const [t, l] of WPF.ende) { if (t < x0 - 5e3 || t > x1 + 5e3) continue; const x = WPF.tage[fwKey(t - 1000)] || {}, tot = (x.wp || 0) + (x.bw || 0);
        const gr = x.gwp == null && x.gbw == null ? null : (x.gwp || 0) + (x.gbw || 0);
        g += fwKreis(X(t), YR(l), f1(tot + (x.ll || 0)) + " kWh", gr == null || !(tot > 0) ? null : Math.min(Math.max(gr / tot, 0), 1)); }
      return g; },
    kopf: (t, b) => { const x = WPF.tage[fwKey(t)]; if (!x) return ""; const ges = (x.wp || 0) + (x.bw || 0) + (x.ll || 0); if (!(ges > 0)) return "";
      const teile = [["WP", x.wp], ["BWWP", x.bw]].concat(x.ll > 0.05 ? [["LLWP", x.ll]] : []);
      if (b >= 60 * teile.length + 40) return teile.map(([n, vv]) => `${n} ${f1(vv)} kWh`).join(" · ");
      if (b >= 150) return teile.map(([n, vv]) => `${n} ${f1(vv)}`).join(" · ") + " kWh";
      return f1(ges) + " kWh"; },
    leiste: (t) => { const x = WPF.tage[fwKey(t)]; if (!x) return []; const gw = Math.min(x.gwp || 0, x.wp || 0), gb = Math.min(x.gbw || 0, x.bw || 0);
      return [{ v: gw, farbe: "#3b82f6" }, { v: (x.wp || 0) - gw, farbe: "#1d4ed8" }, { v: gb, farbe: "#f87171" }, { v: (x.bw || 0) - gb, farbe: "#dc2626" }, { v: x.ll || 0, farbe: "#facc15" }]; },
    tip: (t, { x0, x1 }) => { const tol = (x1 - x0) * 0.012, e0 = WPF.ende.find(([te]) => Math.abs(te - t) < tol);
      if (e0) { const kk = fwKey(e0[0] - 1000), x = WPF.tage[kk] || {}, heute = kk === fwKey(Date.now());
        const ges = (x.wp || 0) + (x.bw || 0) + (x.ll || 0), gr = x.gwp == null && x.gbw == null ? null : (x.gwp || 0) + (x.gbw || 0);
        let h = `<b>${new Date(e0[0] - 1000).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" })}${heute ? " (bis jetzt)" : ""}: ${f1(ges)} kWh</b>`;
        if (gr != null) h += `<br><span style="color:#22c55e">●</span> PV/Akku ${f1(gr)} kWh (${pct(gr, (x.wp || 0) + (x.bw || 0))}) · <span style="color:#ef4444">●</span> Netz ${f1((x.wp || 0) + (x.bw || 0) - gr)} kWh`;
        h += `<br><span style="color:#3b82f6">●</span> WP ${f1(x.wp)} kWh${x.gwp != null ? " · PV/Akku " + pct(x.gwp, x.wp) : ""}`;
        h += `<br><span style="color:#f87171">●</span> BWWP ${f1(x.bw)} kWh${x.gbw != null ? " · PV/Akku " + pct(x.gbw, x.bw) : ""}`;
        if (x.ll > 0.05) h += `<br><span style="color:#facc15">●</span> LLWP ${f1(x.ll)} kWh`;
        return fwBox(h); }
      const at = (a) => { let r = 0; for (const [tt, vv] of a) { if (tt <= t && t < tt + 9e5) r = vv; if (tt > t) break; } return r; };
      const bw = at(WPF.kw.bw), ll = at(WPF.kw.ll), y = wertBei(WPF.kum.filter((p) => p[1] != null), t, 9e5);
      let h = `<b>${new Date(t).toLocaleString("de-DE", { weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}</b>`
        + `<br><span style="color:#3b82f6">●</span> WP ${f1(at(WPF.kw.wp))} kW · <span style="color:#f87171">●</span> BWWP ${f1(bw)} kW${bw > 1 ? " (Heizstab)" : ""}`
        + (ll > 0.05 ? `<br><span style="color:#facc15">●</span> LLWP ${f1(ll)} kW` : "") + (y != null ? `<br><span style="color:#9ca3af">seit 0:00: ${f1(y)} kWh</span>` : "");
      const lauf = (zlSeg.wp || []).find(([a, b]) => t >= a && t <= b);
      if (lauf) { const info = zlLauf.find((x) => x[0] === "wp" && Math.abs(x[1] - lauf[0]) <= 6 * 6e4);
        h += `<hr style="border:0;border-top:1px solid #52525b;margin:5px 0"><b>WP-Lauf ${new Date(lauf[0]).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}–${lauf[2] ? "läuft" : new Date(lauf[1]).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</b>`
          + (info ? `<br>${info[2]}` : ""); }
      return fwBox(h); } });
  fensterZeichnen("wpf");
}
window.addEventListener("resize", () => { for (const id of Object.keys(FW)) fensterZeichnen(id); });

// ---------- „Wann starten?“ (29.09.2026, wie Dashboard) ----------
// Tagesbericht (09.10.2026, Nutzer): Zeile oben aus d.tb (meldet die Druck-Ansicht um 9 Uhr), Bild von 9 Uhr unten (bericht/tagesbericht.png, lädt HA hoch)
function zeigeTagesbericht(d) {
  const tb = d && d.tb, zl = $("tb_zeile"), sek = $("tb_sek"), img = $("tb_bild");
  if (!tb || !tb.d) { if (zl) zl.hidden = true; if (sek) sek.hidden = true; return; }
  const z1 = (v, n) => (v == null ? "–" : zahl(v, n)), esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // Etiketten wie im Dashboard (09.10.2026): Pfeil + % farbig nach gut/schlecht, keine Warnschilder
  const pf = (p, bew) => p == null ? "" : `<i class="${bew > 0 ? "gut" : bew < 0 ? "schl" : "neu"}">${p > 0 ? "▲" : "▼"} ${Math.abs(p)} %</i>`;
  const chips = (tb.etk || []).map(([t, w, p, bew]) => `<span class="et">${esc(t)} <b>${esc(w)}</b>${pf(p, bew)}</span>`).join("")
    + (tb.gas != null ? `<span class="et gasl">💶 <b>+${z1(tb.gas, 2)} €</b></span>` : "");
  zl.innerHTML = `<b class="tz">Gestern ${esc(tb.wt)}</b>${chips}${tb.bf ? `<span class="bf">🔎 ${tb.bf} Befund${tb.bf > 1 ? "e" : ""}</span>` : ""}<span class="pf">›</span>`;
  zl.hidden = false; sek.hidden = false;
  if (!zl.__an) { zl.__an = true; zl.addEventListener("click", () => sek.scrollIntoView({ behavior: "smooth", block: "start" })); }
  const src = "bericht/tagesbericht.png?v=" + encodeURIComponent(tb.d);
  if (img.getAttribute("src") !== src) img.setAttribute("src", src);
}

function zeigeWann(d) {
  // 07.10.2026: Ampel-Karte (lib/vgs_wann.js, dieselbe Datei wie im Dashboard) – Modell aus d.ws / d.af / d.am
  const el = $("wann_karte"); if (!el) return;
  const KEY = [["Wasch", "waschmaschine"], ["Trock", "trockner"], ["Spül", "spulmaschine"]];
  const ICON_N = {waschmaschine: "Waschmaschine", trockner: "Trockner", spulmaschine: "Spülmaschine"};
  const ws = d.ws || [];
  const geraete = KEY.map(([such, k]) => {
    const r = ws.find((x) => String(x[0]).includes(such)) || [];
    const [, st, kj, kb, er, start, , kwh, u0] = r;
    return { k, n: ICON_N[k], zustand: st || "unavailable", laeuft: st === "läuft", seit: null,
      kj, kb, er, start: start ? zeitpunkt(start) : null, kwh, u0 };
  });
  el.modell = { geraete: geraete.map((g) => ({ ...g, i: window.vgsWann ? window.vgsWann.icon(g.k) : "" })),   // Symbolpfade aus der Karte
    fenster: d.af ? { ...d.af, start: zeitpunkt(d.af.start), ende: zeitpunkt(d.af.ende) } : null,
    maxSoc: d.am ? d.am[0] : null, maxZeit: d.am && d.am[1] ? zeitpunkt(d.am[1]) : null };
}

// ---------- Zeitleisten 48 h mit Verschieben über 14 Tage (29.09.2026) ----------
// d.zl = [Kürzel, Unix-s, 1/0] aus dem SQL-Helfer (15 Tage). Oben 48 h, darunter 14-Tage-Leiste: ziehen/tippen verschiebt,
// „Jetzt“ springt zurück. Dämmerung + Sonnenkurve (sonnenhoehe), Mitternacht Linie + Datum mittig, Tooltips per <title>.
const ZL = {
  zeitleiste: [["WP", ["wp"], ["#3b82f6"]], ["BWWP", ["bw", "hz"], ["#f87171", "#dc2626"], ["", " Heizstab"]], ["LLWP", ["ll"], ["#facc15"]]],
  zeitleiste2: [["Waschmaschine", ["wa"], ["#06b6d4"]], ["Trockner", ["tr"], ["#a855f7"]], ["Spülmaschine", ["sp"], ["#22c55e"]], ["Entfeuchter", ["en"], ["#f59e0b"]]],
};
const zlEnde = {};            // Fensterende je Leiste (ms), null = live
let zlSeg = {};               // Kürzel → [[von, bis, läuft]]
let zlLauf = [];              // [Kürzel, Start ms, Text] aus den Lauf-Protokollen (03.10.2026)
const zlInfo = (c, a) => { const c2 = c === 'hz' ? 'bw' : c; const r = zlLauf.find((x) => x[0] === c2 && Math.abs(x[1] - a) <= 6 * 6e4); return r ? '\n' + r[2] : ''; };
// Kurzwert im Balken (08.10.2026, Nutzer, wie Dashboard): WP „AZ x,x“, BWWP „x,x kWh“ aus dem Lauf-Protokoll
const zlKurz = (c, a) => { if (c !== 'wp' && c !== 'bw') return ''; const r = zlLauf.find((x) => x[0] === c && Math.abs(x[1] - a) <= 6 * 6e4); if (!r) return '';
  const m = c === 'wp' ? /AZ (-?[\d,.]+)/.exec(r[2]) : /^(-?[\d,.]+) kWh/.exec(r[2]); if (!m) return '';
  const v = parseFloat(m[1].replace(',', '.')); return isFinite(v) ? (c === 'wp' ? 'AZ ' : '') + v.toFixed(1).replace('.', ',') + (c === 'wp' ? '' : ' kWh') : ''; };
// Kurzfazit zum Wärmebild (03.10.2026): d.ft = Markdown-Text aus sensor.fbh_kurzfazit (**fett**, <small>, Absätze)
function zeigeFazit(d) {
  const el = $("fbh_fazit"); if (!el) return; const t = d.ft || "";
  el.hidden = !t; if (!t) return;
  const sicher = escH(t).replace(/&lt;small&gt;/g, "<small>").replace(/&lt;\/small&gt;/g, "</small>");
  el.innerHTML = sicher.split(/\n\s*\n/).map((p) => "<p>" + p.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>") + "</p>").join("");
}

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
    // Aussetzer < 2 min (Template-Reload, kurz „nicht verfügbar“) überbrücken – sonst zerfällt ein Lauf in Stücke
    // mit sichtbaren Nahtstrichen (30.09.2026, wie im Dashboard)
    const m = [];
    for (const g of seg[c]) { const l = m[m.length - 1]; if (l && g[0] - l[1] < 12e4) { l[1] = g[1]; l[2] = g[2]; } else m.push(g.slice()); }
    seg[c] = m;
  }
  zlSeg = seg; window.__zlSonne = d.sn;
  // Lauf-Infos (03.10.2026): d.lr = [Kürzel, „TT.MM. HH:MM“, Text] → Tooltip des passenden Balkens (Start ±6 min)
  zlLauf = (d.lr || []).map(([c, s, txt]) => { const m = /^(\d+)\.(\d+)\. (\d+):(\d+)/.exec(s || ""); if (!m) return null;
    const j = new Date().getFullYear(), t0 = new Date(j, +m[2] - 1, +m[1], +m[3], +m[4]).getTime();
    return [c, t0 > Date.now() + 864e5 ? new Date(j - 1, +m[2] - 1, +m[1], +m[3], +m[4]).getTime() : t0, txt]; }).filter(Boolean);
  for (const id of Object.keys(ZL)) if ($(id)) zeichneZL(id);
}
// Sonnenhöhe in Grad (Näherung ±0,5°) – Ort grob München, bewusst ohne genaue Adresse
function sonnenhoehe(t) {
  const R = Math.PI / 180, LAT = 48.14 * R, LON = 11.58, n = (t - 946728000000) / 864e5;
  const L = (280.46 + 0.9856474 * n) * R, G = (357.528 + 0.9856003 * n) * R;
  const la = L + (1.915 * Math.sin(G) + 0.02 * Math.sin(2 * G)) * R, ep = (23.439 - 4e-7 * n) * R;
  const ra = Math.atan2(Math.cos(ep) * Math.sin(la), Math.cos(la)), de = Math.asin(Math.sin(ep) * Math.sin(la));
  const H = ((18.697374558 + 24.06570982441908 * n) * 15 + LON) * R - ra;
  return Math.asin(Math.sin(LAT) * Math.sin(de) + Math.cos(LAT) * Math.cos(de) * Math.cos(H)) / R;
}
// Gemeinsamer Rahmen der Zeitleisten (29.09.2026): Dämmerung + Sonnenkurve bzw. Stunden, Mitternacht, Datum, Jetzt-Linie
function zlHimmel(id, x0, ende, L, R, T, y2, X, hm) {
  let svg = "";
  // Dämmerung + Sonnenkurve (29.09.2026, wie Dashboard): Hintergrund weich nach Sonnenhöhe (−6°…+6°), darüber Band mit der Sonnenhöhe
  const N = Math.min(400, Math.max(40, Math.round((R - L) / 4))), pts = [];
  let stops = "";
  for (let i = 0; i <= N; i++) { const t = x0 + (ende - x0) * i / N, h = sonnenhoehe(t); pts.push([X(t), h]);
    const b = Math.min(Math.max((h + 6) / 12, 0), 1), s = b * b * (3 - 2 * b);
    const c = [20 + (42 - 20) * s, 27 + (62 - 27) * s, 54 + (104 - 54) * s].map(Math.round);
    stops += `<stop offset="${(i / N).toFixed(4)}" stop-color="rgb(${c})" stop-opacity="1"/>`; }
  svg += `<defs><linearGradient id="${id}_dd" x1="0" x2="1" y1="0" y2="0">${stops}</linearGradient></defs>`;
  svg += `<rect x="${L}" y="${T - 10}" width="${R - L}" height="${y2 - T + 10}" fill="url(#${id}_dd)"/>`;   // ab Horizontlinie, ohne Lücke
  const Y0 = T - 10, SY = (h) => Y0 - Math.max(h, 0) / 65 * 16;
  svg += `<line x1="${L}" x2="${R}" y1="${Y0}" y2="${Y0}" stroke="#e5e7eb" stroke-opacity="0.15"/>`;
  svg += `<path d="M${pts[0][0].toFixed(1)} ${Y0}${pts.map(([x, h]) => `L${x.toFixed(1)} ${SY(h).toFixed(1)}`).join("")}L${pts[pts.length - 1][0].toFixed(1)} ${Y0}Z" fill="#facc15" fill-opacity="0.28" stroke="#fbbf24" stroke-width="1.2" stroke-opacity="0.8" stroke-linejoin="round"/>`;
  const tagB = (R - L) / Math.max((ende - x0) / 864e5, 0.01), kurz = tagB < 180;   // Auf-/Untergangszeit ab 110 px je Tag (03.10.2026, wie Dashboard), schmal ohne ☀
  if (tagB >= 110)
    for (let i = 1; i < pts.length; i++) { const [xa, ha] = pts[i - 1], [xb, hb] = pts[i]; if ((ha < 0) === (hb < 0)) continue;
      const x = xa + (xb - xa) * ha / (ha - hb), auf = hb >= 0, t = x0 + (x - L) / (R - L) * (ende - x0);
      svg += `<text x="${x + (auf ? -4 : 4)}" y="${Y0 - 2}" fill="#fbbf24" fill-opacity="0.85" font-size="${kurz ? 9 : 10}" text-anchor="${auf ? "end" : "start"}">${auf ? (kurz ? "↑" : "☀↑ ") : ""}${hm(t)}${auf ? "" : (kurz ? "↓" : " ↓")}</text>`; }
  return svg;
}
function zlAchse(x0, ende, L, R, T, y2, schmal, X, tg) {
  let svg = ""; const jetzt = Date.now();
  // Stundenraster passend zur Fensterbreite (30.09.2026: Fenster jetzt 3 h … 14 Tage): Abstand ≥ 45 px (schmal 50 px), ab 24 h nur Datum
  const pxh = (R - L) / Math.max((ende - x0) / 36e5, 0.1), sh = [1, 2, 3, 6, 12, 24].find((h) => h * pxh >= (schmal ? 50 : 45)) || 24;
  const schritt = sh * 36e5, t = new Date(x0); t.setMinutes(0, 0, 0); t.setHours(Math.ceil(t.getHours() / sh) * sh);
  for (let v = t.getTime(); sh < 24 && v <= ende; v += schritt) { const h = new Date(v).getHours();
    svg += `<line x1="${X(v)}" x2="${X(v)}" y1="${y2 - 4}" y2="${y2 + 2}" stroke="#6b7280"/><text x="${X(v)}" y="${y2 + 18}" fill="#9ca3af" font-size="${schmal ? 11 : 12}" text-anchor="middle">${String(h).padStart(2, "0")}:00</text>`; }
  const mn = new Date(x0); mn.setHours(24, 0, 0, 0);
  for (let v = mn.getTime(); v < ende; v += 864e5) svg += `<line x1="${X(v)}" x2="${X(v)}" y1="${T - 26}" y2="${y2}" stroke="#e5e7eb" stroke-width="1.2" opacity="0.8"/>`;
  for (let t0 = mn.getTime() - 864e5; t0 < ende; t0 += 864e5) { const a = Math.max(t0, x0), b = Math.min(t0 + 864e5, ende);
    if (X(b) - X(a) >= 70) svg += `<text x="${(X(a) + X(b)) / 2}" y="${T - 30}" fill="#e5e7eb" font-size="12" font-weight="700" text-anchor="middle">${tg(t0 + 432e5)}</text>`;
    else if (X(b) - X(a) >= 22) svg += `<text x="${(X(a) + X(b)) / 2}" y="${T - 30}" fill="#e5e7eb" font-size="11" font-weight="700" text-anchor="middle">${new Date(t0 + 432e5).getDate()}.</text>`; }
  if (ende >= jetzt - 6e4) svg += `<line x1="${X(jetzt)}" x2="${X(jetzt)}" y1="${T - 4}" y2="${y2}" stroke="#9ca3af" stroke-dasharray="4 4"/>`;
  return svg;
}
// Doppeltippen/-klicken = Standardansicht (30.09.2026): Maus + Touch (iOS feuert bei Touch kein dblclick), Zeit aus ev.timeStamp
function doppel(e, fn) { let t0 = 0, x0 = 0, xd = 0;
  e.addEventListener("pointerdown", (ev) => { xd = ev.clientX; });
  e.addEventListener("pointerup", (ev) => { if (Math.abs(ev.clientX - xd) > 8) { t0 = 0; return; } const t = ev.timeStamp || Date.now();
    if (t - t0 < 450 && Math.abs(ev.clientX - x0) < 30) { t0 = 0; fn(); } else { t0 = t; x0 = ev.clientX; } });
  e.addEventListener("dblclick", fn); }
// gelbe Griffe links/rechts am Rahmen = Leiste ist zoombar (wie Videoschnitt bei Apple)
const griffe = (xa, xb, h) => `<rect x="${xa - 3.5}" y="0" width="7" height="${h + 4}" rx="2" fill="#facc15"/><rect x="${xb - 3.5}" y="0" width="7" height="${h + 4}" rx="2" fill="#facc15"/>`
  + `<line x1="${xa}" x2="${xa}" y1="${h / 2 - 4}" y2="${h / 2 + 8}" stroke="#1c1c1c" stroke-width="1.4"/><line x1="${xb}" x2="${xb}" y1="${h / 2 - 4}" y2="${h / 2 + 8}" stroke="#1c1c1c" stroke-width="1.4"/>`;

// ---------- Mouse-over (30.09.2026) ----------
// Sofort sichtbar (Maus) bzw. per Antippen (iPhone). SVG-<title> werden automatisch in data-tip umgebaut (der Browser-Tooltip
// käme erst nach ~1 s und am iPhone nie). Kurven mit kreuz(): senkrechte Linie + alle Werte zu diesem Zeitpunkt.
const TIP = document.createElement("div"); TIP.id = "tip"; document.body.appendChild(TIP);
let tipUhr = null;
const escH = (t) => t.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
function tipZeig(html, cx, cy, dauer) {
  TIP.innerHTML = html; TIP.style.display = "block"; const w = TIP.offsetWidth, h = TIP.offsetHeight;
  TIP.style.left = Math.min(Math.max(cx - w / 2, 6), window.innerWidth - w - 6) + "px";
  TIP.style.top = (cy - h - 16 < 6 ? cy + 20 : cy - h - 16) + "px";
  clearTimeout(tipUhr); if (dauer) tipUhr = setTimeout(tipWeg, dauer); }
function tipWeg() { TIP.style.display = "none"; clearTimeout(tipUhr); document.querySelectorAll(".kz-linie").forEach((l) => l.remove()); }
function titelUmbau(n) {
  const l = n.tagName === "title" ? [n] : (n.querySelectorAll ? n.querySelectorAll("title") : []);
  for (const t of l) { const p = t.parentNode; if (!p || !p.closest || !p.closest("svg")) continue;
    p.setAttribute("data-tip", escH(t.textContent).replace(/\n/g, "<br>")); t.remove(); } }
new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) titelUmbau(n); })
  .observe(document.body, { childList: true, subtree: true });
titelUmbau(document.body);
const tipZiel = (ev) => { const e = document.elementFromPoint(ev.clientX, ev.clientY); return e && e.closest ? e.closest("[data-tip]") : null; };
const kzZiel = (ev) => { const e = document.elementFromPoint(ev.clientX, ev.clientY), s = e && e.closest ? e.closest("svg") : null; return s && s.__kz ? s : null; };
document.addEventListener("pointermove", (ev) => { if (ev.pointerType !== "mouse" || ev.buttons) return;
  const k = kzZiel(ev); if (k) { kreuzZeig(k, ev); return; }
  document.querySelectorAll(".kz-linie").forEach((l) => l.remove());
  const e = tipZiel(ev); if (e) tipZeig(e.getAttribute("data-tip"), ev.clientX, ev.clientY); else if (TIP.style.display === "block") tipWeg(); }, { passive: true });
let tipDown = null;
document.addEventListener("pointerdown", (ev) => { tipDown = [ev.clientX, ev.clientY]; }, { passive: true, capture: true });
document.addEventListener("pointerup", (ev) => { if (ev.pointerType === "mouse" || !tipDown) return;
  if (Math.hypot(ev.clientX - tipDown[0], ev.clientY - tipDown[1]) > 10) return;   // gezogen/gewischt → kein Tooltip
  // 08.10.2026 (Nutzer): Tippen = Tooltip auf, nochmal tippen = zu (statt nach 6 s von selbst weg)
  if (TIP.style.display === "block") { tipWeg(); return; }
  const k = kzZiel(ev); if (k) { kreuzZeig(k, ev); return; }
  const e = tipZiel(ev); if (e) tipZeig(e.getAttribute("data-tip"), ev.clientX, ev.clientY); else tipWeg(); }, { passive: true, capture: true });
window.addEventListener("scroll", () => { if (TIP.style.display === "block") tipWeg(); }, { passive: true });

// Fadenkreuz für Zeitkurven: cfg = {L, R, T, B, x0, x1, reihen: [{n, f, p: [[ms, Wert]], e, d, gap}]}
function kreuz(el, cfg) { el.__kz = cfg; }
function wertBei(p, t, gap) {
  if (!p || !p.length) return null; let lo = 0, hi = p.length - 1;
  if (t < p[0][0] - gap || t > p[hi][0] + gap) return null;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m][0] <= t) lo = m; else hi = m; }
  const a = p[lo], b = p[hi];
  if (t <= a[0]) return t >= a[0] - gap ? a[1] : null; if (t >= b[0]) return t <= b[0] + gap ? b[1] : null;
  if (b[0] - a[0] > gap * 2) return Math.abs(t - a[0]) <= gap ? a[1] : (Math.abs(b[0] - t) <= gap ? b[1] : null);
  if (a[1] === null || b[1] === null) return a[1] ?? b[1];
  return a[1] + (b[1] - a[1]) * (t - a[0]) / (b[0] - a[0]); }
function kreuzZeig(el, ev, dauer) {
  const c = el.__kz, pt = el.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const q = pt.matrixTransform(el.getScreenCTM().inverse());
  if (q.x < c.L || q.x > c.R || q.y < c.T - 10 || q.y > c.B + 10) { tipWeg(); return; }
  const t = c.x0 + (q.x - c.L) / (c.R - c.L) * (c.x1 - c.x0), dt = new Date(t);
  if (c.html) { const h = c.html(t); if (!h) { tipWeg(); return; }   // Fenster-Grafiken (03.10.2026): eigener Tooltip-Inhalt
    let l = el.querySelector(".kz-linie"); if (!l) { l = document.createElementNS("http://www.w3.org/2000/svg", "line"); l.setAttribute("class", "kz-linie"); el.appendChild(l); }
    for (const [k, v] of [["x1", q.x], ["x2", q.x], ["y1", c.T], ["y2", c.B], ["stroke", "#e5e7eb"], ["stroke-width", "1.2"], ["stroke-dasharray", "3 3"], ["pointer-events", "none"]]) l.setAttribute(k, v);
    tipZeig(h, ev.clientX, ev.clientY, dauer); return; }
  const kopf = `${["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}. ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  const z = c.reihen.map((r) => [r, wertBei(r.p, t, r.gap || 45 * 6e4)]).filter(([, v]) => v !== null && !isNaN(v));
  if (!z.length) { tipWeg(); return; }
  let l = el.querySelector(".kz-linie"); if (!l) { l = document.createElementNS("http://www.w3.org/2000/svg", "line"); l.setAttribute("class", "kz-linie"); el.appendChild(l); }
  for (const [k, v] of [["x1", q.x], ["x2", q.x], ["y1", c.T], ["y2", c.B], ["stroke", "#e5e7eb"], ["stroke-width", "1.2"], ["stroke-dasharray", "3 3"], ["pointer-events", "none"]]) l.setAttribute(k, v);
  tipZeig(`<b>${kopf}</b>` + z.map(([r, v]) => `<br><span style="color:${r.f}">●</span> ${r.n}: <b>${zahl(v, r.d ?? 1)}</b> ${r.e || ""}`).join(""), ev.clientX, ev.clientY, dauer); }

// Übersichtsleiste mit weißem Rahmen + gelben Griffen (zoombar), gemeinsam für Tagesbalken und Stromherkunft (30.09.2026).
// c = {lo, hi, a, b, minw, UH, inhalt(UX, UW, UH) → SVG, setze(a, b), std()}. Rahmen ziehen = verschieben, Griffe = zoomen,
// daneben tippen = springen, Doppelklick/-tippen = Standard.
function leiste(u, c) {
  const UW = Math.max(Math.round(u.getBoundingClientRect().width) || 1000, 300), UH = c.UH || 26;
  u.setAttribute("viewBox", `0 0 ${UW} ${UH + 18}`);
  const UX = (v) => 8 + (v - c.lo) / (c.hi - c.lo) * (UW - 16), xa = UX(c.a), xb = UX(c.b);
  u.innerHTML = `<rect x="8" y="2" width="${UW - 16}" height="${UH}" rx="3" fill="#27272a"/>` + c.inhalt(UX, UW, UH)
    + `<rect x="${xa}" y="1" width="${Math.max(xb - xa, 2)}" height="${UH + 2}" rx="3" fill="#e5e7eb" fill-opacity="0.12" stroke="#e5e7eb" stroke-width="1.5"/>` + griffe(xa, xb, UH);
  u.__c = c; u.__UW = UW;
  if (u.__an) return; u.__an = true; u.style.touchAction = "none"; u.style.cursor = "pointer";
  let gm = null;
  const lage = (ev) => { const c = u.__c, W = u.__UW, r = u.getBoundingClientRect();
    const zt = (x) => c.lo + ((x - r.left) / r.width * W - 8) / (W - 16) * (c.hi - c.lo), xt = (v) => r.left + (8 + (v - c.lo) / (c.hi - c.lo) * (W - 16)) / W * r.width;
    return { t: zt(ev.clientX), a: c.a, b: c.b, xa: xt(c.a), xb: xt(c.b), tol: ev.pointerType === "touch" ? 18 : 8 }; };
  const setzeW = (a, b) => { u.__neu = [a, b]; if (!u.__raf) u.__raf = requestAnimationFrame(() => { u.__raf = null; u.__c.setze(...u.__neu); }); };
  u.addEventListener("pointerdown", (ev) => { const q = lage(ev), mitte = (q.xa + q.xb) / 2, eng = q.xb - q.xa < 3 * q.tol;
    if (Math.abs(ev.clientX - q.xa) <= q.tol && (!eng || ev.clientX < mitte)) gm = { m: "l" };
    else if (Math.abs(ev.clientX - q.xb) <= q.tol) gm = { m: "r" };
    else if (ev.clientX > q.xa && ev.clientX < q.xb) gm = { m: "m", off: q.t - q.a, w: q.b - q.a };
    else { const w = q.b - q.a; gm = { m: "m", off: w / 2, w }; setzeW(q.t - w / 2, q.t + w / 2); }
    try { u.setPointerCapture(ev.pointerId); } catch (e) {} });
  u.addEventListener("pointermove", (ev) => { const q = lage(ev), mw = u.__c.minw;
    if (!gm) { u.style.cursor = Math.abs(ev.clientX - q.xa) <= q.tol || Math.abs(ev.clientX - q.xb) <= q.tol ? "ew-resize" : (ev.clientX > q.xa && ev.clientX < q.xb ? "grab" : "pointer"); return; }
    if (gm.m === "l") setzeW(Math.min(q.t, q.b - mw), q.b); else if (gm.m === "r") setzeW(q.a, Math.max(q.t, q.a + mw)); else setzeW(q.t - gm.off, q.t - gm.off + gm.w); });
  u.addEventListener("pointerup", () => { gm = null; }); u.addEventListener("pointercancel", () => { gm = null; });
  doppel(u, () => { if (u.__raf) { cancelAnimationFrame(u.__raf); u.__raf = null; } u.__c.std(); }); }

function zeichneZL(id) {
  const Q = ZL[id], jetzt = Date.now(), ende = zlEnde[id] ?? jetzt, x0 = ende - 48 * 36e5;
  const svgEl = $(id), W = Math.max(Math.round(svgEl.getBoundingClientRect().width) || 1000, 300), schmal = W < 600;
  const H = 34, T = 48, hoehe = T + Q.length * (H + 10) + 26;
  svgEl.setAttribute("viewBox", `0 0 ${W} ${hoehe}`);
  const L = 8, R = W - 8, X = (t) => L + (t - x0) / (ende - x0) * (R - L), y2 = T + Q.length * (H + 10);
  const hm = (t) => new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const tg = (t) => new Date(t).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  const dau = (ms) => { const m = Math.round(ms / 6e4); return m >= 60 ? Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") + " min" : m + " min"; };
  let svg = "";
  svg += zlHimmel(id, x0, ende, L, R, T, y2, X, hm);
  Q.forEach(([name, codes, farben, zus], i) => {
    const y = T + i * (H + 10);
    svg += `<line x1="${L}" x2="${R}" y1="${y + H / 2}" y2="${y + H / 2}" stroke="#6b7280" stroke-width="1"/>`;   // dünne Linie je Zeile statt grauer Spur
    codes.forEach((c, k) => {
      for (const [a, b, lauf] of zlSeg[c] || []) {
        if (b <= x0 || a >= ende) continue;
        const aa = Math.max(a, x0), bb = Math.min(b, ende);
        // Tooltip (08.10.2026, Nutzer): Kennzahl (WP AZ, BWWP kWh) fett weiß auf schwarz in der Kopfzeile statt im Balken
        const kz = lauf ? '' : zlKurz(c, a);
        let info = lauf ? '' : zlInfo(c, a).replace(/^\n/, '');
        if (kz && c === 'wp') info = info.replace(/ · AZ -?[\d,.]+/, ''); else if (kz && c === 'bw') info = info.replace(/^-?[\d,.]+ kWh( · )?/, '');
        const tipH = `<b>${escH(name + (zus ? zus[k] : ""))}</b> ${tg(a)} ${hm(a)}–${lauf ? "läuft" : hm(b)} (${dau(b - a)})`
          + (kz ? ` <b style="color:#fff;background:#000;border:1px solid #52525b;padding:0 6px;border-radius:4px;margin-left:4px;white-space:nowrap">${kz}</b>` : "")
          + (info ? `<br><span style="color:#9ca3af">${escH(info)}</span>` : "");
        svg += `<rect x="${X(aa)}" y="${y + 6}" width="${Math.max(X(bb) - X(aa), 1.5)}" height="${H - 12}" fill="${farben[k]}" data-tip="${tipH.replace(/"/g, "&quot;")}"></rect>`;
      }
    });
  });
  svg += zlAchse(x0, ende, L, R, T, y2, schmal, X, tg);
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
    if (!u.__zl) { u.__zl = true; let off = null;   // 30.09.2026: im Rahmen ziehen = verschieben, daneben tippen = dorthin springen
      const zeit = (ev) => { const r = u.getBoundingClientRect(), j2 = Date.now(), v0 = j2 - 14 * 864e5; return v0 + ((ev.clientX - r.left) / r.width * UW - 8) / (UW - 16) * (j2 - v0); };
      const setze = (e2) => { const j2 = Date.now(), erst = Math.min(...Object.values(zlSeg).flat().map((s) => s[0]), j2);
        e2 = Math.min(Math.max(e2, j2 - 13 * 864e5, erst + 48 * 36e5), j2); zlEnde[id] = e2 >= j2 - 30 * 6e4 ? null : e2;
        const b = $(id + "_jetzt"); if (b) b.hidden = zlEnde[id] === null;
        if (!u.__raf) u.__raf = requestAnimationFrame(() => { u.__raf = null; zeichneZL(id); }); };
      u.addEventListener("pointerdown", (ev) => { const tt = zeit(ev), e = zlEnde[id] ?? Date.now();
        if (tt >= e - 48 * 36e5 && tt <= e) off = e - tt; else { off = 24 * 36e5; setze(tt + off); }
        try { u.setPointerCapture(ev.pointerId); } catch (e) {} });
      u.addEventListener("pointermove", (ev) => { if (off !== null) { const e = zlEnde[id] ?? Date.now(), n = zeit(ev) + off; if (Math.abs(n - e) > 6e4) setze(n); } });
      u.addEventListener("pointerup", () => { off = null; }); u.addEventListener("pointercancel", () => { off = null; });
      doppel(u, () => { if (u.__raf) { cancelAnimationFrame(u.__raf); u.__raf = null; } zlEnde[id] = null; const b = $(id + "_jetzt"); if (b) b.hidden = true; zeichneZL(id); }); }
  }
  if (id === "zeitleiste2") try { fwTorteFremd(id, GER_TORTE, x0, Math.min(ende, Date.now())); } catch (e) { console.warn("ger-torte", e); }
  // Ziehen/Wischen im Feld verschiebt das Fenster (29.09.2026), begrenzt auf Datenbeginn und jetzt
  if (!svgEl.__zl) {
    svgEl.__zl = true; svgEl.style.touchAction = "pan-y"; svgEl.style.cursor = "grab"; let dr = null;
    svgEl.addEventListener("pointerdown", (ev) => { dr = { x: ev.clientX, ende: zlEnde[id] ?? Date.now(), moved: false }; try { svgEl.setPointerCapture(ev.pointerId); } catch (e) {} });
    svgEl.addEventListener("pointermove", (ev) => { if (!dr) return; const dx = ev.clientX - dr.x; if (Math.abs(dx) > 5) dr.moved = true; if (!dr.moved) return;
      const breite = svgEl.getBoundingClientRect().width - 16, jetzt2 = Date.now();
      const erst = Math.min(...Object.values(zlSeg).flat().map((s) => s[0]), jetzt2);
      const e2 = Math.min(Math.max(dr.ende - dx / breite * 48 * 36e5, erst + 48 * 36e5, jetzt2 - 14 * 864e5), jetzt2);
      zlEnde[id] = e2 >= jetzt2 - 6e4 ? null : e2; const b = $(id + "_jetzt"); if (b) b.hidden = zlEnde[id] === null;
      if (!svgEl.__raf) svgEl.__raf = requestAnimationFrame(() => { svgEl.__raf = null; zeichneZL(id); }); });
    const aus = () => { dr = null; };
    svgEl.addEventListener("pointerup", aus); svgEl.addEventListener("pointercancel", aus);
    doppel(svgEl, () => { if (svgEl.__raf) { cancelAnimationFrame(svgEl.__raf); svgEl.__raf = null; } zlEnde[id] = null; const b = $(id + "_jetzt"); if (b) b.hidden = true; zeichneZL(id); });
    const b = $(id + "_jetzt"); if (b) b.addEventListener("click", () => { zlEnde[id] = null; b.hidden = true; zeichneZL(id); });
  }
}


// ---------- Woher kommt der Strom (29.09.2026) ----------
// d.hk = 10-min-Mittel 48 h [Unix-s, Haus W, Akku W (+ = laden), Netz W (+ = Bezug)]. Oben Anteile PV/Akku/Netz am Haus,
// unten Akku lädt / Einspeisung. Gleicher Rahmen wie die Zeitleisten (Dämmerung, Sonnenkurve), Tooltips per <title>.
const HK_F = { pv: "#facc15", akku: "#3b82f6", netz: "#f97316", laden: "#93c5fd", einsp: "#22c55e" };
let hkDaten = [];
function zeigeHerkunft(d) {
  // wie Dashboard: gleitendes 30-min-Mittel (3 × 10 min), Anteile < 8 % weg, Rest auf 5 % gerundet; unten erst ab 150 W
  const roh = (d.hk || []).slice().sort((x, y) => x[0] - y[0]);
  hkDaten = roh.map((v, i) => {
    const f = roh.filter((w, j) => Math.abs(j - i) <= 1 && Math.abs(w[0] - v[0]) <= 600);
    const mw = (k) => f.reduce((x, w) => x + (w[k] || 0), 0) / f.length;
    const h = Math.max(mw(1), 0), batt = mw(2), netz = mw(3), pvg = Math.max(mw(4), 0);
    // Aufteilung wie packages/haus_herkunft.yaml (04.10.2026): Akku = Rest nach PV, also AC-seitig nach Wandlerverlust
    const n = Math.min(Math.max(netz, 0), h), lad = Math.max(batt, 0), na = Math.min(Math.max(netz - h, 0), lad);
    const pvh = Math.min(h - n, Math.max(pvg - (lad - na) - Math.max(-netz, 0), 0));
    let q = [pvh, Math.max(h - n - pvh, 0), n]; const s = q[0] + q[1] + q[2];
    if (s > 0) { q = q.map((x) => (x / s < 0.08 ? 0 : x)); const s2 = q.reduce((x, y) => x + y, 0) || 1; q = q.map((x) => Math.round(x / s2 * 20) / 20 * s); }
    const laden = batt >= 150 ? batt : 0, einsp = -netz >= 150 ? -netz : 0;
    return [v[0] * 1000, q[0], q[1], q[2], laden, einsp, h, pvg, v[5] ? 36e5 : 6e5];   // ältere Tage Stundenmittel (30.09.2026)
  });
  if ($("herkunft")) zeichneHK();
}
function zeichneHK() {
  const svgEl = $("herkunft"), W = Math.max(Math.round(svgEl.getBoundingClientRect().width) || 1000, 300), schmal = W < 600;
  // blätterbar (30.09.2026): 14 Tage geladen, Standard 48 h bis jetzt; Leiste darunter mit Griffen, Ziehen im Feld, Doppeltippen = Standard
  const jetzt = Date.now(), lo = hkDaten.length ? Math.min(hkDaten[0][0], jetzt - 48 * 36e5) : jetzt - 48 * 36e5, hw = window.__hkWin || { live: true, br: 48 * 36e5 };
  const br = Math.min(Math.max(hw.br, 3 * 36e5), jetzt - lo), ende = hw.live ? jetzt : Math.min(Math.max(hw.bis, lo + br), jetzt), x0 = ende - br;
  window.__hkX = [x0, ende, lo];
  const T = 48, y2 = T + 88, L = 8, R = W - 8;
  svgEl.setAttribute("viewBox", `0 0 ${W} ${y2 + 26}`);
  const X = (t) => L + (t - x0) / (ende - x0) * (R - L);
  const hm = (t) => new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const tg = (t) => new Date(t).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  const kw = (w) => (w / 1000).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kW";
  const L1 = [T + 6, T + 28], L2 = [T + 50, T + 72], p =   // gleich dick wie die anderen Zeitleisten
    { pv: "", akku: "", netz: "", laden: "", einsp: "" };
  let svg = zlHimmel("herkunft", x0, ende, L, R, T, y2, X, hm), tips = "";
  for (const [y0, y1] of [L1, L2]) svg += `<line x1="${L}" x2="${R}" y1="${(y0 + y1) / 2}" y2="${(y0 + y1) / 2}" stroke="#6b7280" stroke-width="1"/>`;
  const r = (k, a, b, y0, y1) => { if (y1 - y0 > 0.2) p[k] += `M${a.toFixed(1)} ${y0.toFixed(1)}H${b.toFixed(1)}V${y1.toFixed(1)}H${a.toFixed(1)}Z`; };
  for (const [t, pv, akku, netz, laden, einsp, haus, pvg, dur] of hkDaten) {
    if (t + dur < x0 || t > ende) continue;
    const a = Math.max(X(t), L), b = Math.min(X(t + dur) + 0.6, R); if (b <= a) continue;
    const s = pv + akku + netz;
    if (s > 20) { let y = L1[1]; for (const [k, v] of [["pv", pv], ["akku", akku], ["netz", netz]]) { const dy = v / s * (L1[1] - L1[0]); r(k, a, b, y - dy, y); y -= dy; } }
    const u = laden + einsp;
    if (u > 0) { let y = L2[1]; for (const [k, v] of [["laden", laden], ["einsp", einsp]]) { const dy = v / u * (L2[1] - L2[0]); r(k, a, b, y - dy, y); y -= dy; } }
    const pz = (v) => (s > 0 ? " (" + Math.round(v / s * 100) + " %)" : "");
    tips += `<rect x="${a}" y="${L1[0]}" width="${b - a}" height="${L2[1] - L1[0]}" fill="transparent"><title>${tg(t)} ${hm(t)} · Haus ${kw(haus)}\nPV ${kw(pv)}${pz(pv)} · Akku ${kw(akku)}${pz(akku)} · Netz ${kw(netz)}${pz(netz)}${laden > 0 ? "\nAkku lädt " + kw(laden) + " (aus " + (pvg >= laden * 0.8 ? "PV" : pvg > 100 ? "PV + Netz" : "Netz") + ", PV gesamt " + kw(pvg) + ")" : ""}${einsp > 0 ? "\nEinspeisung " + kw(einsp) : ""}\n${dur > 6e5 ? "Stundenmittel" : "30-min-Mittel"}</title></rect>`;
  }
  for (const k of Object.keys(p)) if (p[k]) svg += `<path d="${p[k]}" fill="${HK_F[k]}" shape-rendering="crispEdges"/>`;
  svg += zlAchse(x0, ende, L, R, T, y2, schmal, X, tg) + tips;
  svgEl.innerHTML = svg;
  const hkSetze = (a, b) => { const j = Date.now(); window.__hkWin = { live: b >= j - 6e4, br: b - a, bis: b }; zeichneHK(); };
  const hkStd = () => { window.__hkWin = { live: true, br: 48 * 36e5 }; zeichneHK(); };
  try { fwTorteFremd("herkunft", HK_TORTE, x0, Math.min(ende, Date.now())); } catch (e) { console.warn("hk-torte", e); }
  let u = $("herkunft_ueb");
  if (!u) { u = document.createElementNS("http://www.w3.org/2000/svg", "svg"); u.id = "herkunft_ueb"; u.setAttribute("class", "zeitleiste zl-ueb");
    u.style.cssText = "display:block;width:100%;height:auto;margin-top:4px"; svgEl.after(u);
    // Ziehen im Feld verschiebt (wie Zeitleisten), Doppeltippen = Standard
    svgEl.style.touchAction = "pan-y"; svgEl.style.cursor = "grab"; let dr = null;
    svgEl.addEventListener("pointerdown", (ev) => { const [a, b] = window.__hkX; dr = { x: ev.clientX, a, b, moved: false }; });
    svgEl.addEventListener("pointermove", (ev) => { if (!dr) return; const dx = ev.clientX - dr.x; if (Math.abs(dx) > 5) dr.moved = true; if (!dr.moved) return;
      const r = svgEl.getBoundingClientRect(), k = (dr.b - dr.a) / (r.width - 16), lo2 = window.__hkX[2], j = Date.now();
      let b = Math.min(Math.max(dr.b - dx * k, lo2 + (dr.b - dr.a)), j); window.__hkWin = { live: b >= j - 6e4, br: dr.b - dr.a, bis: b };
      if (!svgEl.__raf) svgEl.__raf = requestAnimationFrame(() => { svgEl.__raf = null; zeichneHK(); }); });
    const aus = () => { dr = null; }; svgEl.addEventListener("pointerup", aus); svgEl.addEventListener("pointercancel", aus); svgEl.addEventListener("pointerleave", aus);
    doppel(svgEl, () => { if (svgEl.__raf) { cancelAnimationFrame(svgEl.__raf); svgEl.__raf = null; } hkStd(); }); }
  leiste(u, { lo, hi: jetzt, a: x0, b: ende, minw: 3 * 36e5, UH: 24,
    inhalt: (UX, UW, UH) => { let g = "";
      for (const [t, pv, akku, netz, , , , , dur] of hkDaten) { const s = pv + akku + netz; if (s <= 20) continue; const x = UX(t), w = Math.max(UX(t + dur) - x, 0.8); let y = UH + 1;
        for (const [k, v] of [["pv", pv], ["akku", akku], ["netz", netz]]) { const dy = v / s * (UH - 4); if (dy > 0.2) g += `<rect x="${x.toFixed(1)}" y="${(y - dy).toFixed(1)}" width="${w.toFixed(1)}" height="${dy.toFixed(1)}" fill="${HK_F[k]}"/>`; y -= dy; } }
      for (let v = new Date(lo).setHours(24, 0, 0, 0); v < jetzt; v += 864e5) { const dt = new Date(v);
        g += `<line x1="${UX(v)}" x2="${UX(v)}" y1="2" y2="${UH + 2}" stroke="#18181b" stroke-width="1"/>`;
        if (UW > 600 || dt.getDate() % 2 === 0) g += `<text x="${UX(v + 432e5)}" y="${UH + 15}" fill="#9ca3af" font-size="10" text-anchor="middle">${dt.getDate()}.${dt.getMonth() + 1}.</text>`; }
      return g; },
    setze: hkSetze, std: hkStd });
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
  // Kurve (30.09.2026: blätterbar −4 … +7 Tage, Standard vorgestern … übermorgen; Ziehen im Feld / Tagesleiste darunter,
  // Doppelklick = Standard). Messwerte durchgezogen, Prognosen ab jetzt kräftig gestrichelt, Vergangenheit blass.
  window.__progD = d;
  const W = 1000, H = 330, L = 44, R = 956, T = 12, B = 290;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const LO = t0.getTime() - 4 * 864e5, HI = t0.getTime() + 8 * 864e5, FEN = 5 * 864e5;
  if (!window.__progWin) window.__progWin = { std: true, von: 0, breite: FEN };
  // Breite variabel (Griffe am Rahmen der Tagesleiste, 30.09.2026): 12 h … ganzer Bereich
  // 08.10.2026 (Nutzer, wie Dashboard): iPhone hochkant Standard heute + morgen, sonst 5 Tage
  const HOCH = window.matchMedia("(max-width: 767px) and (orientation: portrait)");
  if (!window.__progMq) { window.__progMq = true; HOCH.addEventListener("change", () => { if (window.__progWin && window.__progWin.std && window.__progD) zeigePrognose(window.__progD); }); }
  const BR = window.__progWin.std ? (HOCH.matches ? 2 * 864e5 : FEN) : Math.min(Math.max(window.__progWin.breite || FEN, 12 * 36e5), HI - LO);
  let x0 = window.__progWin.std ? t0.getTime() - (HOCH.matches ? 0 : 2 * 864e5) : window.__progWin.von;
  x0 = Math.min(Math.max(x0, LO), HI - BR); const x1 = x0 + BR; window.__progX = [x0, x1];
  const X = (t) => L + (t - x0) / (x1 - x0) * (R - L);
  const halb = 18e5, jetzt = Date.now(), h0 = Math.floor(jetzt / 36e5) * 36e5;
  const fp = pr.filter((p) => p[0] + halb >= x0 - 36e5 && p[0] + halb <= x1 + 36e5);
  const ip = pi.filter((p) => p[0] + halb >= x0 - 36e5 && p[0] + halb <= x1 + 36e5);
  let max = 1;
  fp.forEach((p) => { max = Math.max(max, p[1] / 1000, p[2] / 1000); });
  ip.forEach((p) => { max = Math.max(max, p[1], p[2]); });
  max = Math.ceil(max);
  const Y = (v) => B - v / max * (B - T), Ys = (v) => B - v / 100 * (B - T);
  const linie = (pts) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");
  let svg = `<defs><clipPath id="pkclip"><rect x="${L}" y="0" width="${R - L}" height="${B + 1}"/></clipPath></defs>`;
  for (let i = 0; i <= max; i += (max > 6 ? 2 : 1))
    svg += `<line x1="${L}" x2="${R}" y1="${Y(i)}" y2="${Y(i)}" stroke="#374151" stroke-dasharray="3 4"/>`
      + `<text x="${L - 6}" y="${Y(i) + 4}" fill="#9ca3af" font-size="12" text-anchor="end">${i}</text>`;
  for (let v = 0; v <= 100; v += 20)
    svg += `<text x="${R + 6}" y="${Ys(v) + 4}" fill="#9ca3af" font-size="12">${v}</text>`;
  svg += `<text x="${L - 6}" y="${T - 2}" fill="#9ca3af" font-size="11" text-anchor="end">kW</text>`
    + `<text x="${R + 6}" y="${T - 2}" fill="#9ca3af" font-size="11">%</text>`;
  const tage = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  { const m0 = new Date(x0); m0.setHours(0, 0, 0, 0);
    for (let t = m0.getTime(); t <= x1; t += 864e5) {
      if (t >= x0) svg += `<line x1="${X(t)}" x2="${X(t)}" y1="${T}" y2="${B}" stroke="#4b5563"/>`;
      const a = Math.max(t, x0), b = Math.min(t + 864e5, x1), dt = new Date(t);
      if (X(b) - X(a) > 60) svg += `<text x="${(X(a) + X(b)) / 2}" y="${B + 22}" fill="${t === t0.getTime() ? '#e5e7eb' : '#9ca3af'}" font-size="13" ${t === t0.getTime() ? 'font-weight="700"' : ''} text-anchor="middle">${tage[dt.getDay()]} ${dt.getDate()}.${dt.getMonth() + 1}.</text>`;
    } }
  let g = ""; const KZ = [], KZt = (arr) => arr.filter((p) => p[1] !== null && p[1] !== undefined);
  if (ip.length) KZ.push({ n: "PV", f: "#f59e0b", e: "kW", d: 2, p: KZt(ip.map((p) => [p[0] + halb, p[1]])) },
    { n: "Verbrauch", f: "#ef4444", e: "kW", d: 2, p: KZt(ip.map((p) => [p[0] + halb, p[2]])) },
    { n: "Akku", f: "#3b82f6", e: "%", d: 0, p: KZt(ip.map((p) => [p[0] + halb, p[3]])) });
  const flaeche = (idx, farbe, deck) => {
    if (!ip.length) return "";
    const pts = ip.map((p) => [X(p[0] + halb), Y(p[idx])]);
    return `<path d="${linie(pts)}L${pts[pts.length - 1][0]},${B}L${pts[0][0]},${B}Z" fill="${farbe}" fill-opacity="${deck}"/>`
      + `<path d="${linie(pts)}" fill="none" stroke="${farbe}" stroke-width="2"/>`;
  };
  g += flaeche(2, "#ef4444", 0.25) + flaeche(1, "#f59e0b", 0.35);
  // Prognose geteilt: Vergangenheit dünn/blass, ab der laufenden Stunde kräftig
  const zwei = (pts, farbe, blass, breite) => {
    const alt = pts.filter((p) => p[0] < h0 + 36e5), neu = pts.filter((p) => p[0] + 36e5 >= h0);
    let s = "";
    if (alt.length > 1) s += `<path d="${linie(alt.map((p) => [X(p[0] + halb), Y(p[1])]))}" fill="none" stroke="${blass}" stroke-width="1.2" stroke-dasharray="4 4"/>`;
    if (neu.length > 1) s += `<path d="${linie(neu.map((p) => [X(p[0] + halb), Y(p[1])]))}" fill="none" stroke="${farbe}" stroke-width="${breite}" stroke-dasharray="7 5"/>`;
    return s;
  };
  if (fp.length) {
    g += zwei(fp.map((p) => [p[0], p[2] / 1000]), "#f87171", "#7f3b3b", 2);
    { const em = new Map();
      (d.va || []).forEach((p) => { if (p[0] < h0) em.set(p[0], p[1]); });
      (d.ve || []).forEach((p) => { if (p[0] >= h0) em.set(p[0], p[1]); });
      const ep = [...em.entries()].sort((a, b) => a[0] - b[0]).filter((p) => p[0] + halb >= x0 - 36e5 && p[0] + halb <= x1 + 36e5).map((p) => [p[0], p[1] / 1000]);
      g += zwei(ep, "#22c55e", "#1f6b3a", 2); KZ.push({ n: "Verbrauch Prognose eigen", f: "#22c55e", e: "kW", d: 2, p: ep.map((p) => [p[0] + halb, p[1]]) }); }
    g += zwei(fp.map((p) => [p[0], p[1] / 1000]), "#fbbf24", "#7c6320", 2.5);
    KZ.push({ n: "PV Prognose", f: "#fbbf24", e: "kW", d: 2, p: fp.map((p) => [p[0] + halb, p[1] / 1000]) },
      { n: "Verbrauch Prognose Victron", f: "#f87171", e: "kW", d: 2, p: fp.map((p) => [p[0] + halb, p[2] / 1000]) });
  }
  if (ip.length) g += `<path d="${linie(ip.map((p) => [X(p[0] + halb), Ys(p[3])]))}" fill="none" stroke="#3b82f6" stroke-width="2.5"/>`;
  // Akku-Prognose nur Zukunft (wie im Dashboard): PV-Prognose (heute mit Tageskorrektur) − eigene Verbrauchsprognose d.ve
  // (sonst VRM), 30 kWh, Wirkungsgrad 0,95 je Richtung, Reserve live; gestrichelt hellblau
  {
    const s = d.s || {}, soc = num(s, "sensor.venus_dc_batterie_ladestand"), res = num(s, "sensor.venus_aktiver_soc_grenzwert") ?? 50;
    const pvm = new Map(pr.map((p) => [p[0], p[1]])), ve = d.ve || [], vbm = new Map(ve.length >= 24 ? ve : pr.map((p) => [p[0], p[2]]));
    if (soc !== null) {
      const cap = 30, eta = 0.95, emin = res / 100 * cap, jn = jetzt, tt0 = new Date(); tt0.setHours(0, 0, 0, 0);
      let prog = 0; for (const [t, w] of pvm) if (t >= tt0.getTime() && t < h0) prog += w || 0; prog += (pvm.get(h0) || 0) * ((jn - h0) / 36e5);
      const ist = Math.max(num(s, "sensor.pv_ertrag_heute") ?? 0, num(s, "sensor.pv_ertrag_tag_max") ?? 0);
      const morgen = tt0.getTime() + 864e5; let tag = 0; for (const [t, w] of pvm) if (t >= tt0.getTime() && t < morgen) tag += w || 0;
      // gewichtet mit dem vergangenen Anteil der Tages-PV (30.09.2026)
      const k0 = prog >= 2000 ? Math.min(Math.max(ist * 1000 / prog, 0.5), 1.3) : 1, k = 1 + (k0 - 1) * (tag > 0 ? Math.min(prog / tag, 1) : 0);
      let e = soc / 100 * cap; const pts = [[X(jn), Ys(soc)]], akt = [[jn, soc]];
      for (let i = 0; i < 192; i++) { const ms = h0 + i * 36e5, l = i === 0 ? (h0 + 36e5 - jn) / 36e5 : 1; if (!vbm.has(ms) || ms > x1 + 36e5) break;
        const dd = ((pvm.get(ms) || 0) * (ms < morgen ? k : 1) - (vbm.get(ms) || 0)) / 1000 * l;
        e = dd >= 0 ? Math.min(e + dd * eta, cap) : Math.max(e + dd / eta, emin); pts.push([X(ms + 36e5), Ys(e / cap * 100)]); akt.push([ms + 36e5, e / cap * 100]); }
      if (akt.length > 1) KZ.push({ n: "Akku Prognose", f: "#93c5fd", e: "%", d: 0, gap: 90 * 6e4, p: akt });
      if (pts.length > 1) g += `<path d="${linie(pts)}" fill="none" stroke="#93c5fd" stroke-width="2.2" stroke-dasharray="7 5"/>`;
    }
  }
  if (jetzt > x0 && jetzt < x1) g += `<line x1="${X(jetzt)}" x2="${X(jetzt)}" y1="${T}" y2="${B}" stroke="#9ca3af" stroke-dasharray="4 4"/>`;
  svg += `<g clip-path="url(#pkclip)">${g}</g>`;
  const el = $("progkurve");
  el.innerHTML = svg;
  kreuz(el, { L, R, T, B, x0, x1, reihen: KZ });
  // Tagesleiste darunter: PV je Tag (gemessen kräftig, Prognose hell gestrichelt), Verbrauch roter Strich, Rahmen = Ausschnitt
  { const tg = (arr, idx, f, nur) => { const o = {}; for (const p of arr) { if (nur && !nur(p[0])) continue; const dt = new Date(p[0]); const k = dt.getFullYear() * 1e4 + (dt.getMonth() + 1) * 100 + dt.getDate();
        o[k] = (o[k] || 0) + (p[idx] || 0) * f; } return o; };
    const key = (t) => { const dt = new Date(t); return dt.getFullYear() * 1e4 + (dt.getMonth() + 1) * 100 + dt.getDate(); };
    const pvI = tg(pi, 1, 1), vbI = tg(pi, 2, 1), pvP = tg(pr, 1, 0.001), vbP = tg(d.ve || [], 1, 0.001);
    const UW = 1000, UH = 34, U = (t) => 8 + (t - LO) / (HI - LO) * (UW - 16), heute = t0.getTime();
    const tl = []; for (let t = LO; t < HI; t += 864e5) tl.push(t);
    const pvW = (t) => { const k = key(t), a = pvI[k] ?? 0, p = pvP[k] ?? 0; return t < heute ? [a, 0] : t === heute ? [a, Math.max(p - a, 0)] : [0, p]; };
    const vbW = (t) => { const k = key(t); return t < heute ? vbI[k] : (vbP[k] ?? vbI[k]); };
    let mx = 10; tl.forEach((t) => { const [a, b] = pvW(t); mx = Math.max(mx, a + b, vbW(t) || 0); });
    const UY = (v) => 2 + UH - v / mx * UH, bw = (UW - 16) / tl.length - 4;
    let u = `<rect x="8" y="2" width="${UW - 16}" height="${UH}" rx="3" fill="#27272a"/>`;
    tl.forEach((t) => { const x = U(t) + 2, [a, b] = pvW(t), v = vbW(t), dt = new Date(t);
      if (a > 0) u += `<rect x="${x}" y="${UY(a)}" width="${bw}" height="${UH + 2 - UY(a)}" fill="#f59e0b"/>`;
      if (b > 0) u += `<rect x="${x}" y="${UY(a + b)}" width="${bw}" height="${UY(a) - UY(a + b)}" fill="#fbbf24" fill-opacity="0.35" stroke="#fbbf24" stroke-opacity="0.7" stroke-dasharray="2 2"/>`;
      if (v) u += `<line x1="${x}" x2="${x + bw}" y1="${UY(v)}" y2="${UY(v)}" stroke="#ef4444" stroke-width="2" ${t > heute ? 'stroke-dasharray="3 2"' : ''}/>`;
      u += `<text x="${x + bw / 2}" y="${UH + 17}" fill="${t === heute ? '#e5e7eb' : '#9ca3af'}" font-size="12" ${t === heute ? 'font-weight="700"' : ''} text-anchor="middle">${tage[dt.getDay()]} ${dt.getDate()}.</text>`; });
    u += `<line x1="${U(jetzt)}" x2="${U(jetzt)}" y1="1" y2="${UH + 3}" stroke="#e5e7eb" stroke-width="1.5"/>`;
    u += `<rect x="${U(x0)}" y="1" width="${U(x1) - U(x0)}" height="${UH + 2}" rx="3" fill="#e5e7eb" fill-opacity="0.10" stroke="#e5e7eb" stroke-width="1.5"/>`;
    u += griffe(U(x0), U(x1), UH);   // gelbe Griffe = zoombar
    let ub = $("progueb");
    if (!ub) { ub = document.createElementNS("http://www.w3.org/2000/svg", "svg"); ub.id = "progueb"; ub.setAttribute("viewBox", "0 0 1000 58");
      ub.style.cssText = "display:block;width:100%;height:auto;margin-top:4px;cursor:pointer;touch-action:none"; el.after(ub);
      // Griffe (30.09.2026): Rand des Rahmens ziehen = schmaler/breiter (zoomen), im Rahmen ziehen = verschieben, daneben tippen = springen
      let gm = null; const MINW = 12 * 36e5;
      const lage = (ev) => { const r = ub.getBoundingClientRect(), tt0 = new Date(); tt0.setHours(0, 0, 0, 0);
        const lo = tt0.getTime() - 4 * 864e5, hi = tt0.getTime() + 8 * 864e5, [a, b] = window.__progX;
        const zt = (x) => lo + ((x - r.left) / r.width * 1000 - 8) / (1000 - 16) * (hi - lo), xt = (t) => r.left + (8 + (t - lo) / (hi - lo) * (1000 - 16)) / 1000 * r.width;
        return { t: zt(ev.clientX), a, b, xa: xt(a), xb: xt(b), tol: ev.pointerType === "touch" ? 18 : 8 }; };
      const setze = (von, bis) => { window.__progWin = { std: false, von, breite: bis - von };
        if (!ub.__raf) ub.__raf = requestAnimationFrame(() => { ub.__raf = null; zeigePrognose(window.__progD); }); };
      ub.addEventListener("pointerdown", (ev) => { const q = lage(ev), mitte = (q.xa + q.xb) / 2, schmal = q.xb - q.xa < 3 * q.tol;
        if (Math.abs(ev.clientX - q.xa) <= q.tol && (!schmal || ev.clientX < mitte)) gm = { m: "l" };
        else if (Math.abs(ev.clientX - q.xb) <= q.tol) gm = { m: "r" };
        else if (ev.clientX > q.xa && ev.clientX < q.xb) gm = { m: "m", off: q.t - q.a, w: q.b - q.a };
        else { const w = q.b - q.a; gm = { m: "m", off: w / 2, w }; setze(q.t - w / 2, q.t + w / 2); }
        try { ub.setPointerCapture(ev.pointerId); } catch (e) {} });
      ub.addEventListener("pointermove", (ev) => { const q = lage(ev);
        if (!gm) { ub.style.cursor = Math.abs(ev.clientX - q.xa) <= q.tol || Math.abs(ev.clientX - q.xb) <= q.tol ? "ew-resize" : (ev.clientX > q.xa && ev.clientX < q.xb ? "grab" : "pointer"); return; }
        if (gm.m === "l") setze(Math.min(q.t, q.b - MINW), q.b);
        else if (gm.m === "r") setze(q.a, Math.max(q.t, q.a + MINW));
        else setze(q.t - gm.off, q.t - gm.off + gm.w); });
      ub.addEventListener("pointerup", () => { gm = null; }); ub.addEventListener("pointercancel", () => { gm = null; });
      doppel(ub, () => { if (ub.__raf) { cancelAnimationFrame(ub.__raf); ub.__raf = null; } window.__progWin = { std: true, von: 0, breite: FEN }; zeigePrognose(window.__progD); }); }
    ub.innerHTML = u; }
  // Ziehen im Feld (einmalig anmelden)
  if (!el.__drag) { el.__drag = true; el.style.touchAction = "pan-y"; el.style.cursor = "grab";
    let dr = null;
    el.addEventListener("pointerdown", (ev) => { const [a, b] = window.__progX; dr = { x: ev.clientX, von: a, br: b - a, moved: false }; });
    el.addEventListener("pointermove", (ev) => { if (!dr) return; const dx = ev.clientX - dr.x; if (Math.abs(dx) > 5) dr.moved = true; if (!dr.moved) return;
      const r = el.getBoundingClientRect(), pw = r.width * (956 - 44) / 1000;
      window.__progWin = { std: false, von: dr.von - dx / pw * dr.br, breite: dr.br };
      if (!el.__raf) el.__raf = requestAnimationFrame(() => { el.__raf = null; zeigePrognose(window.__progD); }); });
    const ende = () => { dr = null; };
    el.addEventListener("pointerup", ende); el.addEventListener("pointerleave", ende); el.addEventListener("pointercancel", ende);
    doppel(el, () => { if (el.__raf) { cancelAnimationFrame(el.__raf); el.__raf = null; } window.__progWin = { std: true, von: 0, breite: FEN }; zeigePrognose(window.__progD); }); }
}

// ---------- Temperaturen innen/außen + Vorhersage, vorgestern bis übermorgen ----------
function zeigeTemperaturen(d) {
  const pi = (d.pi || []).filter((p) => p.length >= 6), wt = d.wt || [];
  const L = 44, R = 956, T = 26, B = 260;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0); const x0 = t0.getTime() - 2 * 864e5, x1 = x0 + 5 * 864e5;
  const X = (t) => L + (t - x0) / (x1 - x0) * (R - L), halb = 18e5;
  const ip = pi.filter((p) => p[0] + halb >= x0 && p[0] + halb <= x1);
  const jetzt = Date.now();
  // Vorhersage an den gemessenen Wert angeglichen (30.09.2026): Abweichung jetzt, klingt über 12 h ab (met.no nachts 3,5–5 K zu warm)
  const ist = num(d.s || {}, "sensor.cmi_t_aussen");
  const wv = wt.filter((p) => p[0] <= jetzt), wn = wt.filter((p) => p[0] > jetzt && p[0] <= x1);
  const pj = wv.length && wn.length ? wv[wv.length - 1][1] + (wn[0][1] - wv[wv.length - 1][1]) * (jetzt - wv[wv.length - 1][0]) / (wn[0][0] - wv[wv.length - 1][0]) : null;
  const off = ist !== null && pj !== null ? ist - pj : 0;
  const fp = (ist !== null ? [[jetzt, ist]] : []).concat(wn.map(([t, w]) => [t, w + off * Math.max(0, 1 - (t - jetzt) / 432e5)]));
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
  kreuz($("tempkurve"), { L, R, T, B, x0, x1, reihen: [
    { n: "Außen", f: "#3b82f6", e: "°C", p: ip.map((p) => [p[0] + halb, p[4]]).concat(oat !== null ? [[jetzt, oat]] : []) },
    { n: "Innen", f: "#ef4444", e: "°C", p: ip.map((p) => [p[0] + halb, p[5]]) },
    { n: "Außen Prognose", f: "#93c5fd", e: "°C", p: fp, gap: 90 * 6e4 }] });
}

// ---------- Als Nächstes (06.10.2026) ----------
// Gleiche Karte wie im Dashboard (lib/vgs_schwellen.js). Sie erwartet ein hass-Objekt → Ersatz aus data.json (s) + verlauf.json (ns).
// Ohne callWS gibt es keine Tendenz-Pfeile (Verlauf ist hier nicht abrufbar).
function zeigeSchwellen(d, v) {
  const el = $("schwellen"); if (!el || !customElements.get("vgs-schwellen-card")) return;
  const ns = (v && v.ns) || {}, st = {};
  for (const [e, x] of Object.entries({ ...(d.s || {}), ...(ns.s || {}) })) st[e] = { state: String(x), attributes: {} };
  st["sensor.naechster_start"] = { state: "", attributes: { geraete: ns.g || {} } };
  if (!el._cfg) { el.setConfig({ titel: false }); el._cfg = true; }
  // Tendenz-Pfeile (06.10.2026): HA schickt je Fühler 1-min-Proben der letzten 31 min (ns.h) → als Verlauf an die Karte,
  // zeitlich so verschoben, dass die jüngste Probe „jetzt“ ist (verlauf.json kommt nur alle 5 min)
  const h = ns.h || {};
  const callWS = async (m) => {
    if (m.type !== "history/history_during_period") throw new Error("Anzeigeseite: nicht unterstützt");
    const neu = Math.max(0, ...Object.values(h).flatMap((l) => l.map((x) => x[0]))), dt = neu ? Date.now() / 1000 - neu : 0, r = {};
    for (const e of m.entity_ids || []) if (h[e] && h[e].length) r[e] = h[e].map(([t, w]) => ({ s: String(w), lu: t + dt }));
    return r;
  };
  if (el._hver !== v) { el._hver = v; el._trendT = 0; }   // neue Proben → Karte rechnet Tendenz neu
  el.hass = { states: st, callWS };
}

// ---------- Laden ----------
let VERLAUF = null, VERLAUF_T = 0;
async function holen() {
  try {
    const r = await fetch(DATEN + "?t=" + Date.now(), { cache: "no-store" });
    const d = await r.json();
    if (!VERLAUF || Date.now() - VERLAUF_T > 12e4) try {   // Verlaufsdaten der Fenster-Grafiken (03.10.2026), HA schickt alle 5 min
      VERLAUF = await (await fetch(DATEN.replace("data.json", "verlauf.json") + "?t=" + Date.now(), { cache: "no-store" })).json(); VERLAUF_T = Date.now(); } catch (e) {}
    tlSetzen(VERLAUF);
    const s = d.s || {}, a = d.a || {};
    zeigeSchema(s, d.sk); zeigeFluss(s); zeigeBatterie(s, d.ap); zeigeKlima(s, a); zeigeWasser(s); zeigeTabellen(s, d.k || {}, d.lp || {}, d.gh);
    zeigeTage(s, d.k || {}, d.h); zeigePV(s); zeigePrognose(d); zeigeTemperaturen(d); zeigeZeitleiste(d); zeigeFazit(d); zeigeHerkunft(d); zeigeWann(d); zeigeWasserGrafik(d); zeigeTagesbericht(d);
    try { zeigeWasserFenster(d, VERLAUF); } catch (e) { console.warn("wf", e); }
    try { zeigeWpFenster(d, VERLAUF); } catch (e) { console.warn("wpf", e); }
    try { zeigeSchwellen(d, VERLAUF); } catch (e) { console.warn("schwellen", e); }
    try { zeigeZaehler(s); } catch (e) { console.warn("zaehler", e); }
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

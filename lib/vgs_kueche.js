// vgs-kueche-card (16.10.2026, Nutzer): Küchen-/iPad-Seite „alles auf einen Blick“ (Skizze UI-Check/skizzen/ipad.html v3).
// Fester Entwurf 1024×768 (4:3), wird auf die verfügbare Fläche skaliert (MacBook/iPad quer). Ruhig: Farbe nur als Signal.
// Blöcke: Kopf (Uhr, Wetter, Sonnenprognose 30 h mit Tag/Nacht) · Energie jetzt (Quellen, Akku, Haus, 8 Kategorien, WP-Lauf-AZ)
// · Wann starten? (sensor.wann_*) · Torten Wasser/Strom (heute/gestern/Woche/Monat aus der Langzeitstatistik) · Hinweise · Räume · Fuß.
// Kategorien = Kopie der Logik aus Energiefluss/Großverbraucher (bei neuen Verbrauchern hier mit eintragen).
(() => {
  const ICON = {
    wasch: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4.5"/><path d="M7 6.5h2M13 6.5h4"/>',
    trock: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4.5"/><path d="M10 12c1-1 3 1 4 0M7 6.5h2"/>',
    spuel: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 8h16M8 12v5M12 12v5M16 12v5M7 5.5h2"/>',
    sonne: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    netz: '<path d="M8 21l4-18 4 18M6 9h12M7 14h10M10 21l2-5 2 5"/>',
    haus: '<path d="M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5"/>',
    heiz: '<path d="M6 21V8M10 21V5M14 21V5M18 21V8M4 21h16M6 8a2 2 0 0 1 2-2M18 8a2 2 0 0 0-2-2"/>',
    ww: '<path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/>',
    kuehl: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 9h12M9 5v2M9 12v3"/>',
    licht: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    kochen: '<path d="M4 11h16v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6zM2 11h20M9 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4"/>',
    geraet: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="13" r="4"/>',
    klima: '<rect x="3" y="5" width="18" height="8" rx="2"/><path d="M7 16c0 2-1 3-1 4M12 16v4M17 16c0 2 1 3 1 4"/>',
    router: '<rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 16.5h.01M11 16.5h.01M8 9.5a6 6 0 0 1 8 0M5.5 7a9.5 9.5 0 0 1 13 0M12 13v-1"/>',
    smart: '<path d="M3 11l9-7 9 7M5 9.5V20h14V9.5"/><circle cx="12" cy="14" r="2"/><path d="M8.5 11.5a5 5 0 0 1 7 0"/>',
    technik: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    rest: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3 2.4c-.5.2-.5.6-.5 1.1M12 16.5v.5"/>',
    sofa: '<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 11h18v6H3zM5 17v2M19 17v2"/>',
    bad: '<path d="M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-3zM6 12V5a2 2 0 0 1 4 0M7 20l-1 2M17 20l1 2"/>',
    bett: '<path d="M3 18V6M3 13h18v5M21 18v-5a3 3 0 0 0-3-3h-7v3M6.5 11.5a1.5 1.5 0 1 0 0-.1"/>',
    wc: '<path d="M6 3h6v7H6zM4 10h16a8 8 0 0 1-8 8h-1l1 3H8l1-3a6 6 0 0 1-5-8z"/>',
    flur: '<path d="M5 21V4h10v17M15 6l4 1.5V21M3 21h18M12 12v1"/>',
    buch: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 21a2 2 0 0 1 2-2h13v2"/>',
    raum: '<path d="M4 21V4h16v17M9 21v-6h6v6"/>',
    tropfen: '<path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/><path d="M9 14a3 3 0 0 0 3 3"/>',
    speicher: '<rect x="6" y="2" width="12" height="20" rx="5"/><path d="M12 9v6M10 13l2 2 2-2"/>',
    fenster: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M4 12h16"/>',
    ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    warn: '<path d="M12 3l10 18H2L12 3zM12 10v5M12 18v.5"/>',
    schloss_zu: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4M12 15v2"/>',
    schloss_auf: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2M12 15v2"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
    miner: '<rect x="6" y="6" width="12" height="12" rx="1.5"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    tuer_zu: '<path d="M4 21h16M6 21V3h12v18M14 12v1"/>',
    tuer_offen: '<path d="M4 21h16M6 21V3h8v18M14 5l5 2v14M11 12v1"/>',
    // 16.10.2026: Wetter als Linien-Symbole (Emoji 🌫️ war auf dem iPad nur ein graues Kästchen)
    w_wolke: '<path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3 1.5A3.3 3.3 0 0 0 7 18z"/>',
    w_teil: '<path d="M8 4.5v1M3.5 9h1M4.8 5.8l.7.7M11.2 5.8l-.7.7"/><path d="M5.5 11.5a3 3 0 0 1 5.4-2.3"/><path d="M9 19h8a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.4 1.3A2.9 2.9 0 0 0 9 19z"/>',
    w_regen: '<path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    w_schnee: '<path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M8 19h.01M12 20h.01M16 19h.01M10 22h.01M14 22h.01"/>',
    w_gewitter: '<path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3 1.5A3.3 3.3 0 0 0 7 15z"/><path d="M12 15l-2 4h3l-2 4"/>',
    w_nebel: '<path d="M7 12h10a4 4 0 0 0 0-8 6 6 0 0 0-11.3 1.5"/><path d="M3 15h18M5 18h14M7 21h10"/>',
    w_mond: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    w_wind: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8"/>',
    wp: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="4"/><path d="M9 8v8M5 12h8M16 9h2M16 12h2M16 15h2"/>',
  };
  const ic = (n, c = '#e5e7eb', s = 24, sw = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICON[n] || ''}</svg>`;
  const G = '#4ade80', Y = '#facc15', R = '#f87171', B = '#60a5fa', M = '#9ca3af', T = '#2dd4bf';
  const zahl = (v, d = 0) => (Number.isFinite(v) ? v : 0).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const W = (v) => Math.abs(v) >= 1000 ? zahl(v / 1000, 1) + ' kW' : zahl(v) + ' W';
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hm = (d) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  // Kategorien: Leistung jetzt (W) + Energie (Statistik-IDs, kWh)
  const KAT = [
    { k: 'heiz', n: 'Heizung', c: '#ef4444', p: ['sensor.wp_leistung_elektrisch_gesamt'], e: ['sensor.wp_stromzahler'] },
    { k: 'ww', n: 'Warmwasser', c: '#60a5fa', p: ['sensor.keller_bwwp_shelly_leistung'], e: ['sensor.keller_bwwp_shelly_bwwp_energie_heute'] },
    { k: 'kuehl', n: 'Kühlschränke', c: '#22d3ee', p: ['sensor.kuche_kuhlschrank_shelly_leistung', 'sensor.garage_kuhlschrank_shelly_leistung'],
      e: ['sensor.kuhlschrank_energie_heute', 'sensor.kuhlschrank_garage_energie_heute'] },
    // 16.10.2026 (Nutzer): Miner und TV getrennt
    { k: 'miner', n: 'Miner', c: '#f472b6', p: ['sensor.smart_switch_23022384462303510d0248e1e9bb5091_power', 'sensor.keller_iceriver_miner_power', 'sensor.keller_miner_lufter_power', 'sensor.bitaxe_leistung'],
      e: ['sensor.nerdaxe_energie_heute', 'sensor.iceriver_energie_heute', 'sensor.bitaxe_energie_heute'] },
    { k: 'tv', n: 'TV', c: '#818cf8', p: ['sensor.tv_sony_power', 'sensor.tv_yoga_leistung'], e: ['sensor.tv_sony_energie_heute', 'sensor.tv_yoga_energie_heute'] },   // 20.10.2026: + TV Yoga ≈
    // 20.10.2026: Emils Schreibtisch (Shelly Plug M Gen3: PC, MacBook …)
    { k: 'emil', n: 'Emil PC', c: '#a3e635', p: ['sensor.emils_schreibtisch_leistung'], e: ['sensor.emil_schreibtisch_energie_heute'] },
    // 19.10.2026 (Nutzer): Router & Netzwerk (Router, Repeater, Pi, Switch, Daikin-Hub), Smart Home, Haustechnik (Heizungstechnik) –
    // geschätzte Dauer-/Standby-Verbraucher (router_pi.yaml, grundverbraucher.yaml)
    { k: 'router', n: 'Netzwerk', c: '#94a3b8', p: ['sensor.router_pi_leistung'], e: ['sensor.router_pi_energie_heute'] },
    { k: 'smart', n: 'Smart Home', c: '#c084fc', p: ['sensor.smart_home_leistung'], e: ['sensor.smart_home_energie_heute'] },
    { k: 'technik', n: 'Haustechnik', c: '#f87171', p: ['sensor.heizungstechnik_leistung'], e: ['sensor.heizungstechnik_energie_heute'] },
    { k: 'licht', n: 'Licht', c: '#fbbf24', p: ['sensor.licht_leistung'], e: ['sensor.licht_energie_heute'] },
    // 20.10.2026: Wasserkocher, Airfryer, Thermomix gemessen (eigene Shellys) → zählen zu Kochen
    { k: 'kochen', n: 'Kochen', c: '#fb923c', p: ['sensor.kochen_anzeige', 'sensor.kueche_wasserkocher_leistung', 'sensor.kueche_airfryer_leistung', 'sensor.kueche_thermomix_leistung'], e: ['sensor.kochen_energie_heute', 'sensor.wasserkocher_energie_heute', 'sensor.airfryer_energie_heute', 'sensor.thermomix_energie_heute'] },
    { k: 'geraet', n: 'Geräte', c: '#a78bfa', p: ['sensor.kuche_spulmaschine_shelly_leistung', 'sensor.keller_miele_waschmaschine_leistung', 'sensor.keller_miele_trockner_leistung', 'sensor.keller_entfeuchter_power'],
      e: ['sensor.spulmaschine_energie_heute', 'sensor.waschmaschine_energie_heute', 'sensor.trockner_energie_heute', 'sensor.entfeuchter_energie_heute'] },
    { k: 'klima', n: 'Klima', c: '#2dd4bf', p: ['sensor.klima_leistung_geschatzt'], e: ['sensor.klima_wintergarten_heute', 'sensor.klima_emil_heute', 'sensor.klima_dachspitz_heute'] },
    { k: 'rest', n: 'Rest', c: '#6b7280' },
  ];
  const HAUS_E = 'sensor.hausverbrauch_heute';
  const NETZ_E = 'sensor.haus_aus_netz_heute';   // 20.10.2026: Hausverbrauch aus dem Netz (haus_herkunft.yaml) → PV-Quote
  // 16.10.2026 23:20 (Nutzer): Farben wie Wasser-Torte im Dashboard/Website (Dusche rot, Wanne orange, Abspülen rosa, WC blau, kalt dunkelblau, Garten grün)
  const WASSER = [
    ['Duschen', '#ef4444', ['sensor.wasser_heute_dusche']], ['Badewanne', '#f97316', ['sensor.wasser_heute_badewanne']],
    ['Abspülen', '#fb7185', ['sensor.wasser_heute_abspuelen']], ['kurz warm', '#fca5a5', ['sensor.wasser_heute_warm_kurz']],
    ['WC', '#60a5fa', ['sensor.wasser_heute_wc']], ['kalt', '#2563eb', ['sensor.wasser_heute_kalt', 'sensor.wasser_heute_kueche_kalt']],
    ['Waschmaschine', '#a78bfa', ['sensor.wasser_heute_waschmaschine']], ['Spülmaschine', '#a78bfa', ['sensor.wasser_heute_spuelmaschine_geschaetzt']],
    ['Garten', '#22c55e', ['sensor.wasser_heute_garten']],
  ];
  // 16.10.2026 (Nutzer): Torten erst grob (Gruppen), Antippen → außen Details (wie Torten der anderen Reiter)
  // 16.10.2026 abends (Nutzer): grob wie „Früher ↔ heute“ – Hausstrom gelb / Warmwasser blau / Heizung rot (Rest + Klima = Hausstrom)
  const GRUPPE_S = { Heizung: ['Heizung', '#ef4444'], Warmwasser: ['Warmwasser', '#60a5fa'] }, HAUSSTROM = ['Hausstrom', '#facc15'];
  const GFARBE = { Warmwasser: '#ef4444', 'kalt im Haus': '#2563eb', Garten: '#22c55e' };
  const GRUPPE_W = { Duschen: 'Warmwasser', Badewanne: 'Warmwasser', 'Abspülen': 'Warmwasser', 'kurz warm': 'Warmwasser', Garten: 'Garten' }; // Rest = kalt im Haus
  const ZEIT = [['heute', 'heute'], ['gestern', 'gestern'], ['woche', '7 Tage'], ['monat', 'Monat']];

  class VgsKueche extends HTMLElement {
    setConfig(c) { this._c = c || {}; }
    // 21.10.2026 (Nutzer): Teil-Modus `teil: energie` (Dashboard) bzw. Attribut teil="energie" (Website) = nur „Energie jetzt“
    // + Last je Phase, ohne 1024er-Fläche/Skalierung – für die Batterie-Spalte in Übersicht, PV und Website.
    _teil() { return (this._c && this._c.teil) || this.getAttribute('teil') || ''; }
    getCardSize() { return 12; }
    connectedCallback() {
      if (!this.shadowRoot) { this.attachShadow({ mode: 'open' }); this._aufbau(); }
      this._ro = new ResizeObserver(() => this._skaliere()); this._ro.observe(this);
      window.addEventListener('resize', this._rs = () => this._skaliere());
      this._uhr = setInterval(() => this._kopfUhr(), 15000);
      if (!this._teil()) this._statT = setInterval(() => { this._ladeStat(); this._ladeTemp(); }, 300000);
    }
    disconnectedCallback() { this._ro?.disconnect(); this._roW?.disconnect(); this._roW = null; window.removeEventListener('resize', this._rs); clearInterval(this._uhr); clearInterval(this._statT); }
    set hass(h) {
      this._h = h;
      if (!this.shadowRoot) { this.attachShadow({ mode: 'open' }); this._aufbau(); }
      const jetzt = Date.now();
      if (!this._live || jetzt - this._live > 3000) { this._live = jetzt; this._zeichneLive(); }
      if (!this._statGeladen && !this._teil()) { this._statGeladen = true; this._ladeStat(); this._ladeTemp(); }
    }
    _s(e) { return this._h?.states[e]; }
    _n(e) { const s = this._s(e); const v = s ? parseFloat(s.state) : NaN; return Number.isFinite(v) ? v : 0; }
    _sum(l) { return (l || []).reduce((x, e) => x + Math.max(this._n(e), 0), 0); }

    _aufbau() {
      let z = 'heute'; try { z = localStorage.getItem('vgsKuecheZeit') || z; } catch (e) {}
      this._zeit = z;
      const stil = `<style>
        :host{display:block}
        .rahmen{position:relative;width:100%;overflow:hidden;background:#111214}
        .w{position:absolute;left:0;top:0;width:1024px;height:768px;padding:12px;box-sizing:border-box;display:grid;gap:10px;
           grid-template-columns:1fr 1fr 1fr;grid-template-rows:96px 252px 1fr 44px;transform-origin:0 0;color:#e5e7eb;font:15px -apple-system,Helvetica,Roboto,sans-serif}
        .c{background:#1c1d20;border-radius:16px;padding:12px 16px;overflow:hidden;position:relative;box-sizing:border-box}
        .h{font-size:12px;letter-spacing:.08em;color:${M};text-transform:uppercase;margin-bottom:6px;display:flex;align-items:center;gap:8px}
        .sm{font-size:13px;color:${M}}
        .kopf{grid-column:1/4;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:8px 24px;white-space:nowrap}
        .uhr{font-size:46px;font-weight:300;line-height:1}.dat{font-size:15px;color:${M};line-height:1.35}
        .wet{display:flex;gap:12px;align-items:center;font-size:15px}.wet b{font-size:32px;font-weight:400}
        .sonne{flex:none;display:flex;justify-content:center;height:82px}
        .tuer{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:4px}
        .e{grid-column:1/3}.en{display:flex;align-items:center;gap:8px;height:214px;box-sizing:border-box}
        .quellen{display:grid;grid-template-columns:46px auto;align-items:center;column-gap:30px;row-gap:12px;width:214px;flex:none}.qi{display:flex;justify-content:center;align-items:center;position:relative}.qi .ap{position:absolute;left:100%;margin-left:4px;top:50%;transform:translateY(-50%)}
        .quellen b{display:block;font-size:18px;font-weight:500}.quellen span{font-size:12px;color:${M};line-height:1.35;display:block;white-space:nowrap}
        .haus{display:flex;flex-direction:column;align-items:center;width:104px;gap:2px;position:relative;flex:none}.pfeil{transform:translateY(-16px);flex:none}.pfeil .fl{stroke-dasharray:8 6;animation:fl 1s linear infinite}@keyframes fl{to{stroke-dashoffset:-14}}.puls{animation:puls 1.6s ease-in-out infinite}@keyframes puls{50%{opacity:.35}}.ap.hoch{animation:hoch 1.2s ease-in-out infinite}.ap.runter{animation:runter 1.2s ease-in-out infinite}@keyframes hoch{0%{transform:translateY(-50%)}50%{transform:translateY(calc(-50% - 5px))}}@keyframes runter{0%{transform:translateY(-50%)}50%{transform:translateY(calc(-50% + 5px))}}.haus b{font-size:20px;color:${T};font-weight:500}
        .wpz{position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:8px;font-size:12px;text-align:center;padding:5px 9px;border-radius:10px;background:#26282c;color:${M};line-height:1.35;white-space:nowrap}.wpz .z1{display:flex;align-items:center;gap:5px;justify-content:center}
        .wpz b{font-size:15px;color:#e5e7eb}.wpz.an{background:rgba(96,165,250,.16);color:#93c5fd}.wpz.an b{color:#dbeafe}
        .kats{flex:1;display:flex;flex-direction:column;gap:3px;padding-left:10px;border-left:1px solid #2b2d31;align-self:stretch;min-width:0;justify-content:center}
        .kb{display:grid;grid-template-columns:20px 100px 1fr 52px;align-items:center;gap:6px;font-size:13.5px}.kb b{text-align:right;font-weight:500}.kb.aus{color:#555}
        .kbar{height:10px;background:#26282c;border-radius:5px;overflow:hidden}.kbar i{display:block;height:100%;border-radius:5px;transition:width .6s}
        .wann{display:flex;justify-content:space-around;margin-top:14px}.wg{display:flex;flex-direction:column;align-items:center;gap:5px;width:24%;text-align:center}
        .wg b{font-size:16px;font-weight:600}.wg .ko{font-size:13px;color:${M};white-space:nowrap;margin-top:-1px}.wg span{font-size:13px;color:${M}}.wg em{font-style:normal;font-size:12px;color:#d1d5db;line-height:1.3;margin-top:2px}
        .lb{width:64px;height:5px;border-radius:3px;background:#26282c;overflow:hidden;margin-top:-2px}.lb i{display:block;height:100%;background:${B}}
        .tc{display:flex;flex-direction:column}.chips{display:flex;gap:4px;margin-left:auto}
        .chips span{font-size:11px;letter-spacing:0;text-transform:none;padding:2px 7px;border-radius:9px;background:#26282c;color:${M};cursor:pointer}
        .chips span.on{background:#3f3f46;color:#fff}
        .torte{display:flex;flex-direction:column;align-items:center}
        .leg{display:grid;grid-template-columns:1fr 1fr;column-gap:14px;row-gap:1px;font-size:13px;width:100%;margin-top:6px}
        .leg div{display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden}.leg i{width:9px;height:9px;border-radius:50%;flex:none}
        .leg b{margin-left:auto;font-weight:500}
        .pz{font:700 11px sans-serif;fill:#fff;text-anchor:middle;paint-order:stroke;stroke:rgba(0,0,0,.5);stroke-width:2.5px;pointer-events:none}
        .st{display:flex;flex-direction:column;gap:10px;min-height:0}
        .zeile{display:flex;align-items:center;gap:9px;padding:5px 10px;border-radius:10px;font-size:14px;margin-bottom:4px;line-height:1.2}
        .warn{background:rgba(251,146,60,.14);border:1px solid rgba(251,146,60,.4)}.ok{background:rgba(74,222,128,.10);border:1px solid rgba(74,222,128,.3)}
        .alarm{background:rgba(248,113,113,.18);border:1px solid rgba(248,113,113,.55)}.info{background:#232428;border:1px solid #2f3136}
        .tk{height:96px;margin:-2px 0 6px}.tk text{font:10px sans-serif;fill:${M}}
        .r{display:grid;grid-template-columns:22px 1fr auto 14px;align-items:center;gap:6px;font-size:14px;margin-bottom:1px}.r b{font-weight:500}
        .fuss{grid-column:1/4;display:flex;align-items:center;justify-content:center;gap:26px;font-size:15px;color:${M};padding:0 16px}.fuss b{color:#e5e7eb}
        /* 21.10.2026 (Nutzer): iPhone hochkant – eigene Anordnung auf 460 px Breite statt 1024er-Fläche auf ~40 % geschrumpft */
        .w.hoch{width:460px;height:auto;grid-template-columns:1fr 1fr;grid-template-rows:auto}
        .hoch .kopf{grid-column:1/3;flex-wrap:wrap;padding:10px 16px;row-gap:6px}.hoch .sonne{width:100%}
        .hoch .e,.hoch .ger,.hoch .st,.hoch .fuss{grid-column:1/3}
        .hoch .en{flex-wrap:wrap;height:auto;justify-content:center;row-gap:14px;padding-top:4px}.hoch .wpz{position:static;transform:none;margin-top:6px}
        .hoch .kats{flex:1 1 100%;border-left:none;border-top:1px solid #2b2d31;padding:10px 0 0;gap:4px}
        .hoch .kb{grid-template-columns:20px 118px 1fr 58px;font-size:14px}
        .hoch .wann{margin-top:8px}
        .hoch .tc .h{flex-wrap:wrap;row-gap:6px}.hoch .chips{margin-left:0;width:100%;justify-content:space-between}.hoch .chips span{white-space:nowrap;padding:2px 6px}.hoch .tk{height:auto}.hoch .tk svg{width:100%;height:auto}
        .hoch .leg{grid-template-columns:1fr}
        .hoch .fuss{flex-wrap:wrap;gap:4px 16px;padding:10px 14px;text-align:center;line-height:1.4}
        /* 21.10.2026 (Nutzer): hochkant Räume vor den Torten → Torten direkt über der Fußzeile; Klammertext eigene Zeile */
        .hoch .st{order:1}.hoch .tc{order:2}.hoch .fuss{order:3;flex-direction:column;gap:2px}.hoch .fuss small{display:block}
        /* 21.10.2026: Teil-Modus „Energie jetzt“ als eigene Karte (Farben/Rand aus HA bzw. Website-Variablen) */
        :host([data-teil]){display:flex;flex-direction:column}
        .teil{flex:1;display:flex;color:var(--primary-text-color,#e5e7eb);font:15px -apple-system,Helvetica,Roboto,sans-serif}
        .teil .c{flex:1;display:flex;flex-direction:column;justify-content:space-evenly;gap:12px;background:var(--ha-card-background,var(--card-background-color,var(--karte,#1c1d20)));
           border:1px solid var(--ha-card-border-color,var(--divider-color,var(--rand,#2b2d31)));border-radius:var(--ha-card-border-radius,12px);padding:14px 16px}
        .teil .h{margin-bottom:0}
        .teil .quellen{width:auto;column-gap:16px}
        /* 21.10.2026 abends (Nutzer): Karte wird bis zu den Stromzählern gestreckt → Platz geht an die Verbraucherliste, nicht in Lücken */
        @media (min-width:768px){.teil .c{justify-content:flex-start}
          .teil .en{flex:1;display:grid;grid-template-columns:1fr auto auto auto 1fr;grid-template-rows:auto 1fr;align-items:center;column-gap:18px}.teil .quellen{grid-column:2}.teil .pfeil{grid-column:3}.teil .haus{grid-column:4}
          .teil .kats{grid-column:1/-1;align-self:stretch;justify-content:space-evenly;gap:6px}.teil .kb{font-size:15px}.teil .kbar{height:11px}
          .teil .quellen b{font-size:19px}.teil .quellen span{font-size:12.5px}}
        .teil .en{flex-wrap:wrap;height:auto;justify-content:center;row-gap:14px;column-gap:10px}
        .teil .kats{flex:1 1 100%;border-left:none;border-top:1px solid #2b2d31;padding:12px 0 0;gap:5px}
        .teil .kb{grid-template-columns:20px 118px 1fr 58px;font-size:14px}
        .ph{display:flex;flex-direction:column;gap:6px}
        .pz2{display:grid;grid-template-columns:24px 1fr 64px 52px;align-items:center;gap:8px;font-size:14px}.pz2 b{text-align:right;font-weight:500}.pz2 small{color:${M};text-align:right;font-size:12px}
        .pbar{height:12px;background:#26282c;border-radius:6px;overflow:hidden}.pbar i{display:block;height:100%;border-radius:6px;transition:width .6s}
      </style>`;
      if (this._teil()) {
        this.setAttribute('data-teil', '');
        this.shadowRoot.innerHTML = stil + `<div class="teil"><div class="c"><div class="en" id="en"></div>
          <div class="h">Last je Phase</div><div class="ph" id="phasen"></div></div></div>`;
        this._$ = (id) => this.shadowRoot.getElementById(id);
        return;
      }
      this.shadowRoot.innerHTML = stil + `<div class="rahmen"><div class="w">
        <div class="c kopf"><div class="uhr" id="uhr"></div><div class="dat" id="dat"></div><div class="wet" id="wet"></div><div class="sonne" id="sonne"></div></div>
        <div class="c e"><div class="h">Energie jetzt</div><div class="en" id="en"></div></div>
        <div class="c ger"><div class="h">Geräte</div><div id="wann"></div></div>
        <!-- 20.10.2026 (Nutzer): Strom links, Wasser rechts – gleiche Reihenfolge wie die Fußzeile -->
        <div class="c tc"><div class="h">Strom <div class="chips" data-t="s"></div></div><div id="ts" class="torte"></div></div>
        <div class="c tc"><div class="h">Wasser <div class="chips" data-t="w"></div></div><div id="tw" class="torte"></div></div>
        <div class="st"><div class="c" style="flex:0 0 auto"><div class="h">Hinweise</div><div id="hin"></div></div>
          <div class="c" style="flex:1"><div class="h">Räume<span id="ruhig" style="margin-left:auto;display:flex;align-items:center;gap:4px"></span></div><div id="tkurve" class="tk"></div><div id="raeume"></div></div></div>
        <div class="c fuss" id="fuss"></div>
      </div></div>`;
      this._$ = (id) => this.shadowRoot.getElementById(id);
      this.shadowRoot.querySelectorAll('.chips').forEach((el) => {
        el.innerHTML = ZEIT.map(([k, n]) => `<span data-z="${k}">${n}</span>`).join('');
        el.addEventListener('click', (ev) => {
          const z = ev.target?.dataset?.z; if (!z) return;
          this._zeit = z; try { localStorage.setItem('vgsKuecheZeit', z); } catch (e) {}
          this._chips(); this._ladeStat();
        });
      });
      this._chips(); this._kopfUhr(); this._skaliere();
    }
    _chips() { this.shadowRoot.querySelectorAll('.chips span').forEach((s) => s.classList.toggle('on', s.dataset.z === this._zeit)); }
    _skaliere() {
      if (this._teil()) return;
      const r = this.shadowRoot?.querySelector('.rahmen'), w = this.shadowRoot?.querySelector('.w'); if (!r) return;
      const bw = this.clientWidth || 1024, top = this.getBoundingClientRect().top + window.scrollY;
      // 21.10.2026: schmal + hochkant → eine 460er-Spalte, Höhe aus dem Inhalt, Breite füllen
      const hoch = bw < 600 && bw < window.innerHeight; w.classList.toggle('hoch', hoch);
      if (hoch) {
        if (!this._roW) { this._roW = new ResizeObserver(() => requestAnimationFrame(() => this._skaliere())); this._roW.observe(w); }
        const s = bw / 460; w.style.transform = `scale(${s})`; w.style.left = '0px'; r.style.height = `${w.offsetHeight * s}px`; return;
      }
      const vh = Math.max(window.innerHeight - Math.max(top, 0) - 8, 400);
      const s = Math.max(Math.min(bw / 1024, vh / 768), 0.3);
      w.style.transform = `scale(${s})`; w.style.left = `${Math.max((bw - 1024 * s) / 2, 0)}px`;
      r.style.height = `${768 * s}px`;
    }
    _kopfUhr() {
      if (!this._$ || this._teil()) return; const d = new Date();
      this._$('uhr').textContent = hm(d);
      this._$('dat').innerHTML = d.toLocaleDateString('de-DE', { weekday: 'long' }) + '<br>' + d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
      if (this._h) this._zeichneSonne();
    }

    _zeichneLive() {
      if (!this._$ || !this._h) return;
      if (this._teil()) { this._energie(); this._phasen(); return; }
      this._kopfWetter(); this._zeichneSonneThrottle(); this._energie(); this._wann(); this._hinweise(); this._raeume(); this._zeichneTempThrottle(); this._fuss();
      if (this._zeit === 'heute' && (!this._statZeit || Date.now() - this._statZeit > 60000)) this._ladeStat();
    }
    _kopfWetter() {
      const wx = this._s('weather.forecast_home'), zust = wx?.state || '';
      const [wi, wc] = { sunny: ['sonne', Y], 'clear-night': ['w_mond', '#cbd5e1'], partlycloudy: ['w_teil', '#e5e7eb'], cloudy: ['w_wolke', '#cbd5e1'], rainy: ['w_regen', '#93c5fd'], pouring: ['w_regen', B], fog: ['w_nebel', '#cbd5e1'], snowy: ['w_schnee', '#e0f2fe'], 'snowy-rainy': ['w_schnee', '#93c5fd'], hail: ['w_schnee', '#e0f2fe'], lightning: ['w_gewitter', Y], 'lightning-rainy': ['w_gewitter', Y], windy: ['w_wind', '#cbd5e1'], 'windy-variant': ['w_wind', '#cbd5e1'] }[zust] || ['w_wolke', M];
      const sym = `<span title="${esc(zust)}" style="display:inline-flex;vertical-align:-6px">${ic(wi, wc, 36, 1.6)}</span>`;
      const t = this._n('sensor.cmi_t_aussen');
      const pr = (this._s('sensor.aussen_prognose_stunden')?.attributes?.temp || []).filter((p) => p[0] >= Date.now() - 3600e3 && p[0] <= Date.now() + 24 * 3600e3).map((p) => p[1]);
      const mm = pr.length ? `↓ ${zahl(Math.min(...pr))}°  ↑ ${zahl(Math.max(...pr))}°` : '';
      const regen = this._s('binary_sensor.regen_erwartet')?.state === 'on' ? '🌧 Regen' : 'kein Regen';
      const frost = this._s('binary_sensor.frost_in_sicht')?.state === 'on' ? ' · ❄️ Frost' : '';
      this._$('wet').innerHTML = `<div>${sym} <b>${zahl(t, 1)}°</b></div><div class="sm">${mm}<br>${regen}${frost}</div>`;
    }
    // Haustür (Nuki, nur Anzeige): offen rot · nicht abgeschlossen orange · abgeschlossen grün
    _tuer() {
      if (this.hasAttribute('ohne-tuer')) return '';   // Website (öffentlich): Nuki nie zeigen
      // 16.10.2026 (Nutzer): klein unter dem Haus in „Energie jetzt“, ohne Text – Tür (offen rot / zu grau) + Schloss (abgeschlossen grün / nicht abgeschlossen orange)
      const lock = this._s('binary_sensor.nuki')?.state, tuer = this._s('binary_sensor.nuki_door_sensor')?.state;
      const ti = tuer === 'on' ? ['tuer_offen', R, 'Haustür offen'] : ['tuer_zu', tuer === 'off' ? M : '#4b5563', 'Haustür zu'];
      const si = lock === 'off' ? ['schloss_zu', G, 'abgeschlossen'] : lock === 'on' ? ['schloss_auf', '#fb923c', 'nicht abgeschlossen'] : ['schloss_zu', '#4b5563', 'Schloss unbekannt'];
      const akku = this._s('binary_sensor.nuki_battery_critical')?.state === 'on' ? `<span title="Nuki-Akku schwach" style="font-size:16px">🔋</span>` : '';
      return `<div class="tuer"><span title="${ti[2]}">${ic(ti[0], ti[1], 24, 1.8)}</span><span title="${si[2]}">${ic(si[0], si[1], 24, 1.8)}</span>${akku}</div>`;
    }
    _zeichneTempThrottle() { if (!this._tempT || Date.now() - this._tempT > 60000) { this._tempT = Date.now(); this._zeichneTemp(); } }
    _zeichneSonneThrottle() { if (!this._sonneT || Date.now() - this._sonneT > 60000) { this._sonneT = Date.now(); this._zeichneSonne(); } }
    _zeichneSonne() {
      // 16.10.2026 (Nutzer): Farben wie vgs_fenster.js (Dämmerung nach Sonnenhöhe, Nacht bläulich, Tag heller), je Tag Wochentag + kWh
      const el = this._$('sonne'); if (!el) return;
      const nu = Date.now(), bis = nu + 48 * 3600e3, D = 86400e3;
      const alle = this._s('sensor.vrm_prognose_stunden')?.attributes?.solar_yield_forecast || [];
      const f = alle.filter((p) => p[0] >= nu - 3600e3 && p[0] <= bis);
      const cf = this._h?.config || {}, lat = cf.latitude ?? 48.14, lon = cf.longitude ?? 11.58;
      const hoehe = (t) => { const R = Math.PI / 180, LAT = lat * R, n = (t - 946728000000) / D;
        const L = (280.46 + 0.9856474 * n) * R, G = (357.528 + 0.9856003 * n) * R;
        const la = L + (1.915 * Math.sin(G) + 0.02 * Math.sin(2 * G)) * R, ep = (23.439 - 4e-7 * n) * R;
        const ra = Math.atan2(Math.cos(ep) * Math.sin(la), Math.cos(la)), de = Math.asin(Math.sin(ep) * Math.sin(la));
        const H = ((18.697374558 + 24.06570982441908 * n) * 15 + lon) * R - ra;
        return Math.asin(Math.sin(LAT) * Math.sin(de) + Math.cos(LAT) * Math.cos(de) * Math.cos(H)) / R; };
      const Wd = 400, H = 82, top = 16, bot = 66, x = (t) => (t - nu) / (bis - nu) * Wd;
      let stops = '', pts = [];
      for (let i = 0; i <= 120; i++) {
        const t = nu + (bis - nu) * i / 120, h = hoehe(t); pts.push([x(t), h, t]);
        const q = Math.min(Math.max((h + 6) / 12, 0), 1), sm = q * q * (3 - 2 * q);
        stops += `<stop offset="${i / 120}" stop-color="rgb(${[20 + 22 * sm, 27 + 35 * sm, 54 + 50 * sm].map(Math.round)})"/>`;
      }
      const mx = Math.max(3000, ...f.map((p) => p[1]));
      let flaeche = '';
      if (f.length > 1) {
        const pp = f.map((p) => `${Math.max(Math.min(x(p[0] + 1800e3), Wd), 0).toFixed(1)},${(bot - p[1] / mx * (bot - top - 6)).toFixed(1)}`);
        flaeche = `<polygon points="${Math.max(x(f[0][0] + 1800e3), 0).toFixed(1)},${bot} ${pp.join(' ')} ${Math.min(x(f[f.length - 1][0] + 1800e3), Wd).toFixed(1)},${bot}" fill="#facc15" fill-opacity=".5" stroke="#fbbf24" stroke-width="1.5" stroke-linejoin="round"/>`;
      }
      let marken = '';
      for (let i = 1; i < pts.length; i++) {
        const [xa, ha] = pts[i - 1], [xb, hb] = pts[i]; if ((ha < 0) === (hb < 0)) continue;
        const xx = xa + (xb - xa) * ha / (ha - hb), auf = hb >= 0, t = nu + xx / Wd * (bis - nu);
        marken += `<text x="${(xx + (auf ? -3 : 3)).toFixed(1)}" y="${bot + 13}" fill="#fbbf24" fill-opacity=".85" font-size="10" text-anchor="${auf ? 'end' : 'start'}">${auf ? '☀↑ ' : ''}${hm(new Date(t))}${auf ? '' : ' ↓'}</text>`;
      }
      // Mitternacht + Tageskopf (Wochentag + Prognose kWh) mittig über dem Tageslicht des Tages im Fenster
      const m0 = new Date(); m0.setHours(0, 0, 0, 0);
      for (let m = m0.getTime(); m < bis; m += D) {
        if (m > nu) marken += `<line x1="${x(m).toFixed(1)}" x2="${x(m).toFixed(1)}" y1="${top}" y2="${bot}" stroke="#e5e7eb" stroke-opacity=".25"/>`;
        const kwh = alle.filter((p) => p[0] >= m && p[0] < m + D).reduce((s, p) => s + p[1], 0) / 1000;
        const hell = pts.filter((p) => p[1] > 0 && p[2] >= m && p[2] < m + D);
        const wt = new Date(m).toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
        if (hell.length) {
          const xm = (hell[0][0] + hell[hell.length - 1][0]) / 2;
          marken += `<text x="${Math.min(Math.max(xm, 30), Wd - 30).toFixed(1)}" y="${top - 4}" fill="#e5e7eb" font-size="11" text-anchor="middle"><tspan fill="#9ca3af">${wt}</tspan> <tspan font-weight="600">${zahl(kwh, 1)} kWh</tspan></text>`;
        } else if (m > nu && kwh > 0) {
          marken += `<text x="${Wd}" y="${top - 4}" fill="#9ca3af" font-size="11" text-anchor="end">${wt} ${zahl(kwh, 1)} kWh →</text>`;
        }
      }
      el.innerHTML = `<svg width="${Wd}" height="${H}" viewBox="0 0 ${Wd} ${H}" style="overflow:visible"><defs><linearGradient id="kgr" x1="0" x2="1" y1="0" y2="0">${stops}</linearGradient></defs>
        <rect x="0" y="${top}" width="${Wd}" height="${bot - top}" rx="4" fill="url(#kgr)"/>${flaeche}${marken}</svg>`;
    }
    // 16.10.2026 (Nutzer): Giebelfenster West (links) / Ost (rechts) als orange Flügel im Dach, Öffnungswinkel nach Position
    _hausSvg(T) { // 16.10.2026 abends (Nutzer): Haus in der Farbe der Hauptquelle
      const pos = (e) => { const x = this._s(e); const p = Number(x?.attributes?.current_position); return Number.isFinite(p) ? Math.max(Math.min(p, 100), 0) : (x?.state === 'open' ? 100 : 0); };
      const fl = (e, x1, y1, x2, y2, s) => { const p = pos(e), w = s * p * 0.7; // 100 % = 70°
        return `<g transform="rotate(${w.toFixed(1)} ${x2} ${y2})"><title>${e.endsWith('west') ? 'Fenster West' : 'Fenster Ost'} ${p} %</title><path d="M${x1} ${y1}L${x2} ${y2}" stroke="#fb923c" stroke-width="2.2"/></g>`; };
      return `<svg width="66" height="66" viewBox="0 0 24 24" fill="none" stroke="${T}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible">${ICON.haus}
        ${fl('cover.fenster_west', 6.15, 8.55, 9.3, 6.1, 1)}${fl('cover.fenster_ost', 17.85, 8.55, 14.7, 6.1, -1)}</svg>`;
    }
    // 21.10.2026 (Nutzer: „Phasenlast schöner“): Balken je Phase, Skala = größte Phase (mind. 1 kW), Strom ≈ W / 230 V,
    // Farbe nach Last: bis 2,3 kW (10 A) grau-blau, bis 3,7 kW (16 A) orange, darüber rot.
    _phasen() {
      const el = this._$('phasen'); if (!el) return;
      const v = [1, 2, 3].map((i) => Math.max(this._n('sensor.venus_verbrauchsleistung_l' + i), 0)), mx = Math.max(...v, 1000);
      el.innerHTML = v.map((w, i) => { const f = w > 3680 ? '#f87171' : w > 2300 ? '#fb923c' : '#7dd3fc';
        return `<div class="pz2"><span>L${i + 1}</span><div class="pbar"><i style="width:${Math.max(w / mx * 100, 2)}%;background:${f}"></i></div><b>${W(w)}</b><small>${zahl(w / 230, 1)} A</small></div>`; }).join('');
    }
    _energie() {
      const pv = Math.max(this._n('sensor.pv_gesamt'), 0), netz = this._n('sensor.em_540_netzmessgeraet_leistung'), haus = this._n('sensor.hausverbrauch');
      const akkuP = this._n('sensor.venus_dc_batterie_leistung'), soc = this._n('sensor.venus_dc_batterie_ladestand');
      // 16.10.2026 abends (Nutzer): kurz „voll 19:23“ (nur beim Laden) · „Reserve 23:57“
      const laden0 = this._n('sensor.venus_dc_batterie_leistung') > 30;
      const ap = (this._s('sensor.akku_prognose')?.state || '').replace(/an der Reserve ≈ /g, 'Reserve ').replace(/voll ≈ /g, 'voll ')
        .split(' · ').filter((x) => laden0 || !/^voll /.test(x)).join(' · ');
      const laden = akkuP > 30, entl = akkuP < -30;
      const fill = Math.max(Math.min(soc, 100), 0);
      // 16.10.2026 23:05 (Nutzer): Farben wie „Woher kommt der Strom“: Sonne gelb · Akku blau · Netz orange
      const AK = '#3b82f6', NZ = '#f97316';
      const akkuCol = laden || entl ? AK : M;
      // 16.10.2026 (Nutzer): Pfeil zum Haus läuft (Strömung) in der Farbe der Hauptquelle: Sonne gelb · Akku blau · Netz orange (seit 16.10. 23:05)
      const anteil = [[Math.min(pv, Math.max(haus, 0)), Y, 'vor allem Sonne'], [Math.max(-akkuP, 0), AK, 'vor allem Akku'], [Math.max(netz, 0), NZ, 'vor allem Netz']].sort((a, b) => b[0] - a[0])[0];
      const qc = anteil[0] > 30 ? anteil[1] : M, hc = anteil[0] > 30 ? anteil[1] : T, quelleTxt = anteil[0] > 30 ? anteil[2] : '';
      // 16.10.2026 abends (Nutzer): kleiner Pfeil ohne Bewegung (die Batterie pulsiert), Akku in 4 schräge Segmente à 25 %, Abstände 3,5 rundum (verschwinden von oben)
      // 21.10.2026 (Nutzer): Ladepfeil in der Farbe der Ladequelle – gelb, wenn PV-Überschuss ≥ halbe Ladeleistung, sonst orange (Netz)
      const lc = pv - Math.max(haus, 0) >= akkuP / 2 ? Y : NZ;
      const pfeil = laden ? `<svg class="ap" width="12" height="26" viewBox="0 0 12 26"><title>${lc === Y ? 'lädt aus PV' : 'lädt aus dem Netz'}</title><path d="M6 24V9M1.5 11L6 2.5l4.5 8.5z" stroke="${lc}" stroke-width="3" fill="${lc}" stroke-linejoin="round"/></svg>`
        : entl ? `<svg class="ap" width="12" height="26" viewBox="0 0 12 26"><path d="M6 2v15M1.5 15L6 23.5l4.5-8.5z" stroke="${AK}" stroke-width="3" fill="${AK}" stroke-linejoin="round"/></svg>` : '';
      const akku = `<svg width="46" height="78" viewBox="0 0 46 78" class="${qc === AK ? 'puls' : ''}" style="animation-delay:-${(Date.now() % 1600) / 1000}s"><rect x="16" y="2" width="14" height="6" rx="2" fill="${akkuCol}"/><rect x="3" y="8" width="40" height="67" rx="8" fill="none" stroke="${akkuCol}" stroke-width="3.5"/>${[0, 1, 2, 3].map((i) => { const yb = 69.75 - i * 14, yt = yb - 10.5; return fill >= i * 25 + 12.5 ? `<path d="M8.25 ${yb}L37.75 ${yb - 4}L37.75 ${yt - 4}L8.25 ${yt}Z" fill="${laden || entl ? AK : M}" fill-opacity=".55"/>` : ''; }).join('')}</svg>${pfeil}`;
      const akkuTxt = laden ? `Akku lädt ${W(akkuP)}` : entl ? `Akku entlädt ${W(-akkuP)}` : 'Akku ruht';
      // 21.10.2026 abends (Nutzer): im Teil-Modus ersetzt der Block den Batterie-Tacho → kWh + Reserve-Anteil mit anzeigen
      const res = this._s('sensor.venus_aktiver_soc_grenzwert') ? this._n('sensor.venus_aktiver_soc_grenzwert') : null;
      const kwhTxt = this._teil() ? `${zahl(soc * 0.3, 1)} von 30 kWh${res != null ? ` · ${zahl(Math.max(soc - res, 0) * 0.3, 1)} über Reserve` : ''}` : '';
      const apTxt = this._teil() && res != null ? ap.replace(/Reserve /, `Reserve ${zahl(res)} % · `) : ap;
      const netzTxt = netz > 30 ? 'aus dem Netz' : netz < -30 ? 'Einspeisung' : 'Netz';
      // Kategorien jetzt
      const vals = KAT.map((k) => {
        if (k.k === 'rest') return Math.max(this._n('sensor.rest_ungemessen') - this._n('sensor.kochen_leistung') - this._n('sensor.licht_ungemessen'), 0);
        if (k.k === 'kochen' && !this._s('sensor.kochen_anzeige')) return Math.max(this._n('sensor.kochen_leistung'), 0);   // bis kochen_anzeige existiert
        return this._sum(k.p);
      });
      const mx = Math.max(...vals, 1);
      // 16.10.2026 (Nutzer): nach Verbrauch sortiert, Rest immer unten; umsortieren erst ab 15 W Unterschied (sonst springt es)
      const alt = this._ord || KAT.map((_, i) => i);
      const ord = alt.filter((i) => KAT[i].k !== 'rest');
      for (let a = 1; a < ord.length; a++) for (let b = a; b > 0 && vals[ord[b]] > vals[ord[b - 1]] + 15; b--) [ord[b - 1], ord[b]] = [ord[b], ord[b - 1]];
      this._ord = [...ord, KAT.findIndex((k) => k.k === 'rest')];
      // 19.10.2026: mit Netzwerk/Smart Home/Haustechnik 13 Zeilen → passen nicht mehr; Zeilen unter 5 W ausblenden (Rest bleibt immer)
      const zeigen = this._ord.filter((i) => KAT[i].k === 'rest' || Math.round(vals[i]) >= 5);
      let liste = (zeigen.length < this._ord.length ? zeigen : this._ord).map((i) => ({ ...KAT[i], v: Math.round(vals[i]) }));
      // 19.10.2026 (Nutzer): Platz reicht für 10 Zeilen – laufen mehr, die kleinsten (ohne Rest) zu „Weitere“ zusammenfassen
      const MAXZ = 10;
      if (liste.length > MAXZ) {
        const rest = liste.filter((x) => x.k === 'rest'), ohne = liste.filter((x) => x.k !== 'rest');
        const bleibt = ohne.slice(0, MAXZ - 2), klein = ohne.slice(MAXZ - 2);
        liste = [...bleibt, { k: 'geraet', n: 'Weitere (' + klein.length + ')', c: '#9ca3af', v: klein.reduce((a, x) => a + x.v, 0), tip: klein.map((x) => x.n + ' ' + W(x.v)).join(' · ') }, ...rest];
      }
      const bars = liste.map((k) => {
        const v = k.v, an = v >= 5;
        return `<div class="kb${an ? '' : ' aus'}"${k.tip ? ` title="${esc(k.tip)}"` : ''}>${ic(k.k, an ? k.c : '#4b5563', 20)}<span>${k.n}</span><div class="kbar"><i style="width:${an ? Math.max(v / mx * 100, 3) : 0}%;background:${k.c}"></i></div><b>${W(v)}</b></div>`;
      }).join('');
      this._$('en').innerHTML = `<div class="quellen">
          <div class="qi${qc === Y ? ' puls' : ''}" style="animation-delay:-${(Date.now() % 1600) / 1000}s">${ic('sonne', pv > 30 ? Y : M, 30)}</div><div><b style="${pv > 30 ? `color:${Y}` : ''}">${W(pv)}</b><span>Sonne</span></div>
          <div class="qi${qc === NZ ? ' puls' : ''}" style="animation-delay:-${(Date.now() % 1600) / 1000}s">${ic('netz', netz > 30 ? NZ : M, 30)}</div><div><b>${W(Math.abs(netz))}</b><span>${netzTxt}</span></div>
          <div class="qi">${akku}</div><div><b>${zahl(soc)} %</b><span>${akkuTxt}</span>${kwhTxt ? `<span>${kwhTxt}</span>` : ''}${apTxt ? `<span>${esc(apTxt)}</span>` : ''}</div></div>
        <svg class="pfeil" width="46" height="28" viewBox="0 0 46 28" title="${quelleTxt}"><path class="fl" style="animation-delay:-${(Date.now() % 1000) / 1000}s" d="M3 14h28" stroke="${qc}" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M29 4.5L43 14 29 23.5z" stroke="${qc}" stroke-width="3" fill="${qc}" stroke-linejoin="round"/></svg>
        <div class="haus">${this._hausSvg(hc)}<b style="color:${hc}">${W(haus)}</b><span class="sm">Haus</span>${this._tuer()}</div>
        <div class="kats">${bars}</div>`;
    }
    _wann() {
      // 16.10.2026 (Nutzer): je Gerät Ampel + kurze Begründung; läuft = blau mit Restzeit + Fortschritt (Dauer aus *_startempfehlung.dauer_min)
      const g = [['wasch', 'Waschen', 'waschmaschine', 'sensor.waschmaschine_letzter_lauf'], ['trock', 'Trockner', 'trockner', 'sensor.trockner_letzter_lauf'], ['spuel', 'Spüli', 'spulmaschine', 'sensor.spulmaschine_letzter_gang']];
      const farbe = (s) => s.startsWith('🟢') ? G : s.startsWith('🟡') ? Y : s.startsWith('🔴') ? R : s.startsWith('🔵') ? B : M;
      const eur = (v) => zahl(v, 2) + ' €';
      // 16.10.2026 (Nutzer): Ø-Kosten je Lauf, wenn alles aus dem Netz käme (Ø kWh aus geraete_lauf_protokoll × Bezugspreis) – Gefühl fürs Warten auf PV
      const prot = this._s('sensor.geraete_lauf_protokoll')?.attributes?.laeufe || [], preis = this._n('input_number.strompreis_bezug') / 100;
      const kosten = (gk) => { const v = prot.filter((r) => r.g === gk && r.kwh > 0.05).map((r) => r.kwh); return v.length >= 3 && preis > 0 ? v.reduce((a, b) => a + b, 0) / v.length * preis : null; };
      const GK = { waschmaschine: 'wasch', trockner: 'trock', spulmaschine: 'spul' };
      const html = g.map(([i, n, k, lauf]) => {
        const s = this._s('sensor.wann_' + k)?.state || '–', c = farbe(s), t = s.replace(/^[^\p{L}\p{N}]+/u, '');
        const A = this._s(`sensor.${k}_startempfehlung`)?.attributes || {};
        let grund = '', balken = '';
        if (c === B) {
          const st = Date.parse(this._s(lauf)?.attributes?.start || this._s(`binary_sensor.${k}_lauft`)?.attributes?.start || '');
          const vorbei = Number.isFinite(st) ? (Date.now() - st) / 60000 : NaN;
          // 19.10.2026 (Nutzer): Restzeit mitlernend = Median der letzten 15 Läufe, die schon länger liefen als dieser jetzt
          // (Kurzprogramme fallen mit der Zeit raus); ohne passende Läufe Dauer aus der Startempfehlung (letzter Lauf / 90 min)
          const lang = prot.filter((r) => r.g === GK[k] && r.dauer_min >= 20 && r.kwh >= 0.2 && r.kwh <= 5).slice(-15).map((r) => r.dauer_min)
            .filter((d) => d > vorbei).sort((x, y) => x - y);
          const dauer = lang.length >= 2 ? lang[Math.floor(lang.length / 2)] : Number(A.dauer_min) || 0;
          if (dauer > 0 && Number.isFinite(vorbei)) {
            const rest = Math.round(dauer - vorbei);
            grund = rest > 1 ? `noch ≈ ${rest < 90 ? rest + ' min' : zahl(rest / 60, 1) + ' h'}` : 'gleich fertig';
            balken = `<div class="lb"><i style="width:${Math.min(Math.max(vorbei / dauer * 100, 3), 100).toFixed(0)}%"></i></div>`;
          }
        } else if (c === Y || c === R) {
          // 16.10.2026 (Nutzer): Grün ohne Text; Orange/Rot = warum warten
          const gratis = A.gratis_ab && A.start && Date.parse(A.gratis_ab) <= Date.parse(A.start) + 60000;
          grund = `spart ${eur(A.ersparnis ?? 0)}\n${gratis ? 'dann gratis' : (A.pv_uberschuss_best || 0) > 0.3 ? 'dann mit Sonne' : 'dann günstiger'}`;
        }
        return `<div class="wg">${ic(i, c, 50, 1.5)}${balken}<b style="color:${c}">${esc(t)}</b><span>${n}</span>${(() => { const ko = kosten(GK[k]); return `<small class="ko" title="Ø je Lauf, wenn alles aus dem Netz käme">${ko != null ? 'Ø ' + eur(ko) : '&nbsp;'}</small>`; })()}<em>${esc(grund).replace('\n', '<br>')}</em></div>`;
      }).join('');
      // 16.10.2026 (Nutzer): Wärmepumpe als viertes Symbol – läuft = blau mit AZ des Laufs + „seit“, sonst grau mit letzter AZ
      let wp;
      const lauf = this._s('sensor.wp_lauf_laufend');
      if (lauf?.state === 'läuft') {
        const su = lauf.attributes?.summen || {}, st = lauf.attributes?.start ? new Date(lauf.attributes.start) : null;
        const az = su.strom > 0.05 ? su.waerme / su.strom : null;
        wp = `<div class="wg">${ic('wp', B, 50, 1.5)}<b style="color:${B}">AZ ${az != null ? zahl(az, 1) : '…'}</b><span>Wärmepumpe</span><small class="ko">${st ? 'seit ' + hm(st) : 'läuft'}</small></div>`;
      } else {
        const l = (this._s('sensor.wp_lauf_protokoll')?.attributes?.laeufe || [])[0];
        wp = `<div class="wg">${ic('wp', M, 50, 1.5)}<b style="color:${M}">aus</b><span>Wärmepumpe</span><small class="ko">${l ? 'AZ ' + zahl(l.az, 1) : '&nbsp;'}</small></div>`;
      }
      this._$('wann').innerHTML = `<div class="wann">${html}${wp}</div>`;
    }
    _hinweise() {
      const z = [];
      const st = (e) => this._s(e)?.state;
      if (st('binary_sensor.rauchmelder_technikraum') === 'on') z.push(['alarm', 'warn', R, 'Rauchmelder Technikraum!']);
      if (st('binary_sensor.keller_wassermelder_bwwp_uberflutung') === 'on') z.push(['alarm', 'warn', R, 'Wassermelder Keller!']);
      const offen = [['cover.fenster_ost', 'Ost'], ['cover.fenster_west', 'West']].filter(([e]) => ['open', 'opening'].includes(st(e)));
      // 16.10.2026 (Nutzer): Stellung zeigt das Haus in „Energie jetzt“ → Hinweis nur noch bei Regen
      if (offen.length && st('binary_sensor.regen_erwartet') === 'on') {
        const regen = true;
        const pos = offen.map(([e]) => this._s(e)?.attributes?.current_position).filter((p) => p != null);
        z.push([regen ? 'warn' : 'info', 'fenster', regen ? '#fb923c' : M, `Fenster ${offen.map((o) => o[1]).join(' + ')} offen${pos.length ? ` (${pos.join('/')} %)` : ''}${regen ? ' – Regen erwartet' : ''}`]);
      }
      if (st('binary_sensor.frost_in_sicht') === 'on' && st('input_boolean.garten_winterfest') !== 'on') z.push(['warn', 'warn', '#fb923c', 'Frost in Sicht – Garten winterfest machen']);
      // 19.10.2026: Laufende aus attributes.ende bzw. sensor.geraete_lauf_protokoll (Start „TT.MM. HH:MM“ + dauer_min) –
      // NICHT last_changed: jedes Template-Neuladen setzt es (Nutzer: „Trockner/Spüli fertig vor 0 min“, liefen gar nicht)
      const lp = this._s('sensor.geraete_lauf_protokoll')?.attributes?.laeufe || [];
      const lpEnde = (g) => { const x = [...lp].reverse().find((l) => l.g === g); if (!x) return NaN;
        const m = /^(\d+)\.(\d+)\. (\d+):(\d+)/.exec(x.start || ''); if (!m) return NaN;
        const j = new Date(); let d = new Date(j.getFullYear(), +m[2] - 1, +m[1], +m[3], +m[4]);
        if (d > j) d = new Date(j.getFullYear() - 1, +m[2] - 1, +m[1], +m[3], +m[4]);
        return d.getTime() + (x.dauer_min || 0) * 60000; };
      for (const [e, n, g] of [['binary_sensor.waschmaschine_lauft', 'Waschmaschine', 'wasch'], ['binary_sensor.trockner_lauft', 'Trockner', 'trock'], ['binary_sensor.spulmaschine_lauft', 'Spülmaschine', 'spul']]) {
        const s = this._s(e); if (!s || s.state !== 'off') continue;
        const ende = s.attributes?.ende ? Date.parse(s.attributes.ende) : lpEnde(g), min = (Date.now() - ende) / 60000;
        if (min >= 0 && min < 180) z.push(['ok', 'ok', G, `${n} fertig · vor ${min < 60 ? Math.round(min) + ' min' : zahl(min / 60, 1) + ' h'}`]);
      }
      // 16.10.2026: ohne Hinweis Kachel ausblenden → Platz für Räume + Temperaturkurve; ✓ dann im Räume-Kopf
      this._$('hin').innerHTML = z.slice(0, 3).map(([k, i, c, t]) => `<div class="zeile ${k}">${ic(i, c, 18)}<span>${esc(t)}</span></div>`).join('');
      this._$('hin').parentElement.style.display = z.length ? '' : 'none';
      this._$('ruhig').innerHTML = z.length ? '' : `${ic('ok', G, 14)}<span style="text-transform:none;letter-spacing:0">alles ruhig</span>`;
    }
    // 16.10.2026 (Nutzer): Mini-Kurve wie „Temperaturen außen & innen“ – 36 h zurück (Stundenmittel) + 36 h Prognose
    async _ladeTemp() {
      if (!this._h) return;
      const A = 'sensor.cmi_t_aussen', I = 'sensor.cmi_t_raum', nu = Date.now();
      try {
        const r = await this._h.callWS({ type: 'recorder/statistics_during_period', start_time: new Date(nu - 36 * 3600e3).toISOString(), period: 'hour', statistic_ids: [A, I], types: ['mean'] });
        const f = (id) => (r[id] || []).map((p) => [p.start + 1800e3, p.mean]).filter((p) => p[1] != null);
        this._tk = { a: f(A), i: f(I) }; this._zeichneTemp();
      } catch (e) { /* bleibt leer */ }
    }
    _zeichneTemp() {
      const el = this._$('tkurve'); if (!el || !this._tk) return;
      const nu = Date.now(), von = nu - 36 * 3600e3, bis = nu + 36 * 3600e3, Wd = 292, H = 96, l = 18, o = 4, u = 82;
      const ta = this._n('sensor.cmi_t_aussen'), ti = this._n('sensor.cmi_t_raum');
      const a = [...this._tk.a, [nu, ta]], i = [...this._tk.i, [nu, ti]];
      const pr = [[nu, ta], ...(this._s('sensor.aussen_prognose_stunden')?.attributes?.temp || []).filter((p) => p[0] > nu + 1800e3 && p[0] <= bis)];
      const v = [...a, ...i, ...pr].map((p) => p[1]);
      const lo = Math.floor(Math.min(...v, 0) / 5) * 5, hi = Math.ceil(Math.max(...v) / 5) * 5;
      const x = (t) => l + (t - von) / (bis - von) * (Wd - l), y = (w) => u - (w - lo) / (hi - lo || 1) * (u - o);
      const pfad = (L) => L.map((p, k) => `${k ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join('');
      let g = '';
      for (let w = lo; w <= hi; w += 10) g += `<line x1="${l}" x2="${Wd}" y1="${y(w)}" y2="${y(w)}" stroke="#2b2d31" stroke-dasharray="2 3"/><text x="${l - 4}" y="${y(w) + 3}" text-anchor="end">${w}</text>`;
      const tag = new Date(von); tag.setHours(24, 0, 0, 0);
      for (let t = tag.getTime(); t < bis; t += 86400e3) g += `<line x1="${x(t)}" x2="${x(t)}" y1="${o}" y2="${u}" stroke="#2b2d31"/><text x="${x(t) + 3}" y="${H - 2}">${new Date(t).toLocaleDateString('de-DE', { weekday: 'short' })}</text>`;
      el.innerHTML = `<svg width="${Wd}" height="${H}" viewBox="0 0 ${Wd} ${H}">${g}
        <path d="${pfad(a)}L${x(nu)} ${u}L${x(a[0][0])} ${u}Z" fill="rgba(59,130,246,.22)"/>
        <path d="${pfad(a)}" fill="none" stroke="#3b82f6" stroke-width="1.8"/>
        <path d="${pfad(pr)}" fill="none" stroke="#93c5fd" stroke-width="1.6" stroke-dasharray="3 3"/>
        <path d="${pfad(i)}" fill="none" stroke="#ef4444" stroke-width="1.8"/>
        <line x1="${x(nu)}" x2="${x(nu)}" y1="${o}" y2="${u}" stroke="${M}" stroke-dasharray="2 2"/>
        <circle cx="${x(nu)}" cy="${y(ta)}" r="3.5" fill="#3b82f6" stroke="#fff" stroke-width="1"/></svg>`;
    }
    _raeume() {
      const ort = (e, f) => { const s = this._s(e)?.state; return s && !['unknown', 'unavailable'].includes(s) ? s : f; };
      const tv = (e) => { const s = this._s(e); const v = s ? parseFloat(s.state) : NaN; return Number.isFinite(v) ? zahl(v, 1) + '°' : '–'; };
      const ico = (n) => /bad/i.test(n) ? 'bad' : /\bwc\b|toilette/i.test(n) ? 'wc' : /flur|diele/i.test(n) ? 'flur' : /lese|büro|arbeit/i.test(n) ? 'buch' : /emil|schlaf|gäste|gz|dachspitz/i.test(n) ? 'bett' : /wohn|wz|wintergarten/i.test(n) ? 'sofa' : 'raum';
      const L = [['sofa', 'Wohnzimmer', tv('sensor.cmi_t_raum')]];
      for (const [e, s, f] of [['sensor.ht_b_temperatur', 'input_select.ht_b_standort', 'Bad OG'], ['sensor.ht_a_temperatur', 'input_select.ht_a_standort', 'H&T A'], ['sensor.ht_c_temperatur', 'input_select.ht_c_standort', 'H&T C']]) {
        const n = ort(s, f); L.push([ico(n), n, tv(e)]);
      }
      // 16.10.2026 (Nutzer): Daikin-Raumtemperaturen (ganzzahlig) dazu – nur, wenn dort gerade kein H&T steht
      const htOrte = ['input_select.ht_a_standort', 'input_select.ht_b_standort', 'input_select.ht_c_standort'].map((e) => this._s(e)?.state);
      for (const [e, n, i, h] of [['sensor.wintergarten_climatecontrol_raumtemperatur', 'Wintergarten', 'sofa', 'WiGa-Ende'], ['sensor.emil_climatecontrol_raumtemperatur', 'Emil', 'bett', 'Emils Zimmer'], ['sensor.dachspitz_climatecontrol_raumtemperatur', 'Dachspitz', 'bett', '']]) {
        if (h && htOrte.includes(h)) continue;
        const v = parseFloat(this._s(e)?.state); L.push([i, n, Number.isFinite(v) ? zahl(v, 1) + '°' : '–']);
      }
      const kf = this._s('sensor.keller_ht_feuchte');
      L.push(['tropfen', 'Keller', kf && Number.isFinite(parseFloat(kf.state)) ? zahl(parseFloat(kf.state), 1) + ' %' : '–']);
      L.push(['speicher', 'Warmwasser', tv('sensor.cmi_bwwp_mitte')]);
      requestAnimationFrame(() => { // 16.10.2026: Platz knapp (Hinweise sichtbar) → erst die Kurve weglassen
        const tk = this._$('tkurve'), box = tk?.parentElement; if (!box) return;
        tk.style.display = ''; if (box.scrollHeight > box.clientHeight + 1) tk.style.display = 'none';
      });
      // 16.10.2026: Einheit in eigener Spalte → Zahlen stehen bündig (% ist breiter als °)
      this._$('raeume').innerHTML = L.map(([i, n, v]) => { const m = String(v).match(/^(.*?)\s*(°|%)$/);
        return `<div class="r">${ic(i, M, 18)}<span>${esc(n)}</span><b>${m ? m[1] : v}</b><b style="text-align:left;margin-left:-5px">${m ? m[2] : ''}</b></div>`; }).join('');
    }
    _fuss() {
      // 16.10.2026 (Nutzer): heute Netzstrom € + Wasser l, Gas-Ersparnis immer letzte 30 Tage (gasvergleich.tage: gas_eur − wp_eur)
      const netzKwh = Math.max(this._n('sensor.em_540_netzmessgeraet_verbrauch') - this._n('input_number.em540_bezug_mitternacht'), 0);
      const pr = this._n('input_number.strompreis_bezug'), eur = netzKwh * (pr > 2 ? pr / 100 : pr);   // Helfer in ct/kWh
      const tage = (this._s('sensor.gasvergleich')?.attributes?.tage || []).slice(-30);
      // 20.10.2026 (Nutzer): kompletter Umstieg – früher (Gas + Hausstrom aus dem Netz) gegen heute (Netzbezug − Einspeisung), gasvergleich.yaml
      const tg = tage.filter((t) => t.frueher_eur != null), ges = tg.reduce((x, t) => x + t.frueher_eur - t.heute_eur, 0);
      const gas = tage.reduce((x, t) => x + (t.gas_eur || 0) - (t.wp_eur || 0), 0);
      this._$('fuss').innerHTML = `<span>heute <b>${zahl(eur, 2)} €</b> Netzstrom</span>${tg.length ? `<span>trotzdem <b>${zahl(ges)} €</b> gespart in ${tg.length} Tagen <small>(gegenüber Gas + Netzstrom)</small></span>` : `<span><b>${zahl(gas)} €</b> gespart gegenüber Gas in ${tage.length} Tagen</span>`}`;   // 20.10.2026 (Nutzer): Wasser nicht mehr in der Fußzeile – steht in der Torte
    }
    // Torten aus der Langzeitstatistik
    async _ladeStat() {
      if (!this._h || this._statLaeuft) return; this._statLaeuft = true;
      try {
        const z = this._zeit, d0 = new Date(); d0.setHours(0, 0, 0, 0);
        let start, end, period = 'day';
        if (z === 'heute') { start = d0; period = '5minute'; }
        else if (z === 'gestern') { end = d0; start = new Date(d0.getTime() - 86400e3); }
        else if (z === 'woche') { start = new Date(d0.getTime() - 6 * 86400e3); period = 'hour'; }
        else { start = new Date(d0); start.setDate(1); period = 'hour'; }
        const ids = [...new Set([...KAT.flatMap((k) => k.e || []), HAUS_E, NETZ_E, ...WASSER.flatMap((w) => w[2])])];
        const r = await this._h.callWS({ type: 'recorder/statistics_during_period', start_time: start.toISOString(), ...(end ? { end_time: end.toISOString() } : {}), statistic_ids: ids, period, types: ['change'] });
        const sum = (id) => {
          const u = this._s(id)?.attributes?.unit_of_measurement, f = u === 'Wh' ? 1 / 1000 : 1;
          return (r[id] || []).reduce((s, p) => s + (p.change || 0), 0) * f;
        };
        const kat = KAT.filter((k) => k.e).map((k) => [k.n, k.c, k.e.reduce((s, id) => s + sum(id), 0)]);
        const haus = sum(HAUS_E), rest = Math.max(haus - kat.reduce((s, x) => s + x[2], 0), 0);
        kat.push(['Rest', '#6b7280', rest]);
        const wasser = WASSER.map(([n, c, l]) => [n, c, l.reduce((s, id) => s + sum(id), 0)]);
        const zn = ZEIT.find((x) => x[0] === z)[1];
        this._tortenDaten = this._tortenDaten || {};
        // 20.10.2026 (Familie: „wie viel davon ist eigener Strom?“): innerer Ring PV/Akku grün / Netz grau wie „Früher ↔ heute“
        const netz = Math.min(sum(NETZ_E), haus), pvq = haus > 0 ? [haus - netz, netz] : null;
        this._tortenDaten.ts = [kat.filter((x) => x[2] >= 0.05).map((x) => [...x, ...(GRUPPE_S[x[0]] || HAUSSTROM)]), zahl(haus, haus >= 100 ? 0 : 1), `kWh ${zn}`, (v) => zahl(v, v >= 100 ? 0 : 1), pvq];
        const wl = wasser.reduce((s, x) => s + x[2], 0);
        this._tortenDaten.tw = [wasser.filter((x) => x[2] >= 0.5).map((x) => [...x, GRUPPE_W[x[0]] || 'kalt im Haus']), zahl(wl) + ' l', zn, (v) => zahl(v)];
        this._zeigeTorten();
        this._statZeit = Date.now();
      } catch (e) { console.warn('vgs-kueche Statistik', e); }
      this._statLaeuft = false;
    }
    _zeigeTorten() {
      for (const id of ['ts', 'tw']) {
        const d = this._tortenDaten?.[id], el = this._$(id); if (!d || !el) continue;
        let det = false; try { det = localStorage.getItem('vgsKuecheTorte_' + id) === '1'; } catch (e) {}
        el.innerHTML = this._torte(d[0], d[1], d[2], d[3], det, d[4]);
        el.style.cursor = 'pointer'; el.title = det ? 'Antippen: nur Gruppen' : 'Antippen: Details';
        el.onclick = () => { try { localStorage.setItem('vgsKuecheTorte_' + id, det ? '0' : '1'); } catch (e) {} this._zeigeTorten(); };
      }
    }
    // teile: [name, farbe, wert, gruppe, gruppenfarbe?] · grob = ein Ring Gruppen · det = innen Gruppen, außen Einzelteile (gleiche Reihenfolge)
    // pvq = [kWh aus PV/Akku, kWh aus dem Netz] → dünner innerer Ring + ☀ % in der Mitte (nur Strom)
    _torte(teile, mitte, unter, fmt, det, pvq) {
      const cx = 85, cy = 85, gr = [];
      for (const t of teile) { let g = gr.find((x) => x[0] === t[3]); if (!g) gr.push(g = [t[3], t[4] || GFARBE[t[3]] || '#6b7280', 0]); g[2] += t[2]; }
      gr.sort((a, b) => (a[0] === 'Rest') - (b[0] === 'Rest') || b[2] - a[2]);
      const auss = gr.flatMap((g) => teile.filter((t) => t[3] === g[0]));
      const tot = teile.reduce((s, x) => s + x[2], 0);
      const ring = (liste, r, w, pz) => { const L = 2 * Math.PI * r; let a = 0, s = '';
        if (tot <= 0) return `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="#26282c" stroke-width="${w}" fill="none"/>`;
        for (const [, c, v] of liste) { const f = v / tot;
          s += `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${c}" stroke-width="${w}" fill="none" stroke-dasharray="${Math.max(f * L - 1.5, 0).toFixed(1)} ${L.toFixed(1)}" stroke-dashoffset="${(-a * L).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`;
          if (pz && f >= 0.07) { const m = (a + f / 2) * 2 * Math.PI; s += `<text x="${(cx + r * Math.sin(m)).toFixed(1)}" y="${(cy - r * Math.cos(m) + 4).toFixed(1)}" class="pz">${Math.round(f * 100)}%</text>`; }
          a += f; }
        return s; };
      let s = det ? ring(gr, 56, 16, true) + ring(auss, 76, 12, false) : ring(gr, 66, 24, true);
      let pvTxt = '', legPv = '';
      const pvGes = pvq ? pvq[0] + pvq[1] : 0;
      if (pvGes > 0) {
        const r = det ? 43 : 49, L = 2 * Math.PI * r, f = pvq[0] / pvGes;
        s += `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="#4b5563" stroke-width="5" fill="none"/>`
          + `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="#4ade80" stroke-width="5" fill="none" stroke-dasharray="${(f * L).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`;
        pvTxt = `<text x="${cx}" y="${cy + 33}" text-anchor="middle" fill="#4ade80" font-size="12" font-weight="600">☀ ${Math.round(f * 100)} %</text>`;
        legPv = `<div><i style="background:#4ade80"></i>PV/Akku<b>${fmt(pvq[0])}</b></div><div><i style="background:#4b5563"></i>Netz<b>${fmt(pvq[1])}</b></div>`;
      }
      const leg = (det ? auss : gr).map(([n, c, v]) => `<div><i style="background:${c}"></i>${esc(n)}<b>${fmt(v)}</b></div>`).join('') + legPv;
      const yM = pvTxt ? cy - 2 : cy + 2, yU = pvTxt ? cy + 15 : cy + 19, yD = pvTxt ? cy - 24 : cy + 32;
      return `<svg width="170" height="170" viewBox="0 0 170 170">${s}<text x="${cx}" y="${yM}" text-anchor="middle" fill="#e5e7eb" font-size="${det ? 21 : 24}">${mitte}</text><text x="${cx}" y="${yU}" text-anchor="middle" fill="#9ca3af" font-size="11">${esc(unter)}</text>${pvTxt}<text x="${cx}" y="${yD}" text-anchor="middle" fill="#4b5563" font-size="9">${det ? '▴ grob' : '▾ Details'}</text></svg><div class="leg">${leg}</div>`;
    }
  }
  if (!customElements.get('vgs-kueche-card')) customElements.define('vgs-kueche-card', VgsKueche);
  window.customCards = window.customCards || []; window.customCards.push({ type: 'vgs-kueche-card', name: 'VGS Küche (iPad)' });
})();

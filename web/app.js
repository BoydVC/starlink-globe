(function () {
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => (n == null || n !== n ? "—" : Number(n).toLocaleString("en-US"));
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  function etParts(d) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(d);
  }
  function clockTick() {
    const now = new Date();
    const et = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
    const utc = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now);
    $("clock-et").textContent = et;
    $("clock-utc").textContent = utc;
  }

  function fmtET(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(d);
  }

  function tminus(iso, precision) {
    if (!iso) return { label: "NET unknown", coarse: true };
    const d = new Date(iso);
    if (isNaN(d)) return { label: String(iso), coarse: true };
    const prec = (precision || "").toLowerCase();
    const coarse = !(prec.includes("second") || prec.includes("minute") || prec.includes("hour"));
    if (coarse) {
      return {
        label: "NET " + new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", year: "numeric" }).format(d),
        coarse: true,
      };
    }
    const ms = d - Date.now();
    const sign = ms >= 0 ? "T−" : "T+";
    let s = Math.abs(Math.floor(ms / 1000));
    const dd = Math.floor(s / 86400);
    s %= 86400;
    const hh = Math.floor(s / 3600);
    s %= 3600;
    const mm = Math.floor(s / 60);
    s %= 60;
    const pad = (n) => String(n).padStart(2, "0");
    const core = dd > 0 ? `${dd}d ${pad(hh)}:${pad(mm)}:${pad(s)}` : `${pad(hh)}:${pad(mm)}:${pad(s)}`;
    return { label: sign + core, coarse: false, ms };
  }

  let DATA = null;

  function renderConstellation(d) {
    const m = d.mcdowell || {};
    const cel = d.celestrak || {};
    const el = $("constellation");
    if (!m.available) {
      el.innerHTML = `<div class="gap">GAP: ${esc(m.gap || "McDowell stats unavailable")}</div>`;
      $("sl-asof").textContent = "gap";
      $("src-constellation").innerHTML = esc(m.label || "");
      return;
    }
    const t = m.total || {};
    $("sl-asof").textContent = m.dataAsOf ? "as of " + m.dataAsOf : "—";
    const gens = m.byGen || {};
    const maxLaunch = Math.max(1, ...Object.values(gens).map((g) => g.launched || 0));
    const genHtml = Object.entries(gens)
      .map(([name, g]) => {
        const cls = /Gen3D/.test(name) ? "g3" : /Gen3/.test(name) ? "g3" : /Gen2/.test(name) ? "g2" : "g1";
        const pct = Math.round(((g.inOrbit || 0) / maxLaunch) * 100);
        return `<div class="genrow"><span>${esc(name.replace("Starlink ", ""))}</span><span class="bar ${cls}"><i style="width:${pct}%"></i></span><span>${fmt(g.inOrbit)}</span></div>`;
      })
      .join("");
    el.innerHTML = `
      <div class="statgrid">
        <div class="stat accent"><div class="n">${fmt(t.inOrbit)}</div><div class="l">in orbit (McDowell)</div></div>
        <div class="stat good"><div class="n">${fmt(t.working)}</div><div class="l">working</div></div>
        <div class="stat"><div class="n sm">${fmt(t.operational)}</div><div class="l">operational orbit</div></div>
        <div class="stat"><div class="n sm">${fmt(t.launched)}</div><div class="l">launched (lifetime)</div></div>
        <div class="stat violet"><div class="n sm">${fmt(t.ascent)}</div><div class="l">ascent</div></div>
        <div class="stat"><div class="n sm">${fmt(t.drift)}</div><div class="l">drift</div></div>
        <div class="stat gold"><div class="n sm">${fmt(cel.count)}</div><div class="l">CelesTrak tracked (cache)</div></div>
        <div class="stat"><div class="n sm">${fmt(t.down)}</div><div class="l">down / decayed</div></div>
      </div>
      <div class="genbar"><div class="rt" style="margin:8px 0 2px">In orbit by generation</div>${genHtml}</div>`;
    const celNote = cel.fetched_at
      ? `CelesTrak cache fetched ${esc(cel.fetched_at)} · count ${fmt(cel.count)}${cel.note ? " · " + esc(cel.note) : ""}`
      : "CelesTrak cache missing";
    $("src-constellation").innerHTML = `${esc(m.label)} · dataAsOf ${esc(m.dataAsOf || "—")}${m.fetchedAt ? " · Mission Control fetched " + esc(m.fetchedAt) : ""}<br>${celNote}`;
  }

  function renderFCC(d) {
    const f = d.fccMobile || {};
    const el = $("fcc");
    if (!f.available) {
      el.innerHTML = `<div class="gap">GAP: ${esc(f.gap || "No FCC Mobile notes in Jim journals")}</div>`;
      $("src-fcc").textContent = "";
      return;
    }
    // Prefer research bullets
    let bullets = [];
    let hero = "FCC approved <span>15,000</span> next-gen Starlink Mobile (direct-to-device) satellites";
    for (const fact of f.facts || []) {
      if (fact.bullets) bullets = fact.bullets;
      if (fact.claim && /FCC approved/.test(fact.claim)) hero = esc(fact.claim).replace(/15,?000/, "<span>$&</span>");
    }
    const keyLabel = {
      spectrum: "Spectrum",
      carrier_waiver: "Carrier rule",
      promised_speed: "Promised",
      current_speed: "Today",
      deadline_50: "Deadline 50%",
      deadline_full: "Deadline full",
      more_spectrum: "More spectrum",
      v2_bandwidth: "V2 bandwidth",
    };
    const lis = bullets
      .map((b) => `<li><span class="k">${esc(keyLabel[b.key] || b.key)}</span>${esc(b.text)}</li>`)
      .join("");
    el.innerHTML = `<div class="fcc-hero">${hero}</div>
      ${lis ? `<ul class="fcc-list">${lis}</ul>` : ""}
      <p class="extra" style="color:var(--muted);font-size:11.5px;margin:8px 0 0">Quoted from Jim journals — not an FCC primary-document digest. Gaps labeled if a field was not in those files.</p>`;
    const links = (f.sources || [])
      .map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, "").slice(0, 48))}</a>`)
      .join(" · ");
    $("src-fcc").innerHTML = `${esc(f.label || "Jim journal")}${(f.files || []).length ? " · " + f.files.map(esc).join(", ") : ""}${links ? "<br>" + links : ""}`;
  }

  function renderLaunches(d) {
    const L = d.launches || {};
    const el = $("launches");
    const items = L.items || [];
    if (!items.length) {
      el.innerHTML = `<div class="gap">GAP: ${esc(L.gap || "No Starlink launches in LL2 cache")}</div>`;
    } else {
      el.innerHTML = items
        .map((x) => {
          const tm = tminus(x.net, x.netPrecision);
          return `<div class="ln">
            <b>${esc(x.mission || x.name)}</b>
            <div class="meta">${esc(x.vehicle || "")} · ${esc(x.pad || "")}${x.location ? " · " + esc(x.location) : ""}</div>
            <div class="meta">NET ${esc(fmtET(x.net))} · precision ${esc(x.netPrecision || "—")}</div>
            <div class="t">${esc(tm.label)}${tm.coarse ? " (coarse NET — no fake countdown)" : ""}</div>
            <span class="badge">${esc(x.statusAbbrev || x.status || "—")}</span>
            ${x.missionDesc ? `<div class="meta" style="margin-top:6px">${esc(x.missionDesc)}</div>` : ""}
          </div>`;
        })
        .join("");
    }
    // Also note journal cadence may differ
    $("src-launch").innerHTML = `${esc(L.label || "Launch Library 2")}${L.fetchedAt ? " · fetched " + esc(L.fetchedAt) : ""}`;

    // pads for globe
    if (window.SGGlobe) {
      window.SGGlobe.pads = items
        .filter((x) => x.lat != null && x.lon != null)
        .map((x) => ({ lat: x.lat, lon: x.lon, label: (x.pad || "pad").replace("Space Launch Complex ", "SLC-") }));
      if (d.millersville) window.SGGlobe.millersville = d.millersville;
    }
  }

  function renderJournal(d) {
    const c = d.cadence || {};
    const el = $("journal");
    const cards = c.cards || [];
    if (!cards.length) {
      el.innerHTML = `<div class="gap">GAP: ${esc(c.gap || "No journal cards")}</div>`;
      $("src-journal").textContent = "";
      return;
    }
    el.innerHTML =
      `<div class="jgrid">` +
      cards
        .map((card) => {
          const links = (card.links || [])
            .slice(0, 3)
            .map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">src</a>`)
            .join("");
          return `<article class="jcard">
            <h3>${esc(card.title)}</h3>
            <p>${esc(card.body)}</p>
            ${card.extra ? `<div class="extra">${esc(card.extra)}</div>` : ""}
            <div class="file">${esc(card.file)}${card.when ? " · " + esc(card.when) : ""}</div>
            ${links}
          </article>`;
        })
        .join("") +
      `</div>`;
    $("src-journal").textContent = c.label || "Jim Interest Journal";
    $("journal-rt").textContent = cards.length + " cards";
  }

  function renderHonesty(d) {
    const el = $("honesty");
    const items = (d.honesty || []).map((h) => `<li>${esc(h)}</li>`).join("");
    el.innerHTML = `<ul>${items}</ul>
      <p style="margin:10px 0 0;font-size:11.5px;color:var(--muted)">Remaster: ${esc(d.remaster || "")} · generated ${esc(d.generatedAtET || d.generatedAt || "")}</p>`;
  }

  function renderGlobeLegend(d) {
    const shells = d.shells || [];
    $("globe-legend").innerHTML =
      shells
        .map((s, i) => {
          const cols = ["#5cc8ff", "#78b4ff", "#9b7bff", "#c896ff"];
          return `<span><i class="sw" style="background:${cols[i % cols.length]}"></i>${esc(s.label)} · ILLUSTRATIVE</span>`;
        })
        .join("") +
      `<span><i class="sw" style="background:#ffd24c"></i>Millersville marker</span>`;
    $("src-globe").textContent =
      "Decorative shell dots only — not live SGP4. Day/night terminator from low-precision solar position. Land: Natural Earth 110m (via Mission Control land.js). Legacy live-track globe archived under legacy/.";
  }

  function render(d) {
    DATA = d;
    if (window.__SG_SNAPSHOT__) {
      $("mode-pill").textContent = "OFFLINE SNAPSHOT";
      $("mode-pill").classList.add("warn");
    }
    $("remaster-pill").textContent = "SAT OCT 10";
    renderConstellation(d);
    renderFCC(d);
    renderLaunches(d);
    renderJournal(d);
    renderHonesty(d);
    renderGlobeLegend(d);
    $("foot-l").textContent = `Starlink Globe · ${d.remaster || "TokenMax"}`;
  }

  async function load() {
    if (window.__SG_SNAPSHOT__ && window.__SG_SNAPSHOT__.data) {
      render(window.__SG_SNAPSHOT__.data);
      return;
    }
    try {
      const r = await fetch("/api/globe.json", { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      render(await r.json());
    } catch (e) {
      $("constellation").innerHTML = `<div class="gap">Failed to load data/globe.json — run collect.py / ./run.sh (${esc(e.message)})</div>`;
    }
  }

  // refresh countdowns
  setInterval(() => {
    clockTick();
    if (DATA) renderLaunches(DATA);
  }, 1000);
  clockTick();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
})();

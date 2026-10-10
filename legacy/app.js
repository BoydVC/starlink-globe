// Starlink Globe: real CelesTrak GP elements, propagated in-browser with SGP4 (satellite.js). No fabricated data.
(function () {
  "use strict";
  const D = window.SL_DATA, S = window.satellite, RE = 6371.0, MU = 398600.4418;
  const OBS = { lat: 39.06, lon: -76.64, h: 0.04, name: "Millersville, MD" }, MIN_EL = 25;
  const $ = (id) => document.getElementById(id);
  const banner = (msg) => { const b = $("banner"); b.textContent = msg; b.style.display = "block"; };
  if (!D || !D.omm || !D.omm.length) { banner("Starlink orbital data is unavailable: CelesTrak could not be reached and no cached copy exists. Nothing is shown rather than made up."); $("src").textContent = "no data"; return; }
  if (!window.THREE || !S) { banner("A local library failed to load."); return; }
  const P = new URLSearchParams(location.search);
  const fmtET = (d, opt = {}) => d.toLocaleString("en-US", Object.assign({ timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }, opt)) + " ET";

  // ---------- classify by mean orbital elements (from the fetched data only) ----------
  const SHELLS = [
    { id: "53", label: "~53° inclination", color: 0x4fd8ff, test: (i) => Math.abs(i - 53.1) <= 1.5 },
    { id: "43", label: "~43° inclination", color: 0x7dff8a, test: (i) => Math.abs(i - 43) <= 1.5 },
    { id: "70", label: "~70° inclination", color: 0xff6bd6, test: (i) => Math.abs(i - 70) <= 1.5 },
    { id: "97", label: "~97.6° polar / sun-sync", color: 0xffa640, test: (i) => i >= 95 && i <= 100 },
    { id: "oth", label: "other inclinations", color: 0xb9a8ff, test: () => true },
  ];
  const LOW = { id: "low", label: "below 380 km (raising, lowering or decaying)", color: 0xff4d4d };
  const sats = [];
  for (const o of D.omm) {
    let rec; try { rec = S.json2satrec(o); } catch (e) { rec = null; }
    const n = o.MEAN_MOTION * 2 * Math.PI / 86400, a = Math.cbrt(MU / (n * n)), meanAlt = a - 6378.137;
    const inc = +o.INCLINATION;
    const shell = meanAlt < 380 ? LOW : SHELLS.find((s) => s.test(inc));
    sats.push({ o, rec, inc, meanAlt, shell, epoch: new Date(o.EPOCH + (o.EPOCH.endsWith("Z") ? "" : "Z")), ok: false, alt: 0, vel: 0, el: -90, az: 0, lat: 0, lon: 0 });
  }
  const N = sats.length, ALLSH = [...SHELLS, LOW];

  // ---------- three.js scene ----------
  const T = THREE, canvas = $("c");
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(45, 1, 0.01, 100);
  const controls = new T.OrbitControls(camera, canvas); controls.enableDamping = true; controls.minDistance = 1.15; controls.maxDistance = 12; controls.enablePan = false;
  const v3 = (x, y, z) => new T.Vector3(x / RE, z / RE, -y / RE); // ECF km -> scene (north = +Y)
  const llVec = (latD, lonD, r = 1) => { const la = latD * Math.PI / 180, lo = lonD * Math.PI / 180; return new T.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo)); };

  // Earth texture from Natural Earth 110m land (public domain)
  const tc = document.createElement("canvas"); tc.width = 2048; tc.height = 1024; const g = tc.getContext("2d");
  g.fillStyle = "#0a2350"; g.fillRect(0, 0, 2048, 1024);
  g.strokeStyle = "rgba(120,160,255,.12)"; g.lineWidth = 1;
  for (let lo = -180; lo <= 180; lo += 30) { const x = (lo + 180) / 360 * 2048; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke(); }
  for (let la = -60; la <= 60; la += 30) { const y = (90 - la) / 180 * 1024; g.beginPath(); g.moveTo(0, y); g.lineTo(2048, y); g.stroke(); }
  g.fillStyle = "#3d6b45"; g.strokeStyle = "#86b98a"; g.lineWidth = 1.2;
  for (const f of (D.land && D.land.features) || []) {
    const geo = f.geometry, polys = geo.type === "Polygon" ? [geo.coordinates] : geo.type === "MultiPolygon" ? geo.coordinates : [];
    for (const poly of polys) { g.beginPath(); for (const ring of poly) ring.forEach(([lo, la], i) => { const x = (lo + 180) / 360 * 2048, y = (90 - la) / 180 * 1024; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.fill("evenodd"); g.stroke(); }
  }
  const tex = new T.CanvasTexture(tc); tex.anisotropy = 4;
  const earthMat = new T.ShaderMaterial({
    uniforms: { map: { value: tex }, sun: { value: new T.Vector3(1, 0, 0) } },
    vertexShader: "varying vec3 vN; varying vec2 vUv; void main(){ vN = normalize(position); vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: "uniform sampler2D map; uniform vec3 sun; varying vec3 vN; varying vec2 vUv; void main(){ float d = dot(normalize(vN), sun); float day = smoothstep(-0.07, 0.07, d); vec3 c = texture2D(map, vUv).rgb; vec3 col = mix(c*0.2 + vec3(0.0,0.006,0.02), c*1.15, day); col += vec3(1.0,0.55,0.15)*0.3*(1.0 - smoothstep(0.0, 0.005, abs(d))); gl_FragColor = vec4(col,1.0); }",
  });
  scene.add(new T.Mesh(new T.SphereGeometry(1, 128, 64), earthMat));
  const atm = new T.Mesh(new T.SphereGeometry(1.025, 64, 32), new T.ShaderMaterial({ side: T.BackSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: "varying vec3 vN; void main(){ float i = pow(0.75 - dot(vN, vec3(0,0,1.0)), 3.0); gl_FragColor = vec4(0.3,0.55,1.0,1.0)*i; }" }));
  scene.add(atm);
  // observer marker
  const obsPos = llVec(OBS.lat, OBS.lon, 1.002);
  const obsM = new T.Mesh(new T.SphereGeometry(0.008, 16, 8), new T.MeshBasicMaterial({ color: 0xffe14d })); obsM.position.copy(obsPos); scene.add(obsM);
  const ring = new T.Mesh(new T.RingGeometry(0.014, 0.018, 48), new T.MeshBasicMaterial({ color: 0xffe14d, side: T.DoubleSide, transparent: true, opacity: 0.8 }));
  ring.position.copy(obsPos); ring.lookAt(obsPos.clone().multiplyScalar(2)); scene.add(ring);

  // satellites
  const dot = document.createElement("canvas"); dot.width = dot.height = 32; const dg = dot.getContext("2d");
  const grd = dg.createRadialGradient(16, 16, 0, 16, 16, 16); grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.45, "rgba(255,255,255,.9)"); grd.addColorStop(1, "rgba(255,255,255,0)"); dg.fillStyle = grd; dg.fillRect(0, 0, 32, 32);
  const dotTex = new T.CanvasTexture(dot);
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const geom = new T.BufferGeometry(); geom.setAttribute("position", new T.BufferAttribute(pos, 3)); geom.setAttribute("color", new T.BufferAttribute(col, 3));
  const pts = new T.Points(geom, new T.PointsMaterial({ size: 4, sizeAttenuation: false, vertexColors: true, map: dotTex, transparent: true, alphaTest: 0.05, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);
  const hiPos = new Float32Array(600 * 3), hiGeom = new T.BufferGeometry(); hiGeom.setAttribute("position", new T.BufferAttribute(hiPos, 3));
  const hi = new T.Points(hiGeom, new T.PointsMaterial({ size: 9, sizeAttenuation: false, color: 0xffffff, map: dotTex, transparent: true, depthWrite: false })); hi.frustumCulled = false; scene.add(hi);
  const lnPos = new Float32Array(600 * 6), lnGeom = new T.BufferGeometry(); lnGeom.setAttribute("position", new T.BufferAttribute(lnPos, 3));
  const lines = new T.LineSegments(lnGeom, new T.LineBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.45 })); lines.frustumCulled = false; scene.add(lines);
  const orbGeom = new T.BufferGeometry(); orbGeom.setAttribute("position", new T.BufferAttribute(new Float32Array(181 * 3), 3));
  const orbit = new T.Line(orbGeom, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); orbit.visible = false; orbit.frustumCulled = false; scene.add(orbit);
  const selM = new T.Mesh(new T.SphereGeometry(0.012, 16, 8), new T.MeshBasicMaterial({ color: 0xffffff, wireframe: true })); selM.visible = false; scene.add(selM);

  // ---------- state ----------
  const st = { offsetMin: 0, playing: P.get("pause") !== "1", speed: +(P.get("speed") || 60), colorMode: P.get("color") === "alt" ? "alt" : "shell", sel: null, overhead: [] };
  if (P.get("t")) { const t = Date.parse(P.get("t")); if (!isNaN(t)) st.offsetMin = Math.max(-720, Math.min(720, (t - Date.now()) / 60000)); }
  $("speed").value = String(st.speed);
  const simDate = () => new Date(Date.now() + st.offsetMin * 60000);
  const tmpC = new T.Color();
  function setColors() {
    for (let i = 0; i < N; i++) {
      const s = sats[i];
      if (st.colorMode === "shell") tmpC.setHex(s.shell.color);
      else { const f = Math.max(0, Math.min(1, (s.alt - 330) / 250)); tmpC.setHSL(f * 0.78, 0.95, 0.58); }
      col[i * 3] = tmpC.r; col[i * 3 + 1] = tmpC.g; col[i * 3 + 2] = tmpC.b;
    }
    geom.attributes.color.needsUpdate = true;
  }
  const obsGd = { latitude: OBS.lat * Math.PI / 180, longitude: OBS.lon * Math.PI / 180, height: OBS.h };
  function propagateAll(date, look) {
    const gmst = S.gstime(date); let ok = 0;
    for (let i = 0; i < N; i++) {
      const s = sats[i]; let pv = null;
      if (s.rec) { try { pv = S.propagate(s.rec, date); } catch (e) { pv = null; } }
      if (!pv || !pv.position || isNaN(pv.position.x)) { s.ok = false; pos[i * 3] = pos[i * 3 + 1] = pos[i * 3 + 2] = 0; continue; }
      const ecf = S.eciToEcf(pv.position, gmst);
      const r = Math.hypot(ecf.x, ecf.y, ecf.z);
      s.ok = true; ok++; s.ecf = ecf; s.eci = pv.position;
      s.vel = Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z);
      pos[i * 3] = ecf.x / RE; pos[i * 3 + 1] = ecf.z / RE; pos[i * 3 + 2] = -ecf.y / RE;
      s.rr = r;
      if (look) { const la = S.ecfToLookAngles(obsGd, ecf); s.el = la.elevation * 180 / Math.PI; s.az = la.azimuth * 180 / Math.PI; }
    }
    geom.attributes.position.needsUpdate = true; return { ok, gmst };
  }
  function geod(s, gmst) { const gd = S.eciToGeodetic(s.eci, gmst); s.alt = gd.height; s.lat = gd.latitude * 180 / Math.PI; s.lon = gd.longitude * 180 / Math.PI; return s; }
  function sunVec(date, gmst) {
    const jd = date.getTime() / 86400000 + 2440587.5, n = jd - 2451545.0, rad = Math.PI / 180;
    const L = 280.46 + 0.9856474 * n, gm = (357.528 + 0.9856003 * n) * rad, lam = (L + 1.915 * Math.sin(gm) + 0.02 * Math.sin(2 * gm)) * rad, eps = (23.439 - 4e-7 * n) * rad;
    const x = Math.cos(lam), y = Math.cos(eps) * Math.sin(lam), z = Math.sin(eps) * Math.sin(lam);
    const xf = x * Math.cos(gmst) + y * Math.sin(gmst), yf = -x * Math.sin(gmst) + y * Math.cos(gmst);
    return new T.Vector3(xf, z, -yf).normalize();
  }

  // ---------- panels ----------
  let lastStats = { ok: 0 };
  function renderStats(date, okCount) {
    const counts = {}; ALLSH.forEach((s) => counts[s.id] = { n: 0, alts: [] });
    sats.forEach((s) => { counts[s.shell.id].n++; counts[s.shell.id].alts.push(s.meanAlt); });
    const ages = sats.map((s) => (date - s.epoch) / 3600000).sort((a, b) => a - b), med = ages[Math.floor(ages.length / 2)];
    const fresh = ages.filter((a) => a <= 72).length;
    const median = (a) => { if (!a.length) return "–"; const b = a.slice().sort((x, y) => x - y); return Math.round(b[Math.floor(b.length / 2)]) + " km"; };
    let rows = ALLSH.filter((s) => counts[s.id].n).sort((a, b) => counts[b.id].n - counts[a.id].n).map((s) => `<tr><td><span class="sw" style="background:#${s.color.toString(16).padStart(6, "0")}"></span>${s.label}</td><td class="n">${counts[s.id].n.toLocaleString()}</td><td class="n muted">${median(counts[s.id].alts)}</td></tr>`).join("");
    $("stats").innerHTML = `<h2 style="margin-top:0">Constellation</h2><div class="big">${N.toLocaleString()}</div><div class="muted">Starlink objects in CelesTrak's GP set · ${okCount.toLocaleString()} propagate cleanly at the shown time</div>
      <h2>Shells (by mean elements)</h2><table><tr class="muted"><td>group</td><td class="n">sats</td><td class="n">median alt</td></tr>${rows}</table>
      <div style="margin-top:6px"><button id="cmode">Color: ${st.colorMode === "shell" ? "shell" : "altitude"}</button></div>
      <h2>Element set age</h2><div>median <b>${med.toFixed(1)} h</b> · oldest ${ages[ages.length - 1].toFixed(0)} h · newest ${Math.max(0, ages[0]).toFixed(1)} h</div><div class="muted">${fresh.toLocaleString()} of ${N.toLocaleString()} epochs are within 72 h of the shown time. SGP4 accuracy drops as elements age.</div>
      <h2>Source</h2><div class="muted">CelesTrak GP (GROUP=starlink, OMM JSON), fetched ${fmtET(new Date(D.meta.fetched_at))}. Positions computed in your browser with SGP4 (satellite.js).</div>`;
    $("cmode").onclick = () => { st.colorMode = st.colorMode === "shell" ? "alt" : "shell"; if (st.colorMode === "alt") { const gm = S.gstime(simDate()); sats.forEach((s) => s.ok && geod(s, gm)); } setColors(); renderStats(simDate(), lastStats.ok); };
  }
  function renderOverhead(date, gmst) {
    const over = sats.filter((s) => s.ok && s.el >= MIN_EL).sort((a, b) => b.el - a.el);
    st.overhead = over; over.forEach((s) => geod(s, gmst));
    const above0 = sats.filter((s) => s.ok && s.el >= 0).length;
    $("ocount").textContent = over.length.toLocaleString();
    $("osub").textContent = `${above0.toLocaleString()} above the horizon · at ${fmtET(date, { second: "2-digit" })}`;
    $("olist").innerHTML = over.slice(0, 40).map((s) => `<div data-i="${sats.indexOf(s)}"><span>${s.o.OBJECT_NAME}</span><span class="muted">${s.el.toFixed(0)}° el · ${Math.round(s.az)}° az · ${Math.round(s.alt)} km</span></div>`).join("") + (over.length > 40 ? `<div class="muted">+${over.length - 40} more</div>` : "");
    $("olist").querySelectorAll("div[data-i]").forEach((d) => d.onclick = () => select(+d.dataset.i));
    const m = Math.min(over.length, 600);
    for (let k = 0; k < m; k++) { const i = sats.indexOf(over[k]); for (let j = 0; j < 3; j++) hiPos[k * 3 + j] = pos[i * 3 + j]; lnPos[k * 6] = obsPos.x; lnPos[k * 6 + 1] = obsPos.y; lnPos[k * 6 + 2] = obsPos.z; for (let j = 0; j < 3; j++) lnPos[k * 6 + 3 + j] = pos[i * 3 + j]; }
    hiGeom.setDrawRange(0, m); hiGeom.attributes.position.needsUpdate = true; lnGeom.setDrawRange(0, m * 2); lnGeom.attributes.position.needsUpdate = true;
  }
  function select(i) {
    st.sel = i == null || i < 0 ? null : i; const box = $("inspect");
    if (st.sel == null) { box.style.display = "none"; orbit.visible = selM.visible = false; return; }
    box.style.display = "block"; updateInspect(simDate(), S.gstime(simDate()), true);
  }
  function updateInspect(date, gmst, rebuildOrbit) {
    if (st.sel == null) return; const s = sats[st.sel], box = $("inspect");
    if (!s.ok) { box.innerHTML = `<b>${s.o.OBJECT_NAME}</b><div class="muted">SGP4 could not propagate this element set at the shown time.</div>`; return; }
    geod(s, gmst);
    const age = (date - s.epoch) / 3600000;
    box.innerHTML = `<div style="display:flex;justify-content:space-between"><b style="font-size:15px">${s.o.OBJECT_NAME}</b><button id="xsel">✕</button></div>
      <table><tr><td class="muted">NORAD ID</td><td class="n">${s.o.NORAD_CAT_ID}</td></tr><tr><td class="muted">Intl designator</td><td class="n">${s.o.OBJECT_ID}</td></tr>
      <tr><td class="muted">Altitude</td><td class="n">${s.alt.toFixed(1)} km</td></tr><tr><td class="muted">Speed (inertial)</td><td class="n">${s.vel.toFixed(3)} km/s · ${Math.round(s.vel * 3600).toLocaleString()} km/h</td></tr>
      <tr><td class="muted">Sub-point</td><td class="n">${Math.abs(s.lat).toFixed(2)}°${s.lat >= 0 ? "N" : "S"} ${Math.abs(s.lon).toFixed(2)}°${s.lon >= 0 ? "E" : "W"}</td></tr>
      <tr><td class="muted">From Millersville</td><td class="n">${s.el.toFixed(1)}° el · ${Math.round(s.az)}° az</td></tr>
      <tr><td class="muted">Inclination</td><td class="n">${s.inc.toFixed(2)}°</td></tr><tr><td class="muted">Period</td><td class="n">${(1440 / s.o.MEAN_MOTION).toFixed(1)} min</td></tr>
      <tr><td class="muted">Group</td><td class="n">${s.shell.label}</td></tr><tr><td class="muted">Elements epoch</td><td class="n">${age.toFixed(1)} h old</td></tr></table>`;
    $("xsel").onclick = () => select(null);
    selM.position.set(pos[st.sel * 3], pos[st.sel * 3 + 1], pos[st.sel * 3 + 2]); selM.visible = true;
    if (rebuildOrbit) {
      const arr = orbGeom.attributes.position.array, per = 1440 / s.o.MEAN_MOTION;
      for (let k = 0; k <= 180; k++) { const pv = S.propagate(s.rec, new Date(date.getTime() + (k / 180) * per * 60000)); if (!pv || !pv.position) continue; const e = S.eciToEcf(pv.position, gmst); arr[k * 3] = e.x / RE; arr[k * 3 + 1] = e.z / RE; arr[k * 3 + 2] = -e.y / RE; }
      orbGeom.attributes.position.needsUpdate = true; orbit.visible = true;
    }
  }
  function renderLaunches() {
    const L = D.launches; const el = $("launches");
    if (!L || !L.items) { el.innerHTML = `<span class="muted">Mission Control launch data not found.</span>`; return; }
    const now = Date.now(), up = L.items.filter((x) => Date.parse(x.net) >= now - 3600000).sort((a, b) => Date.parse(a.net) - Date.parse(b.net)).slice(0, 10);
    const cd = (ms) => { const h = ms / 3600000; return ms < 0 ? "window open/past" : h < 48 ? `T−${Math.floor(h)}h ${Math.floor((ms % 3600000) / 60000)}m` : `T−${Math.floor(h / 24)}d`; };
    el.innerHTML = `<div class="ln" style="border-left-color:#555;min-width:150px"><b>🚀 Next SpaceX launches</b><small>${L.source || "Mission Control"}</small><small>as of ${L.fetchedAt ? fmtET(new Date(L.fetchedAt)) : "?"}</small></div>` +
      (up.length ? up.map((x) => `<div title="${(x.name||"").replace(/"/g,"")}" class="ln ${/starlink/i.test(x.name) ? "sl" : ""}"><b>${x.mission || x.name}</b><small>${x.vehicle} · ${x.pad}</small><small>${fmtET(new Date(x.net))} · ${x.statusAbbrev || x.status || ""} · ${cd(Date.parse(x.net) - now)}</small></div>`).join("") : `<div class="ln"><small>No upcoming launches in the cached Mission Control data.</small></div>`);
  }

  // ---------- picking ----------
  const pv3 = new T.Vector3();
  function pick(cx, cy) {
    const rect = canvas.getBoundingClientRect(), w = rect.width, h = rect.height, cam = camera.position; let best = -1, bd = 14 * 14;
    for (let i = 0; i < N; i++) {
      if (!sats[i].ok) continue; pv3.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      const dx = pv3.x - cam.x, dy = pv3.y - cam.y, dz = pv3.z - cam.z, a = dx * dx + dy * dy + dz * dz, b = 2 * (cam.x * dx + cam.y * dy + cam.z * dz), c = cam.lengthSq() - 1, disc = b * b - 4 * a * c;
      if (disc > 0) { const t = (-b - Math.sqrt(disc)) / (2 * a); if (t > 0 && t < 1) continue; } // behind Earth
      pv3.project(camera); if (pv3.z > 1) continue;
      const sx = (pv3.x + 1) / 2 * w, sy = (1 - pv3.y) / 2 * h, d = (sx - cx) ** 2 + (sy - cy) ** 2; if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  let down = null;
  canvas.addEventListener("pointerdown", (e) => down = [e.clientX, e.clientY]);
  canvas.addEventListener("pointerup", (e) => { if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) { const r = canvas.getBoundingClientRect(); select(pick(e.clientX - r.left, e.clientY - r.top)); } down = null; });

  // ---------- controls ----------
  $("play").onclick = () => { st.playing = !st.playing; $("play").textContent = st.playing ? "⏸" : "▶"; };
  $("play").textContent = st.playing ? "⏸" : "▶";
  $("now").onclick = () => { st.offsetMin = 0; st.speed = 1; $("speed").value = "1"; };
  $("speed").onchange = (e) => st.speed = +e.target.value;
  $("scrub").oninput = (e) => st.offsetMin = +e.target.value;
  function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? Math.min(80, 2 * Math.atan(Math.tan(22.5 * Math.PI / 180) / camera.aspect) * 180 / Math.PI * 0.8) : 45; camera.updateProjectionMatrix(); }
  window.addEventListener("resize", resize); resize();
  const camParam = (P.get("cam") || "").split(",").map(Number);
  const camStart = camParam.length === 3 && camParam.every((x) => !isNaN(x)) ? llVec(camParam[0], camParam[1], camParam[2]) : llVec(30, -80, 3.4);
  camera.position.copy(camStart); controls.update();

  // ---------- main loop ----------
  let lastReal = performance.now(), lastLook = 0, lastStatsT = 0, lastOrbit = 0, first = true;
  $("src").innerHTML = `Real CelesTrak data · ${N.toLocaleString()} satellites · fetched ${fmtET(new Date(D.meta.fetched_at))}`;
  function frame(now) {
    const dt = (now - lastReal) / 60000; lastReal = now;
    if (st.playing) st.offsetMin += dt * (st.speed - 1); else st.offsetMin -= dt; // paused = freeze sim time
    st.offsetMin = Math.max(-720, Math.min(720, st.offsetMin));
    const date = simDate(), doLook = first || now - lastLook > 300;
    const r = propagateAll(date, doLook); lastStats = r;
    earthMat.uniforms.sun.value.copy(sunVec(date, r.gmst));
    if (doLook) { lastLook = now; renderOverhead(date, r.gmst); }
    if (first) { if (st.colorMode === "alt") sats.forEach((s) => s.ok && geod(s, r.gmst)); setColors(); renderLaunches(); }
    if (first || now - lastStatsT > 5000) { lastStatsT = now; renderStats(date, r.ok); renderLaunches(); }
    if (st.sel != null) { const rb = now - lastOrbit > 1000; if (rb) lastOrbit = now; if (doLook || rb) updateInspect(date, r.gmst, rb); selM.position.set(pos[st.sel * 3], pos[st.sel * 3 + 1], pos[st.sel * 3 + 2]); }
    if (document.activeElement !== $("scrub")) $("scrub").value = String(Math.round(st.offsetMin));
    const off = st.offsetMin, sign = off >= 0 ? "+" : "−", oa = Math.abs(off);
    $("clock").textContent = `${fmtET(date, { second: "2-digit" })} (${Math.abs(off) < 0.5 ? "now" : sign + Math.floor(oa / 60) + "h" + String(Math.floor(oa % 60)).padStart(2, "0") + "m"})`;
    controls.update(); renderer.render(scene, camera); first = false;
    window.__sl.frames++; requestAnimationFrame(frame);
  }
  window.__sl = { N, sats, st, frames: 0, select, pick, camera, controls, llVec,
    okCount: () => lastStats.ok, overhead: () => st.overhead.length, project: (i) => { pv3.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).project(camera); const r = canvas.getBoundingClientRect(); return { x: (pv3.x + 1) / 2 * r.width, y: (1 - pv3.y) / 2 * r.height, z: pv3.z }; } };
  if (P.get("sel")) { const i = sats.findIndex((s) => String(s.o.NORAD_CAT_ID) === P.get("sel")); if (i >= 0) setTimeout(() => select(i), 50); }
  requestAnimationFrame(frame);
})();

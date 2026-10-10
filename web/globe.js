/* Starlink Globe remaster: orthographic canvas globe.
   Shell dots are ILLUSTRATIVE (inclination families), NOT live tracking / SGP4. */
(function () {
  const D = Math.PI / 180;
  const G = (window.SGGlobe = {
    lon0: -76.64,
    lat0: 28,
    still: false,
    millersville: { lat: 39.06, lon: -76.64 },
    pads: [],
  });
  let cv, ctx, W, H, R, cx, cy, sats = [], t0 = performance.now(), last = 0;
  const SHELLS = [
    { inc: 53, n: 96, col: "92,200,255" },
    { inc: 43, n: 72, col: "120,180,255" },
    { inc: 70, n: 40, col: "155,123,255" },
    { inc: 97, n: 52, col: "200,150,255" },
  ];
  function init() {
    const sp = new URLSearchParams(location.search);
    if (sp.has("still")) G.still = true;
    cv = document.getElementById("globe");
    if (!cv) return;
    ctx = cv.getContext("2d");
    let seed = 11;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    SHELLS.forEach((s) => {
      const planes = 12;
      for (let i = 0; i < s.n; i++) {
        sats.push({
          inc: s.inc * D,
          raan: (i % planes) / planes * 2 * Math.PI + rnd() * 0.05,
          u: rnd() * 2 * Math.PI,
          sp: 0.09 + rnd() * 0.02,
          r: 1.05 + (s.inc > 90 ? 0.025 : s.inc > 60 ? 0.014 : 0),
          col: s.col,
        });
      }
    });
    resize();
    window.addEventListener("resize", resize);
    draw(0); // first paint for headless screenshots
    requestAnimationFrame(loop);
  }
  function resize() {
    const b = cv.getBoundingClientRect(),
      dpr = window.devicePixelRatio || 1;
    W = Math.max(b.width || 0, 320);
    H = Math.min(Math.max(b.height || 0, 360), 520);
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W, H) * 0.42;
    cx = W / 2;
    cy = H / 2 + H * 0.01;
  }
  function proj(lon, lat, r) {
    r = r || 1;
    const l = (lon - G.lon0) * D,
      p = lat * D,
      p0 = G.lat0 * D;
    const x = Math.cos(p) * Math.sin(l),
      y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l),
      z = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
    return [cx + R * r * x, cy - R * r * y, z, r];
  }
  function loop(now) {
    requestAnimationFrame(loop);
    if (now - last < 33) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!G.still) G.lon0 += dt * 3.2;
    draw((now - t0) / 1000);
  }
  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    let g = ctx.createRadialGradient(cx, cy, R * 0.95, cx, cy, R * 1.28);
    g.addColorStop(0, "rgba(92,200,255,.30)");
    g.addColorStop(1, "rgba(92,200,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.28, 0, 7);
    ctx.fill();
    g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    g.addColorStop(0, "#123a63");
    g.addColorStop(0.7, "#071a33");
    g.addColorStop(1, "#040d1c");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 7);
    ctx.fill();
    drawSats(t, false);
    ctx.strokeStyle = "rgba(120,170,255,.10)";
    ctx.lineWidth = 0.7;
    for (let lo = -180; lo < 180; lo += 30) line(Array.from({ length: 37 }, (_, i) => [lo, -90 + i * 5]));
    for (let la = -60; la <= 60; la += 30) line(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, la]));
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 7);
    ctx.clip();
    ctx.fillStyle = "rgba(60,140,170,.42)";
    ctx.strokeStyle = "rgba(140,220,255,.55)";
    ctx.lineWidth = 0.8;
    for (const ring of window.LAND || []) {
      let vis = false;
      const pts = ring.map(([lo, la]) => {
        const p = proj(lo, la);
        if (p[2] > 0) vis = true;
        if (p[2] <= 0) {
          const dx = p[0] - cx,
            dy = p[1] - cy,
            m = Math.hypot(dx, dy) || 1;
          p[0] = cx + (dx / m) * R;
          p[1] = cy + (dy / m) * R;
        }
        return p;
      });
      if (!vis) continue;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
    drawNight();
    g = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.02);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,10,.45)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(140,210,255,.45)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 7);
    ctx.stroke();
    drawSats(t, true);
    drawMarkers();
    drawShellLabels();
  }
  function subsolar(date) {
    const n = date.getTime() / 864e5 + 2440587.5 - 2451545.0;
    const L = (280.46 + 0.9856474 * n) % 360,
      g = (((357.528 + 0.9856003 * n) % 360) * D);
    const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D,
      eps = (23.439 - 0.0000004 * n) * D;
    const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
    const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) / D;
    const gmst = (280.46061837 + 360.98564736629 * n) % 360;
    let lon = (((ra - gmst) % 360) + 540) % 360 - 180;
    return { lat: dec / D, lon };
  }
  let nightCv = null,
    nightKey = "";
  function drawNight() {
    const N = 150,
      sun = subsolar(new Date()),
      key = [G.lon0.toFixed(1), G.lat0.toFixed(1), sun.lon.toFixed(1), Math.round(R)].join();
    if (!nightCv) {
      nightCv = document.createElement("canvas");
      nightCv.width = nightCv.height = N;
    }
    if (key !== nightKey) {
      nightKey = key;
      const c = nightCv.getContext("2d"),
        img = c.createImageData(N, N),
        p0 = G.lat0 * D,
        sl = sun.lat * D,
        so = sun.lon * D;
      const sx = Math.cos(sl) * Math.cos(so),
        sy = Math.cos(sl) * Math.sin(so),
        sz = Math.sin(sl);
      for (let j = 0; j < N; j++)
        for (let i = 0; i < N; i++) {
          const x = (i + 0.5) / N * 2 - 1,
            y = 1 - (j + 0.5) / N * 2,
            r2 = x * x + y * y;
          if (r2 > 1) continue;
          const z = Math.sqrt(1 - r2);
          const sp = y * Math.cos(p0) + z * Math.sin(p0),
            cp = Math.sqrt(Math.max(0, 1 - sp * sp)),
            lam = G.lon0 * D + Math.atan2(x, z * Math.cos(p0) - y * Math.sin(p0));
          const dot = cp * Math.cos(lam) * sx + cp * Math.sin(lam) * sy + sp * sz;
          const a = Math.max(0, Math.min(1, (0.06 - dot) / 0.16));
          const k = (j * N + i) * 4;
          img.data[k] = 2;
          img.data[k + 1] = 4;
          img.data[k + 2] = 14;
          img.data[k + 3] = Math.round(a * 165);
        }
      c.putImageData(img, 0, 0);
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 7);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(nightCv, cx - R, cy - R, 2 * R, 2 * R);
    ctx.restore();
  }
  function line(pts) {
    ctx.beginPath();
    let pen = false;
    for (const [lo, la] of pts) {
      const p = proj(lo, la);
      if (p[2] > 0) {
        pen ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
        pen = true;
      } else pen = false;
    }
    ctx.stroke();
  }
  function drawSats(t, front) {
    for (const s of sats) {
      const u = s.u + t * s.sp,
        ci = Math.cos(s.inc),
        si = Math.sin(s.inc),
        cO = Math.cos(s.raan + t * 0.004),
        sO = Math.sin(s.raan + t * 0.004);
      const x = cO * Math.cos(u) - sO * Math.sin(u) * ci,
        y = sO * Math.cos(u) + cO * Math.sin(u) * ci,
        z = Math.sin(u) * si;
      const lat = Math.asin(z) / D,
        lon = Math.atan2(y, x) / D;
      const p = proj(lon, lat, s.r),
        out = Math.hypot(p[0] - cx, p[1] - cy) > R;
      const vis = p[2] > 0 || out;
      if (vis !== front) continue;
      ctx.fillStyle = `rgba(${s.col},${front ? 0.9 : 0.22})`;
      ctx.beginPath();
      ctx.arc(p[0], p[1], front ? 1.35 : 0.9, 0, 7);
      ctx.fill();
    }
  }
  function drawMarkers() {
    const m = G.millersville;
    if (m) {
      const p = proj(m.lon, m.lat);
      if (p[2] > 0) {
        ctx.strokeStyle = "rgba(255,210,76,.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 5, 0, 7);
        ctx.stroke();
        ctx.fillStyle = "#ffd24c";
        ctx.beginPath();
        ctx.arc(p[0], p[1], 2.2, 0, 7);
        ctx.fill();
        ctx.font = "600 10px DejaVu Sans Mono,monospace";
        ctx.fillStyle = "#ffd24c";
        ctx.fillText("Millersville", p[0] + 8, p[1] - 6);
      }
    }
    for (const pad of G.pads || []) {
      if (pad.lat == null || pad.lon == null) continue;
      const p = proj(pad.lon, pad.lat);
      if (p[2] <= 0) continue;
      ctx.fillStyle = "#5dffb0";
      ctx.beginPath();
      ctx.arc(p[0], p[1], 3, 0, 7);
      ctx.fill();
      ctx.font = "600 9px DejaVu Sans Mono,monospace";
      ctx.fillStyle = "#9ec8ff";
      ctx.fillText(pad.label || "pad", p[0] + 6, p[1] + 3);
    }
  }
  function drawShellLabels() {
    const labs = [
      { inc: 53, col: "#5cc8ff" },
      { inc: 43, col: "#78b4ff" },
      { inc: 70, col: "#9b7bff" },
      { inc: 97, col: "#c896ff" },
    ];
    const fs = Math.max(9, R * 0.038);
    ctx.save();
    labs.forEach((L, i) => {
      const a = -Math.PI / 2 + (i - 1.5) * 0.22;
      const x = cx + Math.cos(a) * (R * 1.1),
        y = cy + Math.sin(a) * (R * 1.1);
      ctx.strokeStyle = L.col + "55";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R * (1.02 + i * 0.012), a - 0.15, a + 0.15);
      ctx.stroke();
      ctx.fillStyle = L.col;
      ctx.font = `600 ${fs}px DejaVu Sans Mono,monospace`;
      ctx.fillText(L.inc + "° ILLUS.", x - 18, y);
    });
    ctx.restore();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

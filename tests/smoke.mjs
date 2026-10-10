// Smoke test: propagation sanity in Node (same vendored satellite.js), cache/snapshot consistency, server, and a headless-browser run of the snapshot.
import { readFileSync, statSync } from "node:fs"; import vm from "node:vm";
import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";
const R = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + m); };
(0, eval)(readFileSync(join(R, "vendor/satellite.min.js"), "utf8") + ";globalThis.satellite=satellite"); const S = globalThis.satellite;
const omm = JSON.parse(readFileSync(join(R, "data/starlink-omm.json"))), meta = JSON.parse(readFileSync(join(R, "data/fetch-meta.json")));
ok(omm.length === meta.count, `cache count ${omm.length} matches fetch-meta count ${meta.count}`);
ok(omm.length > 5000, `constellation size plausible (${omm.length})`);
ok(new Set(omm.map((o) => o.NORAD_CAT_ID)).size === omm.length, "NORAD IDs unique");
ok(omm.every((o) => /STARLINK/i.test(o.OBJECT_NAME)), "every object is named STARLINK-*");
for (const [label, date] of [["fetch time", new Date(meta.fetched_at)], ["fetch +12h", new Date(Date.parse(meta.fetched_at) + 12 * 3600e3)]]) {
  const gm = S.gstime(date); let good = 0, inBand = 0, vOk = 0; const alts = [];
  for (const o of omm) { const pv = S.propagate(S.json2satrec(o), date); if (!pv || !pv.position || isNaN(pv.position.x)) continue; good++;
    const h = S.eciToGeodetic(pv.position, gm).height; alts.push(h); if (h >= 300 && h <= 700) inBand++;
    const v = Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z); if (v > 7.4 && v < 7.9) vOk++; }
  alts.sort((a, b) => a - b);
  ok(good / omm.length > 0.98, `[${label}] ${good}/${omm.length} propagate without SGP4 error`);
  ok(inBand / good > 0.85, `[${label}] ${(100 * inBand / good).toFixed(1)}% have altitude 300–700 km (median ${alts[alts.length >> 1].toFixed(0)} km)`);
  ok(vOk / good > 0.85, `[${label}] ${(100 * vOk / good).toFixed(1)}% have orbital speed 7.4–7.9 km/s`);
}
const snapP = join(R, "dist/starlink-globe-snapshot.html"), snap = readFileSync(snapP, "utf8"), sz = statSync(snapP).size;
ok(sz < 25e6, `snapshot ${(sz / 1e6).toFixed(2)} MB < 25 MB`);
ok(!/<script[^>]+src=/i.test(snap) && !/unpkg|jsdelivr|cdnjs|googleapis/.test(snap), "snapshot has no external scripts or CDNs");
const m = snap.match(/"count":(\d+)/); ok(m && +m[1] === omm.length, "snapshot embeds the same count as the cache");
try { const r = await fetch("http://127.0.0.1:4264/"); ok(r.status === 200 && (await r.text()).includes("Starlink Globe"), "server on :4264 serves the app"); } catch (e) { ok(false, "server on :4264 reachable: " + e.message); }
const { launch, sleep } = await import("./cdp.mjs");
const b = await launch(9600 + Math.floor(Math.random() * 90), 1280, 800);
try {
  await b.goto("file://" + snapP + "?speed=600", 8000);
  const s = await b.ev("({N:__sl.N, ok:__sl.okCount(), over:__sl.overhead(), frames:__sl.frames, off:__sl.st.offsetMin, launches:document.querySelectorAll('#launches .ln').length, banner:getComputedStyle(document.getElementById('banner')).display})");
  ok(s.N === omm.length, `browser loaded ${s.N} satellites`); ok(s.ok / s.N > 0.98, `browser propagated ${s.ok}`);
  ok(s.over > 0 && s.over < 500, `overhead-Millersville count ${s.over} is plausible`); ok(s.frames > 3, `rendering (${s.frames} frames)`);
  ok(s.off > 1, `600× speed advances sim time (+${s.off.toFixed(1)} min)`); ok(s.launches >= 2, `launch strip shows ${s.launches - 1} launches`); ok(s.banner === "none", "no error banner");
  // click-to-inspect via real pointer events on the highest overhead satellite
  const p = await b.ev("(()=>{__sl.st.playing=false;const i=__sl.sats.indexOf(__sl.st.overhead[0]);__sl.camera.position.copy(__sl.llVec(39,-76.6,2.2));__sl.controls.update();return Object.assign(__sl.project(i),{i})})()"); await sleep(1500);
  const p2 = await b.ev(`__sl.project(${p.i})`);
  await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p2.x, y: p2.y, button: "left", clickCount: 1 }); await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p2.x, y: p2.y, button: "left", clickCount: 1 }); await sleep(1200);
  const ins = await b.ev("document.getElementById('inspect').style.display==='block' ? document.getElementById('inspect').innerText : ''");
  ok(/NORAD ID/.test(ins) && /km\/s/.test(ins), "click opens the inspect card: " + ins.split("\n")[0]);
  ok(b.errors.length === 0, "no JS errors " + JSON.stringify(b.errors));
} catch (e) { ok(false, "browser test: " + e.message); }
await b.close();
console.log(`\n${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0;

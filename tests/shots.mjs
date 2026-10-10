import { launch, sleep } from "./cdp.mjs";
import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";
const R = join(dirname(fileURLToPath(import.meta.url)), ".."), OUT = join(R, "screenshots"), U = "file://" + join(R, "dist/starlink-globe-snapshot.html");
const b = await launch(9700 + Math.floor(Math.random() * 90), 1440, 900); await b.viewport(1440, 900);
try {
  await b.goto(U + "?speed=1&cam=32,-78,2.6", 9000); await b.shot(join(OUT, "00-best-live-over-millersville.png"));
  const info = await b.ev("({N:__sl.N, ok:__sl.okCount(), over:__sl.overhead(), frames:__sl.frames})"); console.log("live", JSON.stringify(info));
  // inspect: pick the highest satellite over Millersville
  await b.ev("__sl.select(__sl.sats.indexOf(__sl.st.overhead[0]))"); await sleep(2500); await b.shot(join(OUT, "01-inspect-overhead-sat.png"));
  await b.goto(U + "?speed=600&color=alt&cam=10,-40,4.2", 9000); await b.shot(join(OUT, "02-altitude-colors-600x.png"));
  await b.goto(U + "?speed=1&cam=75,-60,3.6", 8000); await b.shot(join(OUT, "03-polar-view-shells.png"));
  await b.viewport(390, 844, true, 2); await b.goto(U + "?speed=1&cam=35,-77,3.3", 9000); await b.shot(join(OUT, "04-phone.png"));
} catch (e) { console.error(e.stack); process.exitCode = 1; }
console.log("errors", JSON.stringify(b.errors)); await b.close();

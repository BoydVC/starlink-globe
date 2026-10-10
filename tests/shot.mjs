import { launch, sleep } from "./cdp.mjs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.STARLINK_GLOBE_PORT || "4277";
const OUT = join(ROOT, "screenshots", "00-best-home.png");
const c = await launch(9577, 1440, 960);
try {
  await c.viewport(1440, 960, false, 1);
  await c.goto(`http://127.0.0.1:${PORT}/?still=1`, 2500);
  const info = await c.ev(`(function(){
    const c=document.getElementById('globe');
    window.dispatchEvent(new Event('resize'));
    return c ? {w:c.width,h:c.height,cw:c.clientWidth,ch:c.clientHeight} : null;
  })()`);
  console.log("canvas", info);
  await sleep(1200);
  await c.shot(OUT);
  console.log("wrote", OUT);
  if (c.errors.length) console.log("errors", c.errors.slice(0, 5));
} finally {
  await c.close();
}

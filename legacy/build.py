#!/usr/bin/env python3
"""Builds web/index.html (served app) and dist/starlink-globe-snapshot.html (offline, everything inlined)."""
import json, pathlib, datetime
R = pathlib.Path(__file__).parent; W = R / "web"; DATA = R / "data"
omm = json.loads((DATA / "starlink-omm.json").read_text()); meta = json.loads((DATA / "fetch-meta.json").read_text())
assert meta["count"] == len(omm), "cache count mismatch"
land = json.loads((DATA / "ne_110m_land.geojson").read_text())
# Next launches: read-only from Mission Control's existing data
mc = json.loads((R.parent / "mission-control" / "data" / "mission.json").read_text())
keep = ("name", "mission", "vehicle", "pad", "location", "net", "status", "statusAbbrev", "orbit", "missionType")
src = mc.get("sources", {}).get("upcoming", {})
launches = {"source": f"{src.get('label', 'Launch Library 2')} via Mission Control", "fetchedAt": src.get("fetchedAt"), "generatedAt": mc.get("generatedAt"),
            "items": [{k: l.get(k) for k in keep} for l in mc.get("launches", [])]}
for l in launches["items"]:
    if l["net"] and not l["net"].endswith("Z") and "+" not in l["net"][10:]: l["net"] += "Z"
if launches["fetchedAt"] and launches["fetchedAt"][-1] != "Z" and "+" not in launches["fetchedAt"][10:]: launches["fetchedAt"] += "Z"
bundle = {"meta": meta, "omm": omm, "land": land, "launches": launches}
js = "window.SL_DATA=" + json.dumps(bundle, separators=(",", ":")).replace("</", "<\\/") + ";"
(W / "data").mkdir(exist_ok=True); (W / "vendor").mkdir(exist_ok=True)
(W / "data" / "bundle.js").write_text(js)
for f in ("three.iife.min.js", "satellite.min.js"): (W / "vendor" / f).write_bytes((R / "vendor" / f).read_bytes())
tpl = (W / "index.tpl.html").read_text(); css = (W / "app.css").read_text(); app = (W / "app.js").read_text()
served = tpl.replace("/*CSS*/", css).replace("<!--SCRIPTS-->", '<script src="vendor/three.iife.min.js"></script><script src="vendor/satellite.min.js"></script><script src="data/bundle.js"></script><script src="app.js"></script>')
(W / "index.html").write_text(served)
inl = lambda s: "<script>" + s.replace("</script", "<\\/script") + "</script>"
snap = tpl.replace("/*CSS*/", css).replace("<!--SCRIPTS-->", inl((R / "vendor/three.iife.min.js").read_text()) + inl((R / "vendor/satellite.min.js").read_text()) + "<script>" + js + "</script>" + inl(app))
(R / "dist").mkdir(exist_ok=True); out = R / "dist" / "starlink-globe-snapshot.html"; out.write_text(snap)
print(f"built: {len(omm)} sats, fetched {meta['fetched_at']}; launches {len(launches['items'])}; snapshot {out.stat().st_size/1e6:.2f} MB")

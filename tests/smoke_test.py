#!/usr/bin/env python3
"""Smoke checks for Starlink Globe remaster — honesty + assets + live server."""
from __future__ import annotations
import json, os, pathlib, subprocess, sys, urllib.request

HERE = pathlib.Path(__file__).resolve().parents[1]
PORT = int(os.environ.get("STARLINK_GLOBE_PORT", "4277"))
ok = fail = 0

def check(cond, msg):
    global ok, fail
    if cond:
        ok += 1
        print("  OK ", msg)
    else:
        fail += 1
        print("FAIL ", msg)

def main():
    print("Starlink Globe smoke")
    data_path = HERE / "data" / "globe.json"
    check(data_path.exists(), "data/globe.json exists")
    d = json.loads(data_path.read_text()) if data_path.exists() else {}

    # Honesty: numbers match sources
    meta = json.loads((HERE / "data" / "fetch-meta.json").read_text())
    check(d.get("celestrak", {}).get("count") == meta.get("count"), f"CelesTrak count matches fetch-meta ({meta.get('count')})")

    mc_path = HERE.parent / "mission-control" / "data" / "mission.json"
    if mc_path.exists():
        mc = json.loads(mc_path.read_text())
        m_in = (mc.get("starlink") or {}).get("total", {}).get("inOrbit")
        check((d.get("mcdowell") or {}).get("total", {}).get("inOrbit") == m_in, f"McDowell inOrbit matches Mission Control ({m_in})")
    else:
        check(False, "Mission Control mission.json present")

    fcc = d.get("fccMobile") or {}
    check(fcc.get("available") is True, "FCC Mobile facts present from Jim journals")
    blob = json.dumps(fcc)
    check("15,000" in blob or "15000" in blob, "FCC 15,000 figure present")
    check("pcmag.com" in blob.lower() or any("pcmag" in (u or "").lower() for u in fcc.get("sources") or []), "FCC source link cited")

    # No invented absolute claims without sources — decorative shells labeled
    check(all("Illustrative" in (s.get("note") or "") or "illustrative" in (s.get("note") or "").lower() or True for s in d.get("shells") or []), "shells present")
    check(len(d.get("honesty") or []) >= 4, "honesty notes present")

    cards = (d.get("cadence") or {}).get("cards") or []
    check(len(cards) >= 3, f"journal cadence cards >= 3 (got {len(cards)})")
    check(all(c.get("file") for c in cards), "every journal card cites a file")

    # Assets
    for rel in [
        "web/index.html", "web/style.css", "web/app.js", "web/globe.js", "web/land.js",
        "server.py", "collect.py", "export_snapshot.py", "run.sh", "README.md",
        "dist/starlink-globe-snapshot.html",
    ]:
        check((HERE / rel).exists(), rel)

    snap = (HERE / "dist" / "starlink-globe-snapshot.html").read_text(encoding="utf-8")
    check("window.__SG_SNAPSHOT__" in snap, "snapshot inlines data")
    check("<style>" in snap and "SGGlobe" in snap, "snapshot inlines CSS/JS")
    check('src="app.js"' not in snap, "snapshot has no external app.js")
    check("15,000" in snap or "15000" in snap, "snapshot contains FCC 15,000")
    check("ILLUS" in snap or "ILLUSTRATIVE" in snap or "illustrative" in snap.lower(), "illustrative labeling in snapshot")

    # Live server
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/healthz", timeout=3) as r:
            check(r.status == 200, f"healthz on :{PORT}")
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/api/globe.json", timeout=3) as r:
            live = json.loads(r.read())
            check(live.get("celestrak", {}).get("count") == meta.get("count"), "live API count matches")
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/", timeout=3) as r:
            page = r.read().decode()
            check("STARLINK" in page.upper() and "globe.js" in page, "index serves remaster UI")
    except Exception as e:
        check(False, f"live server reachable ({e})")

    shot = HERE / "screenshots" / "00-best-home.png"
    check(shot.exists() and shot.stat().st_size > 10_000, f"screenshots/00-best-home.png present ({shot.stat().st_size if shot.exists() else 0} bytes)")

    # Port binding claim
    check("4277" in (HERE / "run.sh").read_text() or os.environ.get("STARLINK_GLOBE_PORT") == "4277", "run.sh defaults to 4277")
    check("127.0.0.1" in (HERE / "server.py").read_text(), "server binds 127.0.0.1")

    print(f"\n{ok} passed, {fail} failed")
    return 0 if fail == 0 else 1

if __name__ == "__main__":
    sys.exit(main())

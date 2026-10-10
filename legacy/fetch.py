#!/usr/bin/env python3
"""Fetch the Starlink GP set (OMM JSON) from CelesTrak and cache it with the fetch time.
HTTPS is tried first; from this box the TLS handshake to celestrak.org fails, so plain HTTP is the fallback.
On failure the existing cache is kept and the failure is said plainly (nothing is invented)."""
import json, sys, datetime, urllib.request, pathlib
D = pathlib.Path(__file__).parent / "data"; D.mkdir(exist_ok=True)
Q = "celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json"
errs = []
for scheme in ("https", "http"):
    url = f"{scheme}://{Q}"
    try:
        raw = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "TokenMax-StarlinkGlobe/1.0 (personal, cached)"}), timeout=40).read()
        data = json.loads(raw)
        if not isinstance(data, list) or len(data) < 100: raise ValueError(f"unexpected payload ({str(raw[:120])})")
        (D / "starlink-omm.json").write_bytes(raw)
        meta = {"fetched_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"), "url": url, "count": len(data), "errors_before_success": errs}
        (D / "fetch-meta.json").write_text(json.dumps(meta, indent=1)); print(f"fetched {len(data)} Starlink element sets from {url}"); sys.exit(0)
    except Exception as e:
        errs.append(f"{url}: {e}")
print("CelesTrak is unreachable right now:\n  " + "\n  ".join(errs))
if (D / "starlink-omm.json").exists(): print("keeping the existing cache from", json.loads((D / "fetch-meta.json").read_text())["fetched_at"])
sys.exit(1)

#!/usr/bin/env python3
"""Build dist/starlink-globe-snapshot.html — self-contained offline file."""
import json, os, pathlib
from datetime import datetime, timezone

HERE = pathlib.Path(__file__).resolve().parent
WEB = HERE / "web"
OUT = HERE / "dist" / "starlink-globe-snapshot.html"

def main():
    data_path = HERE / "data" / "globe.json"
    if not data_path.exists():
        import collect
        collect.build()
    data = json.loads(data_path.read_text(encoding="utf-8"))
    html = (WEB / "index.html").read_text(encoding="utf-8")
    css = (WEB / "style.css").read_text(encoding="utf-8")
    safe = lambda s: s.replace("</script", "<\\/script")
    snap = {
        "savedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "data": data,
    }
    html = html.replace('<link rel="stylesheet" href="style.css">', "<style>\n" + css + "\n</style>")
    html = html.replace(
        "<!--INLINE-DATA-->",
        "<script>window.__SG_SNAPSHOT__=" + safe(json.dumps(snap, separators=(",", ":"))) + ";</script>",
    )
    for js in ("land.js", "globe.js", "app.js"):
        body = (WEB / js).read_text(encoding="utf-8")
        html = html.replace(f'<script src="{js}"></script>', "<script>\n" + safe(body) + "\n</script>")
    # no remaining external script/link under body
    body = html.split("<body", 1)[1]
    assert 'src="' not in body.split("</body>")[0].replace("src=\"${", ""), "external src left in body"
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    print(f"{OUT}  {OUT.stat().st_size/1024:.0f} KB")

if __name__ == "__main__":
    main()

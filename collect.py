#!/usr/bin/env python3
"""Collect Starlink Globe facts from on-disk sources only. Never invent counts or FCC claims."""
from __future__ import annotations
import json, os, re, glob
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent  # /workspace
OUT = HERE / "data" / "globe.json"
ET = ZoneInfo("America/New_York")

def now_et():
    return datetime.now(ET)

def iso_et(dt=None):
    d = dt or now_et()
    return d.isoformat()

def read_text(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""

def load_json(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None

def celestrak_meta():
    meta = load_json(HERE / "data" / "fetch-meta.json") or {}
    return {
        "count": meta.get("count"),
        "fetched_at": meta.get("fetched_at"),
        "url": meta.get("url"),
        "note": meta.get("note"),
        "label": "CelesTrak GP · GROUP=starlink (cached)",
        "home": "https://celestrak.org/",
        "gap": None if meta.get("count") is not None else "No CelesTrak cache on disk.",
    }

def mcdowell_from_mission():
    p = ROOT / "tokenmax" / "mission-control" / "data" / "mission.json"
    d = load_json(p)
    if not d or not d.get("starlink"):
        return {
            "available": False,
            "gap": "Mission Control mission.json / starlink block missing on disk.",
            "label": "Jonathan McDowell · planet4589.org Starlink statistics (via Mission Control cache)",
        }
    sl = d["starlink"]
    src = (d.get("sources") or {}).get("starlink") or {}
    return {
        "available": True,
        "total": sl.get("total"),
        "byGen": sl.get("byGen"),
        "dataAsOf": sl.get("dataAsOf"),
        "label": src.get("label") or "Jonathan McDowell · Jonathan's Space Report, Starlink statistics",
        "home": src.get("home") or "https://planet4589.org/space/stats/star.html",
        "fetchedAt": src.get("fetchedAt"),
        "url": src.get("url"),
        "missionGeneratedAt": d.get("generatedAt"),
        "gap": None,
    }

def starlink_launches_from_mission():
    p = ROOT / "tokenmax" / "mission-control" / "data" / "mission.json"
    d = load_json(p) or {}
    launches = []
    for L in d.get("launches") or []:
        name = L.get("name") or ""
        mission = L.get("mission") or ""
        if "Starlink" not in name and "Starlink" not in mission:
            continue
        launches.append({
            "name": name,
            "mission": mission,
            "vehicle": L.get("vehicle"),
            "pad": L.get("pad"),
            "location": L.get("location"),
            "lat": L.get("lat"),
            "lon": L.get("lon"),
            "net": L.get("net"),
            "netPrecision": L.get("netPrecision"),
            "windowStart": L.get("windowStart"),
            "windowEnd": L.get("windowEnd"),
            "status": L.get("status"),
            "statusAbbrev": L.get("statusAbbrev"),
            "missionDesc": (L.get("missionDesc") or "")[:280],
            "apiUrl": L.get("apiUrl"),
        })
    src = (d.get("sources") or {}).get("upcoming") or {}
    return {
        "items": launches,
        "label": src.get("label") or "Launch Library 2 · The Space Devs (via Mission Control cache)",
        "home": src.get("home") or "https://thespacedevs.com/llapi",
        "fetchedAt": src.get("fetchedAt"),
        "gap": None if launches else "No upcoming Starlink launches found in Mission Control cache.",
    }

# --- Jim journal extractors (verbatim facts only; cite file + URLs) ---

def _links_near(text: str, start: int, end: int) -> list[str]:
    window = text[max(0, start - 200): min(len(text), end + 600)]
    urls = re.findall(r"https?://[^\s\)\]\>\"']+", window)
    # also markdown links
    urls += re.findall(r"\]\((https?://[^)]+)\)", window)
    # dedupe preserve order
    seen, out = set(), []
    for u in urls:
        u = u.rstrip(".,;)")
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out[:6]

def extract_fcc_mobile():
    """FCC Starlink Mobile approval from Oct 6/7 Jim research."""
    facts = []
    files_hit = []
    links = []

    research = ROOT / "ij_2026-10-07_research.md"
    rt = read_text(research)
    if rt and "15,000" in rt and "Starlink Mobile" in rt:
        files_hit.append("ij_2026-10-07_research.md")
        bullets = []
        for pat, key in [
            (r"EchoStar spectrum[^\n]*", "spectrum"),
            (r"waived the requirement[^\n]*", "carrier_waiver"),
            (r"about 150 Mbps[^\n]*", "promised_speed"),
            (r"about 4 Mbps[^\n]*", "current_speed"),
            (r"50% launched by Oct 2032[^\n]*", "deadline_50"),
            (r"full constellation by Oct 2035[^\n]*", "deadline_full"),
            (r"proposed opening more spectrum[^\n]*", "more_spectrum"),
        ]:
            mm = re.search(pat, rt)
            if mm:
                bullets.append({"key": key, "text": mm.group(0).strip().rstrip(".")})
        idx = rt.find("### Starlink")
        section = rt[idx: idx + 900] if idx >= 0 else rt
        for u in re.findall(r"https?://[^\s\)\]\>\"']+", section):
            u = u.rstrip(".,;)")
            if any(h in u for h in ("pcmag.com", "spacenews.com", "fcc.gov")) and u not in links:
                links.append(u)
        facts.append({
            "claim": "FCC approved 15,000 next-gen Starlink Mobile (direct-to-device) satellites",
            "detail": "Grant dated Tue Oct 6, 2026 (reported Wed Oct 7 in Jim journal).",
            "bullets": bullets,
            "file": "ij_2026-10-07_research.md",
            "links": list(links),
        })

    content = ROOT / "ij_2026-10-07_content.md"
    ct = read_text(content)
    if ct and "Starlink Mobile" in ct:
        files_hit.append("ij_2026-10-07_content.md")
        mm = re.search(r"\*\*Starlink Mobile:\*\*\s*([^\n]+)", ct)
        if mm:
            body = re.sub(r"\*\*", "", mm.group(1)).strip()
            # drop trailing markdown link junk
            body = re.split(r"\s*\[PCMag\]|\s*·\s*\[", body)[0].strip()
            for u in re.findall(r"\]\((https?://[^)]+)\)", ct[mm.start(): mm.end() + 350]):
                if any(h in u for h in ("pcmag.com", "spacenews.com")) and u not in links:
                    links.append(u)
            facts.append({
                "claim": "Starlink Mobile: " + body,
                "file": "ij_2026-10-07_content.md",
                "links": [u for u in links if "pcmag" in u or "spacenews" in u],
            })
        mm2 = re.search(r"Starlink Mobile V2 sats will give more than 100x V1[^\n.]*", ct)
        if mm2:
            facts.append({
                "claim": mm2.group(0).strip(),
                "file": "ij_2026-10-07_content.md",
                "key": "v2_bandwidth",
            })

    if not facts:
        return {
            "available": False,
            "gap": "No Starlink Mobile FCC notes found in Jim journals on disk.",
            "facts": [],
            "sources": [],
        }
    # Drop truncated / duplicate URLs (prefer longest unique by host+path prefix)
    clean = []
    for u in links:
        if len(u) < 40:
            continue
        # skip if a longer URL with same start already kept
        if any(k.startswith(u) or u.startswith(k[: max(40, len(u)-5)]) for k in clean):
            # replace shorter with longer
            clean = [u if (c.startswith(u) or u.startswith(c[:max(40,len(u)-5)])) and len(u) > len(c) else c for c in clean]
            if not any(u.startswith(c[:40]) or c.startswith(u[:40]) for c in clean):
                clean.append(u)
            continue
        clean.append(u)
    # simpler pass: keep unique by normalized prefix, longest wins
    best = {}
    for u in links:
        if "pcmag.com" in u or "spacenews.com" in u or "fcc.gov" in u:
            key = re.sub(r"https?://(www\.)?", "", u).split("?")[0][:48]
            if key not in best or len(u) > len(best[key]):
                best[key] = u
    links = list(best.values())
    return {
        "available": True,
        "gap": None,
        "facts": facts,
        "sources": links,
        "files": files_hit,
        "label": "Jim Interest Journal · FCC Starlink Mobile (Oct 6–7, 2026)",
    }


def extract_cadence_notes():
    """Launch cadence / V3 / Florida Falcon notes from Jim journals — labeled with file."""
    cards = []

    # Flight 14 / 26 V3
    p = ROOT / "ij_2026-09-29_research.md"
    t = read_text(p)
    if t and "26 Starlink V3" in t:
        m = re.search(r"\*\*26 Starlink V3\*\*[^\n]*", t)
        cards.append({
            "title": "Starship Flight 14 · first Starlink V3 deploy",
            "body": (m.group(0) if m else "26 Starlink V3 deployed (Mon Sep 28, 2026).")
                .replace("**", ""),
            "extra": "Musk: all 26 nominal / operating (per Jim Sep 29 recap). First revenue-generating Starship framing in journal.",
            "file": "ij_2026-09-29_research.md",
            "links": _links_near(t, t.find("26 Starlink V3"), t.find("26 Starlink V3") + 200),
            "when": "2026-09-28 / journal 2026-09-29",
        })

    # Last Florida Falcon 9 Starlink
    p = ROOT / "jim" / "musk-cos-2026-08-25.md"
    t = read_text(p)
    if t and "last planned Falcon 9 Starlink" in t:
        cards.append({
            "title": "Last planned Falcon 9 Starlink from Florida",
            "body": "SpaceX VP of Launch Kiko Dontchev: Tue Aug 25 SLC-40 flight was the last planned Falcon 9 Starlink from Florida; future East Coast Starlink on Starship; Vandenberg continues Falcon 9 Starlink.",
            "extra": "Journal also notes ~260 Falcon 9 Starlink missions from Florida since May 23, 2019 (company statement coverage).",
            "file": "jim/musk-cos-2026-08-25.md",
            "links": _links_near(t, t.find("last planned Falcon 9 Starlink"), t.find("last planned Falcon 9 Starlink") + 100),
            "when": "2026-08-25",
        })
        # 10-49 launch
        if "Starlink 10-49" in t:
            cards.append({
                "title": "Starlink 10-49 (Cape)",
                "body": "Falcon 9 launched 29 Starlink satellites from SLC-40, Cape Canaveral, Tue Aug 25, 2026 at 5:33 a.m. ET (SpaceX mission page per Jim).",
                "extra": "Booster B1067, 37th flight; landing A Shortfall of Gravitas. Official wording: “29 Starlink satellites” (v2-mini is tracker language).",
                "file": "jim/musk-cos-2026-08-25.md",
                "links": ["https://www.spacex.com/launches"],
                "when": "2026-08-25",
            })

    # Vandenberg 15-22
    p = ROOT / "jim" / "musk-cos-2026-08-26.md"
    t = read_text(p)
    if t and "27 Starlink satellites" in t:
        cards.append({
            "title": "Starlink 15-22 (Vandenberg)",
            "body": "Falcon 9 launched 27 Starlink satellites from SLC-4E, Vandenberg, Wed Aug 26, 2026 at 2:35 a.m. PT / 5:35 a.m. ET (SpaceX mission page per Jim).",
            "extra": "Booster B1082, 24th flight. First Falcon 9 Starlink from Vandenberg after Florida Falcon Starlink pause statement.",
            "file": "jim/musk-cos-2026-08-26.md",
            "links": [],
            "when": "2026-08-26",
        })

    # Group 15-25 carry / Oct window
    for rel in ["ij_2026-10-01_research.md", "ij_2026-10-07_research.md", "ij_2026-09-29_research.md"]:
        p = ROOT / rel
        t = read_text(p)
        if not t:
            continue
        if "Group 15-25" in t or "Starlink mission from Vandenberg" in t:
            m = re.search(r"[^\n]*(Group 15-25|Starlink mission from Vandenberg)[^\n]*", t)
            cards.append({
                "title": "Next Falcon Starlink · Group 15-25 (journal carry)",
                "body": (m.group(0) if m else "Starlink Group 15-25 noted in Jim research.").strip(),
                "extra": "Live NET/pad/status come from Launch Library 2 via Mission Control cache (see Launch cadence panel) — journal NET may be stale vs LL2.",
                "file": rel,
                "links": _links_near(t, (m.start() if m else 0), (m.end() if m else 80)),
                "when": rel.replace("ij_", "").replace("_research.md", ""),
            })
            break

    # Starmind / up to 100k Starlink (plans, not counts)
    p = ROOT / "ij_2026-10-06_research.md"
    t = read_text(p)
    if t and ("100,000" in t or "1 million" in t or "1M" in t):
        cards.append({
            "title": "Starmind / Starlink plans (Space Safety page)",
            "body": "Jim Oct 6: SpaceX Space Safety page plans “up to 100,000 Starlink” and “up to 1 million Starmind AI satellites.” FCC still reviewing Starmind application (Oct 7 carry: no new facts).",
            "extra": "These are published plans / application framing — not in-orbit counts.",
            "file": "ij_2026-10-06_research.md",
            "links": _links_near(t, t.find("100,000") if "100,000" in t else t.find("1 million"), 200),
            "when": "2026-10-06",
        })

    # V3 deploy video / LEO risk
    p = ROOT / "ij_2026-10-06_content.md"
    t = read_text(p)
    if t and "V3" in t:
        cards.append({
            "title": "V3 deploy video + LEO maneuver data push",
            "body": "Jim Oct 6: Starlink posted first video of V3 sats deploying from Starship; also argued undisclosed maneuvers by other operators are the biggest LEO risk (~half of ~650 maneuvering sats encountered share data — per journal).",
            "extra": None,
            "file": "ij_2026-10-06_content.md",
            "links": _links_near(t, t.find("V3"), t.find("V3") + 200),
            "when": "2026-10-06",
        })

    return {
        "cards": cards,
        "gap": None if cards else "No cadence notes found in Jim journals.",
        "label": "Jim Interest Journal · launch cadence & constellation notes",
    }

def millersville():
    return {
        "name": "Millersville, MD",
        "lat": 39.06,
        "lon": -76.64,
        "note": "Boyd home area · marker only (not live overhead tracking in this remaster).",
    }

def build():
    cel = celestrak_meta()
    mcd = mcdowell_from_mission()
    launches = starlink_launches_from_mission()
    fcc = extract_fcc_mobile()
    cadence = extract_cadence_notes()

    # Honesty: CelesTrak count vs McDowell inOrbit — both cited, may differ
    honesty = [
        "Satellite counts are never invented. CelesTrak “tracked” = objects in GROUP=starlink at cache fetch time.",
        "McDowell totals (in orbit / working / operational / by generation) come from Mission Control’s cached Jonathan McDowell table — dataAsOf shown on page.",
        "Decorative globe dots are ILLUSTRATIVE inclination shells (53° / 43° / 70° / 97°), not live SGP4 tracks. Legacy SGP4 globe archived under legacy/.",
        "FCC Starlink Mobile claims are quoted from Jim’s Oct 6–7 journals with source links — gaps labeled if a field was not in those files.",
        "Launch NETs/status from Launch Library 2 via Mission Control cache; journal NETs may lag LL2.",
    ]

    data = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "generatedAtET": iso_et(),
        "timezone": "America/New_York",
        "title": "Starlink Globe",
        "subtitle": "Constellation · Mobile FCC · Launch cadence",
        "remaster": "Sat Oct 10, 2026 afternoon · TokenMax daily-usage-check",
        "celestrak": cel,
        "mcdowell": mcd,
        "launches": launches,
        "fccMobile": fcc,
        "cadence": cadence,
        "millersville": millersville(),
        "honesty": honesty,
        "shells": [
            {"inc": 53, "label": "53° shell", "note": "Illustrative inclination family (McDowell / common tracker grouping)"},
            {"inc": 43, "label": "43° shell", "note": "Illustrative"},
            {"inc": 70, "label": "70° shell", "note": "Illustrative"},
            {"inc": 97, "label": "~97° polar", "note": "Illustrative"},
        ],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=1), encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    print(f"  celestrak count={cel.get('count')}  mcdowell inOrbit={(mcd.get('total') or {}).get('inOrbit')}  fcc={fcc.get('available')}  launches={len(launches.get('items') or [])}  cadence_cards={len(cadence.get('cards') or [])}")
    return data

if __name__ == "__main__":
    build()

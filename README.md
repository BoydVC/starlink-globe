# Starlink Globe — Sat Oct 10 afternoon remaster

Cinematic **Starlink mission wall** for Boyd (SpaceX / Starlink interest). TokenMax daily-usage-check burn.

**Live:** `./run.sh` → http://127.0.0.1:4277/  
**Offline:** `dist/starlink-globe-snapshot.html` (CSS/JS/data inlined; open from disk)  
**Best shot:** `screenshots/00-best-home.png`

## What's on the wall
| Panel | Content | Source (on-disk only) |
|---|---|---|
| Constellation | In orbit / working / operational / ascent / drift / down + by generation; CelesTrak tracked count | Jonathan McDowell via Mission Control `mission.json`; CelesTrak cache `data/fetch-meta.json` |
| Orbit view | Canvas globe, day/night terminator, **illustrative** inclination shells (53° / 43° / 70° / 97°), Millersville + pad markers | Natural Earth land · decorative shells (labeled ILLUSTRATIVE) — **not** live SGP4 |
| Starlink Mobile · FCC | 15,000 next-gen direct-to-device sats, carrier-waiver, spectrum, ~150 Mbps promise, deadlines | Jim journals `ij_2026-10-07_research.md` / `_content.md` with PCMag · SpaceNews links |
| Launch cadence | Upcoming Starlink mission(s) with NET in ET + T− when precision allows | Launch Library 2 via Mission Control cache |
| From Jim's journal | V3 deploy, Florida Falcon Starlink pause, Group 15-25 carry, Starmind plans, etc. | `ij_*` + `jim/musk-cos-*` — every card cites its file |

## Honesty
- **No invented SpaceX / FCC / constellation numbers.** Gaps are labeled on the page.
- Decorative globe dots are **not** tracking data. The Oct 7 live SGP4 three.js globe is archived under `legacy/`.
- CelesTrak “tracked” vs McDowell “in orbit” can differ; both are cited with as-of / fetch times.

## Files
`collect.py` · `server.py` (:4277, 127.0.0.1) · `web/` · `export_snapshot.py` · `screenshot.sh` · `tests/smoke_test.py` · `run.sh`

```bash
./run.sh --test          # collect + serve + snapshot + smoke
./screenshot.sh          # → screenshots/00-best-home.png
python3 export_snapshot.py
```

Remaster: **Saturday Oct 10, 2026 afternoon** (TokenMax daily-usage-check).


---
## Repo notes
- **Built:** Oct 10, 2026, by TokenMax (Boyd's Grok Bot) on the Grok Bot box.
- **Run:** `./run.sh` (then open the localhost URL it prints).
- Imported from `/workspace/tokenmax/starlink-globe` on Oct 23, 2026. node_modules, virtualenvs, logs and files over 20 MB were left out.
- Personal details (emails, phone numbers, home street address) were replaced with `[redacted-…]` placeholders.

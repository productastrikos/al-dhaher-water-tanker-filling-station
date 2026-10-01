# Kuwait Network Map — research brief (handoff doc)

**Prepared:** 13 Sep 2026 · **Why this file exists:** the client (Amit Garsund, MEW side) reviewed the
workflow deck and the 3D digital twin on 13 Sep and said, verbatim (Teams):

> "DT is OK, but we have to show a geographical map for Kuwait, these are 26 locations around
> Kuwait, each with two bay. We dont have all bays at one location."

This corrects the assumption baked into the current build (`twin3d/layout.js`, `data.js`,
`index.html` topbar) that the whole demo is **one** site — "Al Dhaher LFS · 42 Bays". Reality per
the client: the MEW lorry-filling network is **26 station locations spread across Kuwait, two
bays each (52 bays total)**. Al Dhaher is one real, confirmed location in that network (it is the
subject of a real CAPT/MEW tender — see Sources below) and is kept as the flagship site with the
full 3D twin already built; the other 25 are shown on a new country-wide map view.

This doc is the output of the web research already done so the implementing agent does not need
to repeat it — just consume the table below.

---

## 1. Base map asset (already downloaded into the repo)

**Updated 14 Sep** — swapped from the plain NordNordWest locator outline (v1, single flat land
tone — client feedback: "the map is horrible... we need coloured map and we can see location") to
a governorate-coloured administrative map. Same underlying coastline geometry and viewBox (TUBS'
file is itself derived from NordNordWest's coastline data), so the lat/lon→% projection formula
below is unchanged and both versions are pixel-compatible if you ever need to diff them.

* File: `assets/images/map/kuwait-base-map.svg`
* Source: Wikimedia Commons, `File:Kuwait, administrative divisions - Nmbrs - colored.svg`,
  created by **TUBS**.
* License: dual **GFDL** / **CC BY-SA 3.0** — attribution shown in the view's footer: *"Base map:
  TUBS, CC BY-SA 3.0, via Wikimedia Commons (governorate boundaries derived from NordNordWest's
  coastline data)"*.
* Unlike v1, this file's colours are **already final and baked into the SVG** — no runtime CSS
  recolouring step. It was processed once, offline, before being committed:
  1. The 6 governorates' pastel fills (`#E8F2AD` Jahra, `#FFCCCC` Asimah, `#FFDEA9` Farwaniya,
     `#EBCEF2` Mubarak Al-Kabeer, `#FFFDC0` Ahmadi, plus the tiny Hawalli sliver) were remapped to
     dark-theme-appropriate, mutually distinct tones directly in the file.
  2. `#E0E0E0` (outside-Kuwait background) → `#0b1526`; `#C6ECFF` (Gulf water) → `#0d2536`;
     `#FEFEE9` (fallback land) → `#233047`.
  3. Coastline stroke `#0978AB` → `#2a6f8a`; governorate/state border strokes `#646464` →
     `#4a5568` (both brightened for visibility against the new dark fills).
  4. The file's own tiny grey `1`–`6` governorate-number labels (`<g id="Nmbrs_Governorates">` /
     `..._1_`) are hidden (`display:none`) — our own station pins + a legend carry the labelling
     instead, so there's no risk of the wrong number↔governorate mapping shipping (verified by
     rendering the file to PNG and checking each numbered region against known geography before
     committing).
  If you need to redo this from a fresh copy of the source file, the exact recolour map is short
  enough to reconstruct from the bullets above; there's no separate script checked in for it.
* **Geographic bounding box of the SVG canvas** (needed to project lat/lon → x/y % for pins),
  `viewBox="0 0 1134.2744 979.20728"`:
  * North edge = **30.2°N**, South edge = **28.4°N**
  * West edge = **46.4°E**, East edge = **48.8°E**
  * The map author applied "N/S stretching 115%" to counter latitude distortion at this scale.
    Simple linear interpolation (`xFrac = (lon-46.4)/(48.8-46.4)`, `yFrac = (30.2-lat)/(30.2-28.4)`)
    lands close enough for a country this small at demo scale; if pins look visibly off vs. the
    coastline once placed, divide the computed `yFrac` deviation from 0.5 by 1.15 as a correction
    (`yFrac = 0.5 + (rawYFrac-0.5)/1.15`) and re-check against known landmarks (Kuwait City ~
    29.3759°N 47.9774°E sits a little north of the map's vertical center; Failaka island ~29.45°N
    48.32°E is offshore to the NE).
* Do **not** re-download at runtime (no live tile server / Leaflet) — the rest of this app is
  deliberately offline-safe (vendored Three.js, local `.glb`s); the static SVG keeps that property
  and matches the existing "download once, vendor it" pattern already used for fonts/libs here.

## 2. The 26 station locations (researched + placed)

No public MEW document lists exact lorry-filling-station addresses (checked `mew.gov.kw`,
including the branches/locations page, and general web search — nothing published). What **is**
confirmed: **Al Dhaher is real** — Kuwait's Central Agency for Public Tenders (CAPT) opened bids
for "establishing a fresh water filling station in Dhaher" (Zawya news, 2024), and Dhaher is a
real industrial-zone place name in **Ahmadi Governorate** near Fahaheel/Abu Halifa/Sabah Al-Ahmad
City. The other 25 below are **real, named Kuwait areas** (not invented placeholder names) chosen
to give a plausible, geographically sound network across all 6 governorates — per the client's
own instruction ("if not found for all of them put random for which are not known"). Label these
25 in the UI/data as illustrative network coverage; only Al Dhaher should be flagged as the
confirmed/tender-referenced site if the UI distinguishes provenance at all (a small "flagship"
badge on Al Dhaher's pin is enough — no need to caveat the other 25 on-screen, this is a sales
demo, not a compliance document).

Every location gets **2 bays** (`bays: 2`) except Al Dhaher, which keeps its existing full 42-bay
3D twin (the flagship site — the number mismatch vs. the network average is fine and mirrors
reality: a flagship LCC site is bigger than a standard 2-bay neighborhood station).

| # | Name | Governorate | Lat | Lon | Notes |
|---|---|---|---|---|---|
| 1 | Al Dhaher | Ahmadi | 29.055 | 48.105 | **Flagship** — full 3D twin, 42 bays (existing build) |
| 2 | Fahaheel | Ahmadi | 29.083 | 48.128 | |
| 3 | Abu Halifa | Ahmadi | 29.114 | 48.117 | |
| 4 | Mina Abdullah | Ahmadi | 29.028 | 48.146 | |
| 5 | Shuaiba | Ahmadi | 29.027 | 48.178 | |
| 6 | Wafra | Ahmadi | 28.633 | 47.933 | far south, farms belt |
| 7 | Fintas | Ahmadi | 29.164 | 48.128 | |
| 8 | Sabah Al-Ahmad City | Ahmadi | 28.972 | 48.086 | |
| 9 | Jahra | Jahra | 29.347 | 47.660 | |
| 10 | Sulaibiya | Jahra | 29.296 | 47.752 | |
| 11 | Amghara | Jahra | 29.323 | 47.807 | |
| 12 | Saad Al-Abdullah | Jahra | 29.417 | 47.683 | |
| 13 | Abdali | Jahra | 29.786 | 47.555 | near northern border |
| 14 | Taima | Jahra | 29.360 | 47.628 | |
| 15 | Naeem | Jahra | 29.336 | 47.678 | |
| 16 | Farwaniya | Farwaniya | 29.277 | 47.939 | |
| 17 | Jleeb Al-Shuyoukh | Farwaniya | 29.263 | 47.925 | |
| 18 | Khaitan | Farwaniya | 29.297 | 47.966 | |
| 19 | Ardiya | Farwaniya | 29.280 | 47.900 | |
| 20 | Sabah Al-Nasser | Farwaniya | 29.240 | 47.867 | |
| 21 | Andalous | Farwaniya | 29.291 | 47.953 | |
| 22 | Qurain | Mubarak Al-Kabeer | 29.267 | 48.080 | |
| 23 | Sabah Al-Salem | Mubarak Al-Kabeer | 29.243 | 48.098 | |
| 24 | Adan | Mubarak Al-Kabeer | 29.250 | 48.070 | |
| 25 | Shuwaikh | Al Asimah (Capital) | 29.343 | 47.933 | port/industrial |
| 26 | Sulaibikhat | Al Asimah (Capital) | 29.343 | 47.905 | |

Distribution: Ahmadi 8, Jahra 7, Farwaniya 6, Mubarak Al-Kabeer 3, Capital 2 = 26. This roughly
mirrors where MEW's real piped-network gaps / newer developments / industrial demand concentrate
(outskirts, industrial zones, farm belt) rather than dense central Kuwait City, which is the
realistic case for truck-delivered water demand.

## 3. Sources consulted

- MEW Kuwait branches/locations page — `https://www.mew.gov.kw/en/contacts/branches-location/`
  (gave the real area-name spelling conventions used above).
- Zawya: "Kuwait: CAPT opens bids for establishing fresh water filling station in Dhaher" —
  confirms Al Dhaher as a real, current MEW/CAPT water-filling-station project.
- Wikimedia Commons `File:Kuwait_location_map.svg` (NordNordWest) — base map + bounding box.
- General web search for a published MEW lorry-filling-station list came back empty — hence the
  "researched real place names, no confirmed exact address" approach above, exactly as instructed.

## 4. What to build (see the main task brief for full detail)

A new top-level `SIAP.registerView({ id: "network-map", group: "operations", ... })` showing this
SVG with 26 clickable pins (status-colored dot, name, bays, tag "FLAGSHIP" only on Al Dhaher).
Clicking the Al Dhaher pin opens the existing full experience (3D twin / bay control / HMI, all
unchanged). Clicking any other pin opens a lighter station-detail panel (2 bays, live-ish status,
"Full 3D twin available for flagship sites" note) reusing existing card/metric-line CSS classes —
it does not need its own 3D scene.

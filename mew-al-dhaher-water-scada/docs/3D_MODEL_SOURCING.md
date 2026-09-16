# 3D model sourcing — replacing the low-poly placeholder set

The current `assets/models/*.glb` set (see `assets/models/manifest.json`) is a low-poly
CC0 kit (Quaternius/Kenney/Poly-by-Google via poly.pizza) — good enough to block out the
scene, but it's why the station currently reads as flat-shaded boxes and dots rather than a
real facility. Use this list to find better replacements, then drop the files straight into
the **Scene Editor** (3D Digital Twin → Editor button) to place them — no code required.

## Where to look (free, commercial-use-safe, .glb/.gltf preferred)

1. **[Sketchfab](https://sketchfab.com/search?features=downloadable&sort_by=-likeCount&type=models)**
   — filter by *Downloadable* + license *CC0 / CC-BY*. By far the best quality-to-effort
   ratio for realistic industrial props. Search terms below.
2. **[Poly Pizza](https://poly.pizza)** — same library the current kit came from; still
   worth a second pass with more specific search terms (below) than whatever was grabbed
   first time round.
3. **[Kenney assets](https://kenney.nl/assets)** — CC0, stylised-but-clean low-poly packs;
   "Car Kit", "City Kit (Industrial)", "Racetrack Kit" all have usable pieces.
4. **[Quaternius](https://quaternius.com)** — CC0 low-poly, same family as current tanks/silos;
   check "Industrial Kit" and "Ultimate Vehicles" for higher-detail versions.
5. **[CGTrader free section](https://www.cgtrader.com/free-3d-models)** and
   **[TurboSquid free section](https://www.turbosquid.com/Search/3D-Models/free)** — higher
   detail, mixed licenses; **read the license on every individual model**, several "free"
   listings are personal-use-only.

Download as **glTF Binary (.glb)** wherever offered — that's what the loader expects. If a
site only offers .fbx/.obj, convert with `gltf-transform` or Blender's glTF exporter before
importing.

## Specific search terms per object

| Station element | Search terms | Notes |
|---|---|---|
| Tanker truck (hero) | `water tanker truck`, `fuel tanker semi trailer`, `tank truck low poly PBR` | Want a textured cab + tank, not a bare cylinder. Sketchfab has several rigged/PBR tanker trucks under CC-BY. |
| Queue / background trucks | `semi truck cab low poly`, `delivery truck game asset` | Cheaper geometry is fine — they're mostly seen from a distance. |
| Storage tank / silo | `vertical storage tank industrial`, `water treatment tank PBR`, `steel silo game asset` | Look for ones with visible rivets/ladders/handrails — reads much more "real" than a smooth cylinder. |
| Bay canopy / gantry | `steel canopy structure`, `loading bay canopy`, `industrial gantry frame` | Current one is a plain box; a trussed canopy sells the "filling station" read instantly. |
| Pump skid / pump house | `industrial pump skid`, `centrifugal pump unit PBR`, `pump house equipment` | |
| Piping / manifold | `industrial pipe rack`, `pipe valve flange PBR`, `factory piping kit` | The scene already builds pipes procedurally (`twin3d/station.js`); only replace if you want flanges/valves with real geometry. |
| Valves & gauges | `industrial valve PBR`, `pressure gauge model`, `ball valve game asset` | Small but high-value — close-up "Bay" camera preset will show these. |
| Security barrier / boom gate | `boom barrier gate`, `parking barrier arm PBR` | |
| CCTV / LPR camera | `security camera PBR`, `PTZ camera model`, `license plate camera` | |
| Perimeter fence | `chain link fence PBR`, `industrial fence panel` | |
| Control building / LCC | `site office building`, `industrial control room building`, `portable cabin PBR` | |
| Road / apron surface | `asphalt road PBR texture`, `concrete yard texture`, `road markings texture` | These are textures, not models — apply to the existing procedural ground plane in `twin3d/station.js`. |
| Forklift / staff (scale reference) | `forklift low poly`, `worker character rigged`, `hi-vis worker PBR` | Optional, but people and a forklift do more for realism than another truck. |
| Vegetation (yard edges) | `desert shrub low poly`, `palm tree game asset` | Al Dhaher is a Kuwait site — sparse desert planting, not grass. |

## After downloading

1. Drop the `.glb` into the **Scene Editor** panel (3D Digital Twin → **Editor** button →
   drag the file onto the drop zone, or Browse). It places, positions, and persists itself —
   see `docs/3D_EDITOR.md`.
2. If you want it in the *procedural* station build instead (so it's part of `buildStation()`
   rather than a manually-placed editor object — e.g. to replace the default silo everywhere),
   copy the file into `assets/models/`, add an entry to `assets/models/manifest.json` for
   attribution/licensing record-keeping, and swap the filename in `twin3d/station.js` /
   `twin3d/trucks.js`.

## Keeping it fast

The current station renders 42 bays procedurally on purpose (cheap boxes/dots) — that's a
deliberate performance tradeoff, not a placeholder to fix by swapping in 42 hi-poly models.
Reserve the higher-detail replacements above for the things the camera actually gets close to:
the hero tanker, the tanks/silos, the canopy, and whatever's visible in the "Bay" camera preset.
Keep replacement models under ~30k triangles and a single 2048px PBR texture set where
possible — Sketchfab and CGTrader both show triangle count on the model page before download.

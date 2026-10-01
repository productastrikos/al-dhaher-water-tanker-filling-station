# Assets — what is already in the repo, what you still need to download, licences

## A. Already downloaded & verified (11 Sep 2026)

### 3D models — `assets/models/` (8.6 MB, all load in Three.js r186; see `manifest.json` for URLs)
| File | Use in the twin | Author | Licence |
|---|---|---|---|
| truck-tank-kolos.glb | **Hero water tanker** (olive-drab military paint → recolour body/tank to white in code) | KolosStudios | CC-BY 4.0 |
| truck-quaternius.glb | alternate lorry / queue traffic | Quaternius | CC0 |
| water-tank-quaternius.glb, water-tank-kolos.glb | buffer / receiving tank | Quaternius / KolosStudios | CC0 / CC-BY |
| silo-quaternius.glb | station storage silos | Quaternius | CC0 |
| security-camera.glb, cctv-camera.glb | LPR & bay cameras | J-Toastie / Jörg H. | CC-BY 4.0 |
| traffic-barrier.glb | entry/exit gate arms | Quaternius | CC0 |
| pipes-quaternius.glb, pipe-long.glb, pipe-curved.glb | optional pipe pieces (procedural `TubeGeometry` preferred) | Quaternius / J-Toastie | CC0 / CC-BY |
| shipping-container.glb, container-small.glb | RTU kiosk / edge cabinet bodies | Quaternius | CC0 |
| building-l.glb (dome-like — not great for the LCC; prefer a procedural box), warehouse.glb (5.3 MB — only if needed), factory.glb | backdrop buildings | Quaternius / Lavender Harmony / Poly by Google | CC0 / CC-BY |
| metal-fence.glb | perimeter | Quaternius | CC0 |
| road-kit-kenney.glb | apron/lane tiles | Kenney | CC0 |
| sump-pump.glb (huge native scale — normalise) | pump skid | Poly by Google | CC-BY 3.0 |
| structure-quaternius.glb | loading gantry / canopy | Quaternius | CC0 |

**Attribution** (CC-BY items) must appear in the app's About/README: "3D assets by KolosStudios, J-Toastie, Jörg H., Lavender Harmony, Poly by Google via poly.pizza (CC-BY); Quaternius & Kenney (CC0)."

### Lighting — `assets/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr` (1.4 MB) — Poly Haven, CC0. Load with `HDRLoader` (vendored) for `scene.environment` only (keep a solid `--bg` background).

### Library — `vendor/three/` — Three.js **r0.186.0** (MIT), local import map in `index.html`: `three` → `./vendor/three/build/three.module.js`, `three/addons/` → `./vendor/three/addons/`. Addons vendored: OrbitControls, GLTFLoader, CSS2DRenderer, BufferGeometryUtils, SkeletonUtils, HDRLoader, RGBELoader.

### Reference material — `reference/`
* `ai-render-bay-aerial-v1.png` — the GPT render (style target for the twin).
* `commissioning-scada-hmi-reference.png` — Siemens PCS 7 "BALANZA 12" loading screen (target for the HMI view).
* `bulk-unloading-station-reference.png` — the truck → tank → pump → instruments schematic (target for the bay-detail twin).
* `Astrikos techno commercial offer for MEW AlDhaher V3.pdf` + `offer-text-extract.txt`.

### Smoke test — `docs/twin_smoke_test.html` (open via the local server) — proves vendored Three.js + GLBs + CSS2D labels + animated flow tube work offline.

## B. Please download manually (need a login / can't be fetched by script) — optional upgrades
1. **Sketchfab — "Tanker Truck Low Poly"** (CC-BY, ~64k tris) https://sketchfab.com/3d-models/tanker-truck-low-poly-b3ba48e4c85d4f8387b16ba289a578fe → export **glTF (.glb)**, save as `assets/models/tanker-sketchfab.glb`. Nicer civilian silhouette than the Kolos military tanker. Only if the Kolos recolour doesn't look right.
2. **Kenney "City Kit (Industrial)"** and **"Car Kit"** (CC0 zips) https://kenney.nl/assets/city-kit-industrial · https://kenney.nl/assets/car-kit → copy any `.glb` you like into `assets/models/kenney/`. Good for gantries, cabinets, extra vehicles.
3. **Quaternius "Ultimate Vehicles" / "Industrial" packs** (CC0) https://quaternius.com/packs/ultimatevehicles.html → optional truck variants.
4. **ISA-5.1 / P&ID symbol SVGs** for the HMI: Wikimedia Commons category "P&ID symbols" (public domain) https://commons.wikimedia.org/wiki/Category:Piping_and_instrumentation_diagram_symbols → save a handful (valve, control valve, pump, flow transmitter) to `assets/images/pid/`. The HMI WP draws its own SVG symbols if these are absent.
5. **Inter font** (OFL) — only if the venue machine lacks it; drop `Inter-Variable.woff2` into `assets/fonts/` and add an `@font-face` in `styles.css`. Not required (system fallback is fine).
6. **AI renders** from `docs/IMAGE_PROMPTS.md` → `assets/images/twin/`.

## C. Housekeeping
* `.gitignore` now un-ignores `assets/models/*.glb` — commit the models.
* Keep the app folder under ~25 MB so `run_demo.bat` + a zip works on venue wifi-less laptops.

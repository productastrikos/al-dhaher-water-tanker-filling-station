# S!aP — MEW Al Dhaher Water Filling Station (Demo)

A standalone, static demo of the S!aP centralized platform screens described in
the *Pre-Paid Automatic Control Filling System for Water Filling Stations*
technical offer (MEW / Al Dhaher Lorry Filling Station, Kuwait). Built for the
external client walkthrough — no backend, no build step. See
[`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) for the full
audit, gap analysis and the parallel work-package plan (WP-A 3D Twin, WP-B
ERP, WP-C HMI, WP-D Mobile + polish) this app was built from.

## Run it

The **3D Digital Twin** view loads `three.module.js` as an ES module, which
browsers refuse to `fetch()` over `file://`. Always serve the folder over
HTTP — double-clicking `index.html` will show a mostly-working app but the
3D twin will fail silently (falls back to the 2D P&ID). Easiest path:

```
cd mew-al-dhaher-water-scada
run_demo.bat        # Windows: finds Python (or falls back to Node) and opens the browser for you
```

or manually:

```
cd mew-al-dhaher-water-scada
python3 -m http.server 8080
# open http://localhost:8080
```

All data (bay statuses, flow rates, transactions, alarms, camera feeds, ERP
records) is simulated client-side and updates on a ~2.2s loop to feel live.
Chart.js, Lucide icons and Three.js are vendored locally in `vendor/` so the
demo has zero external dependencies — safe to run on venue wifi or fully
offline.

## Screens

1. **Command Dashboard** — 42-bay live status grid, S!aP system architecture
   & data-flow diagram (with live WAN-link and DR-sync badges), station
   process mimic, inlet flow gauge, KPIs, hourly volume/revenue chart, active
   alarms.
2. **Filling Bay Control** — per-bay transaction sequence (LPR detect → QR/PIN
   → validate → fill → debit/receipt), live gauge, valve/meter telemetry.
   Buttons read **Authorize fill** / **Release & close** — S!aP BPM authorises
   and releases the hold; the bay RTU executes valve control locally. The
   platform is read-only towards the control loop and continues on
   last-known balance if the WAN drops (see the offline demo below).
3. **3D Digital Twin** — a real-time Three.js scene: station overview (42
   bays / 6 manifolds, trucks arriving/filling/leaving) and a bay-detail view
   reproducing the reference P&ID (inlet valve → custody EMF meter → fine-fill
   valve → loading arm) with live HUD labels. The original 2D P&ID schematic
   is kept as a "P&ID" tab inside the same view. Falls back to a static
   2.5D render with hotspots if WebGL is unavailable.
4. **Tanker Loading HMI** — a PCS-7-style bay faceplate (batch table,
   7-segment totaliser digits, truck side-elevation mimic, MANUAL/AUTO/
   START/STOP/RESET buttons, trend strip, a "PCS 7 grey" classic theme
   toggle) — read-only mirror of the RTU, driven by the same bay data as Bay
   Control.
5. **CCTV & LPR Wall** — simulated camera grid with detection overlays, gate
   LPR log, video analytics event feed.
6. **Billing & MEW Pay** — prepaid transaction ledger (buffered rows tagged
   amber during a simulated WAN outage), K-net settlement status, and the
   MEW Pay customer wallet mock with "Open on phone" links into
   `mobile.html` (Top-up / QR Pay / Stations / History / Receipt).
7. **Reports** — shift / day / month production & revenue tables + chart.
   **Export CSV** downloads a real `.csv` of the active period (client-side
   `Blob`); **Export PDF** opens the browser print dialog against a
   print-friendly stylesheet (sidebar/topbar hidden); **Schedule Report**
   opens a modal (period, daily time, e-mail list) and persists entries to
   `localStorage` under `siap.reports.schedules`, listed under the table.
8. **Enterprise & ERP** — Customers & Accounts, Purchase Orders (wizard),
   Fleet & Drivers, Access Credentials, an **Order-to-Cash Tracker** with a
   "Run scenario" driving the whole demo end-to-end, ERP Integration
   (connector tiles, sync log, store-and-forward outage/replay), Tariffs,
   Work Orders and Audit Trail. A short summary card remains on the Command
   Dashboard, linking here.
9. **S!a — Ask & Act** — a natural-language query panel with scripted demo
   answers (operations + ERP-aware). Also available as a floating assistant
   button (bottom-right) on every screen.

## Offline / store-and-forward demo

The topbar **"Simulate WAN loss"** button (next to the clock) demonstrates
the offer's §4.3 resilience story without touching any real control logic:
turning it on forces both WAN links down (architecture diagram badges turn
red), shows an amber banner counting transactions buffered locally each
tick, and tags new ledger rows `Buffered`. Turning it off shows a green
"WAN restored — replayed N buffered transactions… DR RPO 0 s" banner for a
few seconds, flips the buffered ledger rows to `Posted`, and cycles the DR
sync badge through `syncing → synced`.

## Two entry points, one demo

- `index.html` — the main operator/control-room dashboard (desktop).
- `mobile.html` — the MEW Pay driver/customer companion, phone-shaped and
  interactive: **Wallet** (balance, recent activity, a dismissible
  "Proceed to Bay 14" push-notification banner), **Pay** (QR), **Orders**
  (PO list with status chips + a "Raise PO" mini-form that auto-computes
  KD at 0.0025 KD/IG), **Fleet** (trucks with calibration-expiry badges,
  drivers, "Request access card" with a Requested → Printed → Activated
  timeline), and **More** (Stations, Transaction History, last fill
  **Receipt** — bay, volume, K-net ref, meter serial, a QR block, and
  "Sent by SMS/e-mail" chips). Supports deep links
  `mobile.html?screen=fleet|orders|receipt|topup|qr|stations|history`.
  It's a standalone page with its own tiny seed state in `mobile.js` — not
  wired to `data.js` — so it works even opened on a separate phone with no
  shared backend.

## The `SIAP` extension API

`app.js` exposes a small registry + event bus on `window.SIAP` so feature
modules (`erp.js`, `hmi.js`, `twin3d.js`, …) can add screens without editing
the core files:

```js
SIAP.registerView({
  id: "erp-orders", title: "Purchase Orders", sub: "Prepaid orders · approval · invoice · K-net",
  group: "erp",            // "operations" | "revenue" | "intelligence" | "erp"  (sidebar section)
  icon: "file-text",       // lucide icon name
  navLabel: "Purchase Orders",
  html: `<div class="card">…</div>`,   // inner HTML of <section class="view" id="view-erp-orders">
  onMount(section) {},     // once, after the section exists
  onShow(section) {}, onHide() {},
  onTick(state) {},        // every 2.2 s while visible
});
SIAP.state              // the live simulation state (bays[], kpis, alarms, ledger, lprLog, …)
SIAP.selectedBayId      // number
SIAP.selectBay(id)      // updates bay control + 2D twin, emits "bay:select"
SIAP.startFill(bayId, { owner, account, plate, target })  // emits "fill:start" + "bay:change"
SIAP.stopFill(bayId, "done" | "idle")                     // emits "fill:stop"  + "bay:change"
SIAP.showView(id); SIAP.activeView();
SIAP.on("tick" | "ready" | "view:show" | "bay:select" | "bay:change" | "fill:start" | "fill:stop", fn) // returns unsubscribe
SIAP.pad(n), SIAP.statusLabel(s), SIAP.timeAgo(ts)
```

Bay object: `{ id, status: idle|filling|done|fault|offline, owner, account, plate, target (IG), dispensed (IG), flow (m³/h) }`.
Rules for every module: **read** `SIAP.state`, never duplicate it; **mutate
bays only via `startFill`/`stopFill`**; render only while your view is
active (`onShow`/`onHide`), pause any `requestAnimationFrame` loop when
hidden; reuse the CSS tokens in `styles.css` (`--bg --panel --accent --green
--amber --red --text-dim …`); Lucide icons via `<i data-lucide="…">` +
`lucide.createIcons()`. Full details, data shapes and acceptance criteria
per module are in [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) §3.1–§4.

## Docs

- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — the audit,
  gap analysis, target architecture, the `SIAP` API, and the full work-package
  breakdown (WP-A…WP-D) this app was built from.
- [`docs/ASSETS.md`](docs/ASSETS.md) — what's already downloaded (3D models,
  HDRI, vendored libraries), what's optional, and licences. **Attribution**
  (CC-BY items): "3D assets by KolosStudios, J-Toastie, Jörg H., Lavender
  Harmony, Poly by Google via poly.pizza (CC-BY); Quaternius & Kenney (CC0)."
- [`docs/IMAGE_PROMPTS.md`](docs/IMAGE_PROMPTS.md) — prompts for the AI hero
  renders used as the 3D twin's WebGL fallback and pitch-deck stills.

## Notes for whoever picks this up next

- This is a **front-end only demo**, not connected to real RTUs/PLCs/K-net —
  every number is simulated to be visually convincing, not accurate.
- Structure/copy follows the offer PDF's section 6 headings and screenshots
  closely so it reads as "the same product" in the room.
- To extend: bay/KPI/report data lives in `data.js`; core rendering + the
  simulation loop is in `app.js`; visual styling/tokens are in `styles.css`.
  Feature modules (ERP, HMI, 3D Twin, mobile) each own their own files and
  talk to the core only through `window.SIAP` — see above.
- **ES modules need an HTTP server.** `twin3d.js` is loaded as
  `type="module"`; opening `index.html` directly via `file://` will block it
  under most browsers' CORS rules for local modules. Use `run_demo.bat` (or
  any static server) — see "Run it" above.
- The CCTV wall (`assets/images/cctv/`) uses real Unsplash stock photos
  (licensed for free commercial use) as camera backgrounds instead of a
  canvas simulation, with a CSS "surveillance" treatment (scanlines,
  vignette, desaturation) plus an animated detection box overlay. Swap those
  files for real Al Dhaher site photos when available — same filenames.
- Charts (Chart.js) use scriptable gradient fills tied to the theme tokens
  in `styles.css`; if you change `--accent`/`--green`, update the gradient
  colors in `app.js` (`renderHourlyChart`, `renderGauge`, `renderReportChart`)
  to match.

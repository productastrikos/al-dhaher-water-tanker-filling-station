# MEW Al Dhaher — S!aP Demo v2: Audit, Gap Analysis & Implementation Plan

**Prepared:** 11 Sep 2026 (Fri) · **External demo:** Tue 15 Sep 2026 · **Owner:** Parth (Astrikos AI)
**Source of truth:** `reference/Astrikos techno commercial offer for MEW AlDhaher V3.pdf` (text extract: `reference/offer-text-extract.txt`), Teams guidance from Amit Garsund & Kausthubh Sumanth (10–11 Sep), and the two reference images in `reference/`.

This document is self-contained: an AI coding agent or a developer can execute it without the chat history.

---

## 0. TL;DR

| # | What the customer / management asked for | Today | Target (this plan) |
|---|---|---|---|
| 1 | **3D digital twin** of the station & the end-to-end filling flow, with live parameters (pressure, temperature, flow, level…) shown dynamically — "like the ADNOC sulfur loading twin" | Flat 2D SVG P&ID of one bay (`renderBayTwinDiagram`) | Real-time **Three.js** twin: (a) **bay detail** = the reference schematic in 3D (tanker → inlet valve → PT → EMF custody meter → TT → fine-fill valve → loading arm → tanker), (b) **station overview** = 42 bays / 6 manifolds with tankers arriving, filling and leaving driven by the same simulation + wallet balances, (c) camera fly-to, hover/click HUD. Fallback: AI-rendered 2.5D image with live hotspots. |
| 2 | **Complete ERP workflow** — "from PO being raised, to driver & truck registered, to access card issued… currently it is more monitoring. The platform needs to be complete ERP" | One illustrative "ERP Integration — Future-State" card with a 4-row mocked sync log | New **Enterprise & ERP** sidebar group: Customers & Accounts · Purchase Orders (wizard) · Fleet & Drivers · Access Credentials (RFID/QR/PIN lifecycle) · **Order-to-Cash Tracker** with a "Run scenario" that drives the whole demo end-to-end · ERP Integration (SAP/Oracle/D365 connectors, mapping, sync log) · Tariffs · Work Orders · Audit trail |
| 3 | **Tanker loading SCADA screens** like the Siemens PCS 7 "BALANZA 12" reference | none | **Tanker Loading HMI** view (PCS 7 style): preset/delivered/remaining table, big totaliser digits, truck side-elevation with rising fill, ISA valve/pump symbols with state colours, MANUAL/AUTO/START/STOP/RESET, interlock lamps, alarm line, trend strip |
| 4 | Mobile app alongside (simple, like DSO) | MEW Pay wallet (`mobile.html`) — wallet/top-up/QR/stations/history | Keep; add **Fleet, Orders, Receipt, Bay assignment** screens so the driver side of the ERP workflow is visible on a phone |
| 5 | ERP integration module ("show we can integrate in future") | small card on dashboard | Promoted to a full page under Enterprise & ERP (see 2) |
| 6 | Everything in offer §6 (Command Dashboard, Bay Control, Billing/MEW Pay, CCTV/LPR, S!a, Reports) | ✅ all present and match the offer screenshots | Keep; fix the bugs listed in §2.3; wire real CSV export |

Work is split into **4 parallel work packages** (WP-A 3D Twin, WP-B ERP, WP-C HMI, WP-D Mobile + polish) that touch **disjoint files** thanks to the `SIAP.registerView()` registry added to `app.js` (already done — §4).

---

## 1. Requirements inventory (what the demo must prove)

### 1.1 From the technical offer (PDF)
* §1.1 / §4.1 – 42 bays, custody-transfer EMF meter, tight shut-off valve, RTU + driver interface per bay; LCC at Al Dhaher; main DC Salmiya; DR South Surra; WNCC (Shuwaikh) DN800 network flow; K-net payment gateway; MEW Pay app; web portal.
* §4.3 – **Sequence of operation:** LPR detect → QR/Barcode/RFID + PIN → account validation → automatic volume-controlled fill with **fine-fill top-up** → **exact-volume debit** → **SMS/e-mail receipt**; **offline**: bay + concentrator continue on last-known balance, store-and-forward up to 15 days; remote lock-out & fraud control (PIN-abuse lockout, plate/QR mismatch, remote enable/disable of bays).
* Module 3 – water-loss / mass-balance (inlet vs dispensed), predictive maintenance on valves & meters, LPR/facial/leak analytics, fraud & demand analytics — all "Glass Box".
* Module 4 (BPM) – prepaid charging logic, incident lifecycle, PIN-lockout & escalation SOPs, K-net settlement reconciliation to MEW bank, scheduled shift/day/month reports, immutable audit.
* Module 5 (Viz & Astriverse) – command dashboard, **3D digital twin ("spatial situational awareness of the station")**, CCTV/LPR wall, **executive cockpit**, MEW web portal + MEW Pay app (EN/AR), unlimited users.
* Module 6 / Core – S!a natural-language querying & automated reporting with approval gates; RBAC, SSO/AD, audit.
* §5.3 – platform is **read-only towards the field** (no write-back to the dispensing loop). ⚠️ Our "Start/Stop" buttons must be labelled as *authorisation / release* (BPM), not valve control. Keep the wording "Authorize fill / Release hold / Remote disable bay".
* §6.2–6.7 – the six use-case headings Kausthubh listed. Screens in the PDF are screenshots of **this** demo — keep visual continuity.

### 1.2 From management (Teams, 10–11 Sep)
* **Amit:** complete workflow PO → driver & truck registration → access card issue → … ; "complete ERP". Tanker-loading screens like the PCS 7 reference (`reference/commissioning-scada-hmi-reference.png`).
* **Kausthubh:** whole end-to-end filling flow as a DT/schematic (`reference/bulk-unloading-station-reference.png`) with parameters displayed dynamically (pressure/temperature etc.); "trucks coming in and getting filled depending on the balances"; simple mobile app; one ERP module; demo likely Tuesday.
* **Visual target for 3D:** `reference/ai-render-bay-aerial-v1.png` (the GPT render already made) — aerial ¾ view, sand ground, yellow/black striping, cyan process lines, dark HUD labels.

---

## 2. Audit of the current application

### 2.1 Inventory
| File | Lines | Role | Verdict |
|---|---|---|---|
| `index.html` | ~410 | 7 views (dashboard, baycontrol, twin, cctv, billing, reports, sia) + floating S!a | Solid; now has nav-group ids + module script tags |
| `app.js` | ~1,250 | render + 2.2 s simulation loop | Solid; now exposes `window.SIAP` registry/bus |
| `data.js` | 207 | simulated state (42 bays, KPIs, alarms, ledger, LPR, reports, S!a canned answers) | OK |
| `styles.css` | 687 | dark S!aP theme tokens | OK, reuse tokens in all new UI |
| `mobile.html/js/css` | ~400 | MEW Pay phone companion, standalone state | OK |
| `vendor/` | Chart.js 4 UMD, Lucide, **Three.js r0.186.0 (added)** | offline-safe |
| `assets/images/cctv/*` | 6 Unsplash stills | OK |
| `assets/models/*.glb` (added) | 20 low-poly CC0/CC-BY models, 8.6 MB total, `manifest.json` has licences | see `docs/ASSETS.md` |
| `assets/hdri/*.hdr` (added) | Poly Haven CC0 sky, 1k | for PBR lighting |

### 2.2 Coverage vs requirements
| Requirement | Status | Notes |
|---|---|---|
| Command dashboard (42-bay grid, inlet gauge, KPIs, hourly chart, alarms, ack, banner) | ✅ | matches PDF p.14 |
| Architecture diagram + WAN/DR live badges | ✅ | extra vs PDF, good |
| Station process mimic (6 manifolds) | ✅ 2D | becomes part of the 3D overview |
| Bay control: 5-step sequence, faceplate, authorisation card, S!a guidance | ✅ | matches PDF p.15; ETA unit bug fixed (§2.3) |
| Digital twin of one bay with live values | ⚠️ 2D only, sparse | **WP-A** replaces with 3D; keep 2D as "P&ID" tab |
| Station-level twin with tankers arriving/leaving | ❌ | **WP-A** |
| CCTV wall, LPR log, video analytics | ✅ | |
| Billing ledger, K-net, MEW Pay card, phone companion | ✅ | |
| Reports shift/day/month + chart | ✅ UI | export buttons are dead → **WP-D** wires CSV |
| S!a chat (3 canned answers) + floating panel | ✅ | add ERP-aware answers (**WP-B**) |
| ERP: customers, POs, invoices, fleet, drivers, cards, tariffs, WOs, audit | ❌ | **WP-B** |
| Order-to-cash end-to-end scenario | ❌ | **WP-B** (+ drives WP-A/C via `SIAP` bus) |
| Tanker loading HMI (PCS 7 style) | ❌ | **WP-C** |
| Offline / store-and-forward demo | ❌ | **WP-D** small: "Simulate WAN loss" toggle → bays keep filling on last-known balance, queue counter, resync |
| Receipt artefact (SMS/e-mail) | ❌ | **WP-B** generates receipt; **WP-D** shows it on phone |
| Water-loss / mass-balance card | ❌ | P2 (WP-D if time): inlet totaliser vs Σ dispensed, % NRW |
| Executive cockpit, login/RBAC, EN/AR toggle, DR failover | ❌ | P2 — list in "future" slide, not built |

### 2.3 Defects found (fixed in the scaffold commit unless noted)
1. `app.js` ETA mixed Imp.gal with m³ (`remaining/1000 ÷ flow/60`). Fixed: `remaining × 0.004546 / flow` (demo clock ≈ 60× real time, consistent with the tick that adds `flow × 8` IG per 2.2 s).
2. `data.js` LPR log said "Filled 4,120 **KG**" — water is sold by volume. Fixed → `IG`.
3. `.gitignore` ignored **all** `*.glb` → the models would never be committed/pushed. Fixed with a negation rule for `assets/models/*.glb`.
4. A 2.7 MB ChatGPT PNG and the 1.8 MB offer PDF were in the app root (served with the app). Moved to `reference/`.
5. "Start/Stop" buttons imply field write-back, which the offer excludes (§5.3, §8.3). **WP-C/WP-D:** relabel to *Authorize fill* / *Release & close* and add the util-text "S!aP BPM authorises; the RTU controls the valve".
6. Report Export PDF/CSV/Schedule buttons are inert → **WP-D**.
7. `renderBayGrid()` rebuilds 42 tiles + listeners every tick (`innerHTML`). Works, but WP-D may switch to event delegation if any jank appears with the 3D view open.
8. KPI deltas ("▲ 6 vs avg", "in queue: 4") are static strings — **WP-B** feeds "in queue" from the ERP gate queue.
9. Cache-busting query strings bumped to `?v=4` (styles/app/data) — remember to bump again on release.

---

## 3. Target architecture (no build step, offline-safe)

```
index.html
 ├─ styles.css            (core theme, unchanged tokens)
 ├─ modules.css           (@import twin3d.css, erp.css, hmi.css)
 ├─ <script type=importmap>  three → ./vendor/three/build/three.module.js
 ├─ data.js  → app.js     (core, defines window.SIAP registry + bus)   ← DO NOT edit in WPs
 ├─ erp-data.js, erp.js   (WP-B, classic scripts)
 ├─ hmi.js                (WP-C, classic script)
 └─ twin3d.js  (type=module, WP-A) → imports ./twin3d/*.js
mobile.html + mobile.js + mobile.css   (WP-D)
assets/models/*.glb, assets/hdri/*.hdr, assets/images/**
docs/IMPLEMENTATION_PLAN.md, docs/ASSETS.md, docs/IMAGE_PROMPTS.md
```

### 3.1 The `SIAP` extension API (already implemented in `app.js`)
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
Rules for every WP: **read** `SIAP.state`, never duplicate it; **mutate bays only via `startFill/stopFill`**; render only when your view is active (`onShow/onHide`), pause `requestAnimationFrame` loops when hidden; use the CSS tokens in `styles.css` (`--bg --panel --accent --green --amber --red --text-dim …`); Lucide icons via `<i data-lucide="…">` + `lucide.createIcons()`.

---

## 4. Work packages

### WP-A — 3D Digital Twin (`twin3d.js`, `twin3d/`, `twin3d.css`) — P0
**Goal:** replace the 2D twin with a real-time Three.js scene that (1) reproduces the reference schematic in 3D for the selected bay with every parameter live, (2) shows the whole station with trucks arriving/filling/leaving, (3) looks like `reference/ai-render-bay-aerial-v1.png` (dark-HUD-on-daylight-site).

**Files**
* `twin3d.js` (entry, ES module) → `SIAP.registerView({ id: "twin3d", group: "operations", icon: "box", title: "3D Digital Twin", sub: "Astriverse · station & bay · live from S!aP Connect" })`. Also replace the existing sidebar item "Digital Twin" behaviour: keep `view-twin` (2D P&ID) reachable as a tab inside the 3D view ("3D" | "P&ID" toggle) — do **not** delete `renderBayTwinDiagram`.
* `twin3d/scene.js` renderer, camera, lights (HemisphereLight + DirectionalLight with one 2048 shadow map, `assets/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr` via `HDRLoader` for environment only), fog matching `--bg`, `setPixelRatio(min(devicePixelRatio, 1.5))`, resize observer, RAF loop that stops on `onHide`.
* `twin3d/assets.js` GLTF cache; `recolor(root, hex)` (the KolosStudios tanker is olive-drab → set body meshes to `#e8edf3`, tank to `#f4f6f8`, keep tyres dark); `normalizeToHeight(root, metres)`; graceful fallback to primitives if a GLB fails.
* `twin3d/station.js` layout: ground plane 220 × 140 m (sand `#c9b58b` with subtle grid), perimeter `metal-fence.glb`, LCC building (procedural box + roof, dark glazing), storage `silo-quaternius.glb` ×2 + `water-tank-quaternius.glb`, DN800 inlet header from north edge (Ø 0.8 m tube) → 6 manifold headers (A–F, Ø 0.4 m) → 7 bays each (Ø 0.15 m risers). Bay = concrete apron, loading arm (articulated 3-segment tube), kiosk (`container-small.glb` recoloured, QR/PIN screen plane), pole with `security-camera.glb`. Gate entry & exit at south with `traffic-barrier.glb` + LPR camera. Road loop (`road-kit-kenney.glb` tiles or simple dark plane with lane markings) entry → queue → bays → exit.
* `twin3d/trucks.js` truck pool (`truck-tank-kolos.glb`, 42 + 6 instances, cloned). State machine per bay from `SIAP.state.bays[i].status`: `idle` → no truck (or leaving); `filling` → truck parked, arm connected, tank liquid mesh scale.y = dispensed/target; `done` → arm retracts, truck drives to exit over ~6 s; `fault` → red beacon blink + amber outline; `offline` → grey. Arrivals: when a bay flips to `filling` a truck spawns at the gate and drives the spline (`CatmullRomCurve3`) to the bay in ~4 s (wheels rotate). Queue at gate shows `kpis.queue` (WP-B sets it) trucks waiting; barrier animates up on each release.
* `twin3d/bay.js` bay-detail sub-scene built at the selected bay (camera fly-to): inlet valve (actuator body + stem; wedge rotates 90° open; colour green/grey/red), **PT** (transmitter head on a stub), **custody EMF flowmeter** (flanged body, blue), **TT**, **fine-fill valve**, loading arm, hatch, kiosk, arm camera. Flow animation: second thin tube with a `CanvasTexture` (cyan dashes) whose `offset.x` advances proportional to `bay.flow`; stops at 0. Fine-fill: when `dispensed > 0.85·target` the dash speed halves and the fine-fill valve label reads `%`.
* `twin3d/labels.js` `CSS2DRenderer` HUD chips (class `.t3-label`, dark `--panel` bg, 1px `--border-strong`, cyan value, small caps key) pinned to instruments: `INLET 5.92 bar`, `FLOW 41.8 m³/h`, `TEMP 26.4 °C`, `DISPENSED 3,420 / 5,000 IG · 68 %`, `VALVE OPEN · 74 %`, `MODE AUTO → FINE-FILL`, `LPR 3/84621 ✓`, `QR/PIN ✓`, `WALLET KD 148.500 → KD 139.950`, `RECEIPT SMS+EMAIL`. Values come from `SIAP.state` + the same jitter helpers used by the 2D twin (`state.kpis.inletPressure + bayId%5·0.06 + sin(t)`; temp `26 + sin`). Update on `SIAP.on("tick")` **and** on a 250 ms timer for smooth interpolation of `dispensed`.
* `twin3d/camera.js` presets: **Overview** (aerial ¾, like the render), **Manifold**, **Bay** (low ¾ from the kiosk side), **Follow truck**; tween with ease-out over 1.2 s; `OrbitControls` with damping, min/max polar angle so the user can't go under the ground.
* `twin3d/picking.js` raycast on bays; hover → highlight + mini HUD (bay, owner, plate, %); click → `SIAP.selectBay(id)` + fly to Bay preset. Listen to `bay:select` from other views.
* UI chrome in the view: left toolbar (camera presets, "Auto-tour" toggle that cycles bays that are filling, "Flow lines" toggle, "Labels" toggle, "Wireframe/X-ray"), right side "Bay N · live" card mirroring the bay-control transaction card (reuse markup classes), bottom legend (status colours), FPS-safe.
* `twin3d.css` – `.t3-canvas-wrap { position:relative; height: calc(100vh - 180px); min-height: 560px; border-radius: var(--radius-lg); overflow:hidden }`, `.t3-label`, toolbar buttons (reuse `.btn`, `.btn-sm`).
* **Fallback:** if `!WebGLRenderingContext` or the renderer throws → show `assets/images/twin/bay-aerial.jpg` (export of `reference/ai-render-bay-aerial-v1.png`, resized to 1920 px) with absolutely-positioned `.t3-label` hotspots at fixed % coordinates fed by the same data (2.5D). Also expose this as a "Render" tab — it is a good static hero for slides.

**Acceptance**
* Sidebar "3D Digital Twin" opens in < 2 s on an integrated GPU laptop, ≥ 30 fps at 1560×980, no console errors, RAF stops when the view is hidden.
* Selecting Bay 14 in Bay Control and then opening the twin shows Bay 14 with a filling truck; values in the HUD match the Bay Control panel numbers.
* Clicking a bay tile in the 3D overview navigates Bay Control (existing behaviour) **and** the 3D bay preset.
* Trucks visibly arrive/leave as the simulation flips bays; the ERP scenario (WP-B) can call `SIAP.startFill(14, {...})` and the twin reacts within one tick.
* `lucide` icons render in the toolbar; keyboard: `1/2/3` camera presets, `L` labels, `Esc` overview.

**Proven starter** — `docs/twin_smoke_test.html` (copied from the scratch test) already loads the vendored Three.js + 8 GLBs + CSS2D labels + animated flow tube with zero errors; reuse its import map and pipe/flow code.

### WP-B — Enterprise & ERP module (`erp-data.js`, `erp.js`, `erp.css`) — P0
**Goal:** make the demo an end-to-end *order-to-cash* ERP, not just monitoring. Everything lives under the new sidebar group **Enterprise & ERP** (`group: "erp"`), one `SIAP.registerView` per screen. Persist demo edits in `localStorage` (`siap.erp.v1`) so a refresh mid-demo doesn't lose the scenario; add a "Reset demo data" in the tracker footer.

**Data (`erp-data.js`)** — global `ERP` object, seeded deterministically, reusing names from `data.js` (`OWNERS`, plates like `3 / 84621`, account `KWT-40216`):
* `customers[]` — 10 tanker owners: id `CUST-0001`, name, CR no., category (Municipal contractor / Private / Government), contact, phone `+965 …`, email, KYC docs (Civil ID, CR copy, tanker calibration cert) with status, credit terms (Prepaid), wallet KD, status Active/Suspended/Pending KYC, registered since.
* `tariffs[]` — `KD 0.0025 / IG` standard; bulk tier; government tier; VAT 0 %.
* `purchaseOrders[]` — 12 POs: `PO-2026-0187`, customer, quantity IG, amount KD, requested delivery window, status ∈ `Draft → Submitted → Approved → Invoiced → Paid → Active (wallet credited) → Consuming (n fills) → Closed`, approver, invoice no. `INV-88213`, K-net ref, created/updated timestamps, remaining IG.
* `trucks[]` — 24: plate, owner, capacity IG (3,000/5,000/8,000), make, tank calibration cert no. + expiry, hatch type, status Active/Due calibration/Blocked, RFID tag.
* `drivers[]` — 24: name, civil ID (masked), licence class & expiry, phone, assigned truck(s), status, photo initials.
* `credentials[]` — access cards: `CARD-10432`, type RFID / QR / PIN, linked customer + truck + driver, PIN attempts, status ∈ `Requested → Printed → Activated → Suspended/Lost/Expired`, issued at, expiry.
* `workOrders[]` — 6 CMMS items (Bay 27 valve seat inspection, Bay 12 meter calibration …) with priority, assignee, due, status.
* `audit[]` — immutable log rows (ts, user, action, object, before → after hash).
* `gate` — `{ queue: [ {plate, owner, eta} ], lastRelease }`; keep `SIAP.state.kpis.queue` in sync so the dashboard KPI "in queue" is live.
* `erpSync[]` — connector log (SAP S/4HANA · Oracle Fusion · MS D365 tiles; objects GL posting, Invoice, Customer master, Fleet master, Stock level; direction; status; retries).

**Screens (`erp.js`)**
1. **Customers & Accounts** (`erp-customers`) — table (search, status filter), row → drawer with KYC checklist, wallet, fleet count, PO history, "Suspend / Re-activate" (writes audit).
2. **Purchase Orders** (`erp-orders`) — KPI strip (open POs, KD pending approval, IG contracted, wallet liabilities); table; **"New PO" 4-step wizard** modal: customer → quantity/tariff (auto KD) → approval (approver chip, comment) → invoice & payment (K-net ref, "Pay now" animates → Paid → wallet credited: also bump `ERP.customers[i].wallet` and push a `Top-up` row into `SIAP.state.ledger`).
3. **Fleet & Drivers** (`erp-fleet`) — two tabs; "Register truck" and "Register driver" forms; link driver↔truck; calibration-expiry badges; LPR test button ("Scan plate" → matches to account, shows on CCTV LPR log via `SIAP.state.lprLog.unshift`).
4. **Access Credentials** (`erp-cards`) — card lifecycle board (kanban columns Requested / Printed / Activated / Suspended); "Issue card" form (type, customer, truck, driver, PIN set) → renders a **card mock** (RFID card graphic with MEW / S!aP branding, masked number, QR) and a printable receipt; "Simulate 3 wrong PINs" → status Suspended + alarm pushed to `SIAP.state.alarms` (reuses the existing critical-alarm banner).
5. **Order-to-Cash Tracker** (`erp-o2c`) — THE demo screen. Horizontal 14-step lifecycle: `PO raised → Approved → Invoiced → Paid (K-net) → Wallet credited → Truck registered → Driver registered → Card issued → Gate LPR match → Bay authorised (QR/PIN) → Filling (fine-fill) → Exact-volume debit → Receipt (SMS/e-mail) → GL posting → Settlement to MEW bank`. Each step shows object ids and timestamps. **"▶ Run demo scenario"** advances one step every ~2.5 s (with "Pause / Step / Reset"), and at each step calls into the rest of the app: `SIAP.state.lprLog.unshift`, `SIAP.selectBay(14)`, `SIAP.startFill(14, {owner, account, plate, target: 5000})`, watch `SIAP.on("fill:stop")` to move to *debit*, push ledger row, push `mewActivity`, add `erpSync` GL row, write `audit`. Also exposes `window.ERP_SCENARIO` so the 3D twin can subscribe (`SIAP.on("erp:step", …)` — emit it via `SIAP.emit`). Show a receipt modal (SMS bubble + e-mail preview) at the receipt step.
6. **ERP Integration** (`erp-integration`) — move the dashboard card here and expand: connector tiles with health, object mapping table (S!aP object → ERP IDoc/OData entity, frequency, last sync), sync log with retry button, Ministry of Finance interface line, "Simulate outage → store-and-forward → replay" button. Keep a slim summary card on the dashboard that links here (edit the existing card's HTML in `index.html` is allowed **only** for this: replace its body with a 2-line summary + button `SIAP.showView('erp-integration')`).
7. **Tariffs & Contracts** and **Work Orders** and **Audit Trail** — simple tables (can be tabs inside one view `erp-admin` to save time).
8. **S!a hooks** — add 3 canned answers to `state.siaResponses` at runtime (`Object.assign`): "how many POs are awaiting approval?", "which trucks have calibration expiring this month?", "show me the receipt for the last fill at bay 14".

**Acceptance** — the tracker runs unattended for the full lifecycle in < 45 s, every step visibly changes something elsewhere in the app (CCTV LPR log, bay control, ledger, wallet, alarms KPI, 3D twin), a refresh keeps the data, "Reset demo data" restores seeds, no console errors, all forms keyboard-accessible.

### WP-C — Tanker Loading HMI, PCS 7 style (`hmi.js`, `hmi.css`) — P0
**Goal:** a screen that an MEW SCADA engineer instantly recognises (reference: `reference/commissioning-scada-hmi-reference.png`), fed by the same bay data.
* `SIAP.registerView({ id: "hmi", group: "operations", icon: "monitor", title: "Tanker Loading HMI", sub: "Bay faceplate · PCS 7 style · read-only mirror of the RTU" })`.
* Layout (SVG + HTML, 16:9 in a `.card`): 
  * **Top strip**: bay selector, tag `LFS-BAY-14`, mode lamp AUTO/MANUAL, alarm line (latest alarm for that bay, red text), date/time.
  * **Batch table** (left): rows Preset / Delivered / Remaining / Flow / Batch no. / Account, columns for the last 3 batches like the reference (`OK` green rows).
  * **Totaliser display**: 7-segment style digits `DELIVERED 03420 IG` (font: `mono`, dark inset panel, cyan digits; the reference shows `PESO 23763`), a second smaller display `REMAINING 01580`.
  * **Mimic**: truck side elevation (SVG path: cab + cylindrical tank on chassis, 3 axles) parked on a bay apron; tank interior fills green from bottom proportional to `dispensed/target`; loading arm from a gantry; upstream: storage tank, pump `P-01` (ISA circle-with-triangle, green running / grey stopped), inlet valve `XV-14A`, EMF meter `FT-14`, PT `PT-14`, TT `TT-14`, fine-fill valve `XV-14B`; pipes colour cyan when flowing, grey when static; small lamps: **Earth clamp**, **Hatch open**, **Overfill probe**, **Emergency stop**, **RTU comms**.
  * **Buttons**: `MANUAL` `AUTO` `START` `STOP` `RESET` (styled like the reference's grey-panel buttons, but using theme tokens). START → `SIAP.startFill(bay)`, STOP → `SIAP.stopFill(bay,"idle")`, RESET → clears fault (`bay.status="idle"`), MANUAL/AUTO toggles a local mode flag shown in the lamp. Add util-text: "Commands are BPM authorisations relayed to the RTU — S!aP is read-only towards the control loop".
  * **Trend strip** (bottom): 60-point sparkline of flow (Chart.js line, no axes) + preset line.
  * **Classic toggle**: a "PCS 7 grey" theme switch that swaps the card to light-grey panel colours (`#d9dde3` bg, black text, Siemens-green `#00a651` run lamps) for the "looks like the plant HMI" moment; default stays S!aP dark.
* `onTick` refreshes; interpolate the fill level at 250 ms for smoothness.

**Acceptance** — matches the reference composition (table top-left, big number, truck bottom, buttons top-right), reacts to the same bay as Bay Control / 3D, START/STOP round-trips through `SIAP`, classic toggle works, no console errors.

### WP-D — Mobile driver flows, offline demo, polish (`mobile.*`, small `app.js` edits) — P1
* **Mobile (`mobile.html/js/css`)**: add tabs **Fleet** (my trucks + drivers with calibration badges, "Request access card" → status timeline), **Orders** (PO list with status chips + "Raise PO" mini-form), **Receipt** (last fill: bay, IG, KD, meter serial, QR, "Sent by SMS & e-mail" chips), and a **bay-assignment push notification** banner ("Proceed to Bay 14 — hatch guidance active"). Seed from a tiny copy of the ERP seed (mobile stays standalone on purpose). Add `?screen=receipt|orders|fleet` deep links and a link from the Billing view.
* **Offline / store-and-forward demo** (allowed `app.js` edit, keep it small): a topbar toggle "Simulate WAN loss" → `kpis.wanLinkA/B = "down"`, banner "Al Dhaher LCC offline — bays continue on last-known balance · 37 txns buffered", ledger rows marked *Buffered*; toggle off → "Replayed 37 txns · DR RPO 0 s". Reuse `updateArchLiveBadges`.
* **Reports**: real CSV download (`Blob`) for the active period; "Schedule report" opens a small modal (cron-like picker, e-mail list) that adds to a "Scheduled" list.
* **Bay Control wording**: rename buttons to *Authorize fill* / *Release & close* and add the read-only note (§2.3 item 5).
* **Water-loss card** on the dashboard (P2 if time): inlet totaliser today vs Σ dispensed, NRW % with a 7-day sparkline.
* README: document modules, `SIAP` API, assets & licences (point to `docs/ASSETS.md`).

### WP-E (not coded — slides/prompts): AI renders
See `docs/IMAGE_PROMPTS.md`. Generated images go to `assets/images/twin/` (used by the WP-A fallback/hero and by the pitch deck).

---

## 5. Sequencing & timeline (demo Tue 15 Sep)

| When | Who | What |
|---|---|---|
| Fri 11 | done | audit, scaffold (`SIAP` registry), assets + Three.js vendored, docs |
| Fri 11 – Sat 12 | WP-A / WP-B / WP-C in parallel (separate files) | first working versions, each verified in the browser with no console errors |
| Sat 12 | WP-D | mobile + offline + CSV + wording |
| Sun 13 | integration pass | run the Order-to-Cash scenario with the 3D twin and HMI open; fix cross-module glitches; performance check on the presenter laptop |
| Mon 14 | rehearsal | demo script (below), screenshots for slides, `run_demo.bat` test on a clean machine, bump `?v=` cache-busters |
| Tue 15 | demo | |

**Demo script (10 min):** Command Dashboard → click Bay 14 → Bay Control → *3D Digital Twin* (overview, auto-tour, fly to Bay 14, labels live) → *Tanker Loading HMI* (same bay, classic toggle) → Enterprise & ERP → *Order-to-Cash Tracker* "Run scenario" (watch LPR log, twin truck arrival, fill, debit, receipt on phone via `mobile.html?screen=receipt`, GL posting) → Billing → Reports (export CSV) → S!a ("which trucks have calibration expiring?") → ERP Integration → close on the architecture diagram.

---

## 6. Risks & mitigations
* **WebGL on the presenter laptop** → fallback 2.5D render tab; test on the actual machine Monday; cap pixel ratio; no post-processing.
* **Asset look** (low-poly vs. the photoreal GPT render) → consistent material palette (white tankers, sand ground, cyan process lines, dark HUD) makes low-poly read as "clean digital twin"; the photoreal renders are used for hero/slides.
* **Module collisions** → disjoint files; only WP-D edits `app.js`; WP-B may edit the ERP card body in `index.html` only.
* **Data drift between screens** → single source of truth `SIAP.state`; mutate bays only via `startFill/stopFill`.
* **Scope creep** → P2 items are listed for the roadmap slide, not built.

---

## 7. Definition of done (per WP)
1. No console errors/warnings on load, on navigation into and out of the view, and after 3 minutes idle.
2. Works from `run_demo.bat` (python http.server) **and** from `file://` where possible (ES modules need http — the batch file already handles that; note it in README).
3. Screens use only `styles.css` tokens; text sizes ≥ 10.5 px; keyboard-operable controls; Lucide icons render.
4. Screenshot of each new screen saved to `docs/screens/<view>.png` (1560×980).
5. README updated for anything a presenter must know.

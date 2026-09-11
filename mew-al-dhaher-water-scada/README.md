# S!aP — MEW Al Dhaher Water Filling Station (Demo)

A standalone, static demo of the S!aP centralized platform screens described in
the *Pre-Paid Automatic Control Filling System for Water Filling Stations*
technical offer (MEW / Al Dhaher Lorry Filling Station, Kuwait). Built for the
Monday client walkthrough — no backend, no build step, works fully offline.

## Run it

Just open `index.html` in a browser, or serve the folder statically:

```
cd mew-al-dhaher-water-scada
python3 -m http.server 8080
# open http://localhost:8080
```

All data (bay statuses, flow rates, transactions, alarms, camera feeds) is
simulated client-side in `data.js` / `app.js` and updates on a ~2s loop to
feel live. Chart.js and Lucide icons are vendored locally in `vendor/` so the
demo has zero external dependencies — safe to run on venue wifi or fully
offline.

## Screens (mirrors offer §6)

1. **Command Dashboard** — 42-bay live status grid, station inlet flow gauge,
   KPIs, hourly volume/revenue chart, active alarms.
2. **Filling Bay Control** — per-bay transaction sequence (LPR detect → QR/PIN
   → validate → fill → debit/receipt), live gauge, valve/meter telemetry.
3. **CCTV & LPR Wall** — simulated camera grid with detection overlays, gate
   LPR log, video analytics event feed.
4. **Billing & MEW Pay** — prepaid transaction ledger, K-net settlement
   status, MEW Pay customer wallet app mock.
5. **Reports** — shift / day / month production & revenue tables + chart,
   export/schedule actions (UI only).
6. **S!a — Ask & Act** — a light natural-language query panel with a handful
   of scripted demo answers (kept intentionally minimal per guidance to focus
   the demo on operational/SCADA workflows over AI). Also available as a
   floating assistant button (bottom-right) on every screen, not just its own
   page.
7. **Digital Twin** — a single bay's complete instrumented flow as one live
   animated schematic (tanker → LPR/auth → inlet valve → custody flowmeter →
   pressure/temperature transmitters → fine-fill valve → tanker fill →
   debit/receipt), in the same 2D P&ID style as the Station Process Mimic.
   Open it from the sidebar or via "View Digital Twin" on the Filling Bay
   Control screen.
8. **ERP Integration** — a small illustrative card on the Command Dashboard
   showing S!aP ⇄ ERP data flow and a mocked sync log. Not a real
   integration — proof of integration-readiness only.

## Two entry points, one demo

- `index.html` — the main operator/control-room dashboard (desktop).
- `mobile.html` — the MEW Pay customer companion, phone-shaped and
  interactive (wallet, top-up, QR pay, stations, history). Reachable from
  the Billing screen's "Open on phone" link, or open directly on an actual
  phone during a demo. It's a standalone page with its own tiny state in
  `mobile.js` — not wired to `data.js`, by design, so it works even if
  opened on a separate device with no shared backend (mirrors the pattern
  used for the DSO project's `/responder` page: a responsive web view, not
  a native app).

## Notes for whoever picks this up next

- This is a **front-end only demo**, not connected to real RTUs/PLCs/K-net —
  every number is simulated to be visually convincing, not accurate.
- Structure/copy follows the offer PDF's section 6 headings and screenshots
  closely so it reads as "the same product" in the room.
- To extend: bay/KPI/report data lives in `data.js`; all rendering + the
  simulation loop is in `app.js`; visual styling/tokens are in `styles.css`.
- The CCTV wall (`assets/images/cctv/`) uses real Unsplash stock photos
  (licensed for free commercial use) as camera backgrounds instead of a
  canvas simulation, with a CSS "surveillance" treatment (scanlines,
  vignette, desaturation) plus an animated detection box overlay. Swap those
  files for real Al Dhaher site photos when available — same filenames.
- Charts (Chart.js) use scriptable gradient fills tied to the theme tokens
  in `styles.css`; if you change `--accent`/`--green`, update the gradient
  colors in `app.js` (`renderHourlyChart`, `renderGauge`, `renderReportChart`)
  to match.

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
   the demo on operational/SCADA workflows over AI).

## Notes for whoever picks this up next

- This is a **front-end only demo**, not connected to real RTUs/PLCs/K-net —
  every number is simulated to be visually convincing, not accurate.
- Structure/copy follows the offer PDF's section 6 headings and screenshots
  closely so it reads as "the same product" in the room.
- To extend: bay/KPI/report data lives in `data.js`; all rendering + the
  simulation loop is in `app.js`; visual styling/tokens are in `styles.css`.

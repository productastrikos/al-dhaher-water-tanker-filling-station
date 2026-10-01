# MEW Al Dhaher Water Tanker Filling Station - S!aP demo

Client demo for MEW Kuwait: SCADA command dashboard, 3D digital twin, PCS 7-style tanker-loading HMI, Kuwait network map,
full ERP order-to-cash, and a MEW Pay driver mobile app. **All data is simulated in the browser - there is no backend.**

Stack: Vite + React 19 + TypeScript, zustand, Three.js, chart.js, lucide-react.

```bash
npm install
npm run dev        # http://localhost:3251   (desktop console)  and  /mobile  (driver app)
npm run build      # tsc -b && vite build -> dist/
```

Deep-link a screen: `/?view=dashboard | baycontrol | cctv | hmi | network-map | twin3d | billing | reports | sia | erp-o2c | erp-orders | erp-customers | erp-fleet | erp-cards | erp-integration | erp-admin`.

## What is mocked vs real

| Area | Status |
|------|--------|
| Bay telemetry, KPIs, alarms, ledger, LPR/video events | Simulated (`src/sim/`), ticks every 2.2 s |
| ERP (orders, customers, fleet, cards, integration, audit) | Simulated in-memory (`src/erp/`) |
| ERP integrations (SAP / Oracle / Dynamics), K-net, MEW Pay | Mock panels only |
| S!a assistant | Canned answers |
| 3D twin | Real Three.js scene; layout from `src/views/twin3d/` + GLBs in `public/assets/models` |

## Layout

```
src/main.tsx          router: /mobile -> driver app, everything else -> desktop console
src/shell/            sidebar, topbar, alarm toast, keep-alive view host
src/views/            one folder per screen; registry.ts is the sidebar/screens table
src/sim/              simulated data + zustand store (bays, KPIs, alarms, ledger) ticking every 2.2 s
src/erp/              ERP data model + store + Order-to-Cash scenario engine
src/i18n/, src/lib/   EN/AR dictionary, theme, icons
src/styles/           the S!aP stylesheets
public/assets/        3D models (GLB), images, HDRI
```

See [DEPLOY.md](DEPLOY.md) for the server deployment (port 3251, `aldhaher-water.astrikos.xyz`). The previous plain-HTML version is in git history (commit `d4af0d5`).

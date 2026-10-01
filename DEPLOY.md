# Deployment - MEW Al Dhaher Water SCADA (astrikos.xyz)

Follows `deployment_context.md`. Stack: **Vite + React 19 + TypeScript**. This POC is a **front end only** - no backend, no API,
no websocket, no database. All data is simulated in the browser, so it needs ONE port and ONE nginx block and no `.env.production`
(there are no cross-service URLs in the source).

## Process table

| Item | Value |
|------|-------|
| POC name | `aldhaher-water` |
| Frontend port | `3251` (assigned) |
| Backend port | none (no process, no nginx block, no `-api` subdomain) |
| Frontend subdomain | `aldhaher-water.astrikos.xyz` (Cloudflare **Orange**) |
| pm2 frontend name | `aldhaher-water_3251` |
| Build output | `dist/` (static SPA) |

Registry row to append: `aldhaher-water | 3251 | - | live`

## Build + run (on the server, from the repo root)

```bash
npm install && npm run build        # tsc -b && vite build  -> dist/
pm2 start serve --name "aldhaher-water_3251" -- ./dist -s -p 3251
pm2 save
```

Requires `serve` installed globally (`npm i -g serve`), as for the other POCs. `-s` gives the SPA fallback that the
`/mobile` route needs. Node 20+ recommended.

Routes: `/` (desktop SCADA / 3D twin / ERP console, deep-link a screen with `/?view=<id>`) and `/mobile` (MEW Pay driver app).

Local dev: `npm run dev` (also port 3251, `strictPort`).

## nginx - `/etc/nginx/conf/astrikos.conf`

```nginx
server {
    listen 8443 ssl;
    ssl_certificate     /etc/certs/astrikos.xyz/fullchain.pem;
    ssl_certificate_key /etc/certs/astrikos.xyz/privkey.pem;
    server_name aldhaher-water.astrikos.xyz;
    location / {
        add_header 'Access-Control-Allow-Origin' '*' always;
        proxy_pass http://127.0.0.1:3251;
    }
}
```

Apply: `sudo nginx -t && sudo systemctl reload nginx`

## Cloudflare DNS

- `aldhaher-water.astrikos.xyz` -> **Orange** (proxied)
- No `-api` record is needed.

## Verify

```bash
curl -k https://aldhaher-water.astrikos.xyz:8443               # SPA HTML (<div id="root">)
curl -kI https://aldhaher-water.astrikos.xyz:8443/mobile       # 200 (SPA fallback)
curl -kI https://aldhaher-water.astrikos.xyz:8443/assets/models/canopy.glb   # 200
```

## Notes

- `assets/` (3D models, textures) is ~124 MB, copied from `public/assets` into `dist/assets`; the first load is heavy on a slow link.
- The previous plain-HTML version is in git history (commit `d4af0d5`); it is no longer in the tree.
- If a backend is added later: ask for a backend port (`43NN`), put `VITE_API_URL` / `VITE_SOCKET_URL` in `.env.production`, and add an
  `aldhaher-water-api.astrikos.xyz` block to `astriverse.conf` per the guideline.

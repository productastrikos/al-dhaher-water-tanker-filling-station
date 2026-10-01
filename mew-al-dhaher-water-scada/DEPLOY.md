# Deployment - MEW Al Dhaher Water SCADA (astrikos.xyz)

Follows `deployment_context.md`. This POC is a **static front end only** - no backend, no API, no websocket,
no database - so it uses ONE port and ONE nginx block. Everything is simulated in the browser.

## Process table

| Item | Value |
|------|-------|
| POC name | `aldhaher-water` |
| Frontend port | `3251` (assigned) |
| Backend port | none (no process, no nginx block, no `-api` subdomain) |
| Frontend subdomain | `aldhaher-water.astrikos.xyz` (Cloudflare **Orange**) |
| pm2 frontend name | `aldhaher-water_3251` |
| Env files | none needed - no cross-service URLs exist in the source (no host/IP/port literals) |

Registry row to append: `aldhaher-water | 3251 | - | live`

## Build + run (on the server)

```bash
cd mew-al-dhaher-water-scada
npm install && npm run build        # -> dist/ (only runtime files; docs/reference/tools are NOT copied)
pm2 start serve --name "aldhaher-water_3251" -- ./dist -s -p 3251
pm2 save
```

`npm run build` is `node scripts/build.mjs` (no dependencies). It copies the app into `dist/` and leaves out
`docs/`, `reference/` (client PDFs/PPTX), `tools/`, `*.md`, `*.bat`, `*.py`.
Requires `serve` installed globally (`npm i -g serve`), as for the other POCs.

Pages: `/` (desktop SCADA / 3D twin / ERP) and `/mobile.html` (driver app).

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
curl -k https://aldhaher-water.astrikos.xyz:8443              # SPA HTML
curl -kI https://aldhaher-water.astrikos.xyz:8443/mobile.html # 200
curl -kI https://aldhaher-water.astrikos.xyz:8443/docs/       # should NOT be a real docs page (not in dist)
```

## Notes

- `.htaccess` is for the earlier Hostinger/LiteSpeed deployment and is not used on this server.
- `assets/` is ~124 MB (3D models, textures); the first load on a slow link is heavy.
- If a backend is added later, ask for a backend port, add `VITE_API_URL` / `VITE_SOCKET_URL` to
  `.env.production`, and add an `aldhaher-water-api.astrikos.xyz` block to `astriverse.conf` per the guideline.

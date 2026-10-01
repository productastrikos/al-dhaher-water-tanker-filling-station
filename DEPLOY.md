# Deployment — MEW Al Dhaher Water SCADA (astrikos.xyz)

Follows `deployment_context.md`. Deployed as a **project**: `npm install && npm run build`
produces `dist/`, and pm2 serves `dist/` — not the repo directory. No batch file, no
`.htaccess`, no manual file copying is part of the deploy path.

This POC is a **static front end only** — no backend, no API, no websocket, no database.
Everything is simulated in the browser (`localStorage` only). So it uses **one** port and
**one** nginx block: no backend process, no `-api` subdomain, no `astriverse.conf` block,
and no `.env.production` (there are no cross-service URLs to configure).

## Process table

| Item | Value |
|------|-------|
| POC name | `aldhaher-water` |
| Frontend port | `3251` |
| Backend port | none — no process, no nginx block, no `-api` subdomain |
| Frontend subdomain | `aldhaher-water.astrikos.xyz` (Cloudflare **Orange**) |
| pm2 frontend name | `aldhaher-water_3251` |
| Build output | `dist/` (from `npm run build`) |
| Static routing | `serve.json` (shipped into `dist/` by the build) |
| Env files | none — no host/IP/port literals exist in source (verified by grep) |

Registry row to append to `deployment_context.md` §6:

| POC | Frontend | Backend | Status |
| --- | --- | --- | --- |
| aldhaher-water | 3251 | — | live |

> **Port note.** `deployment_context.md` §1 defines the frontend band as odd `33XX`
> (§6's next free pair being `3311`/`4311`). **3251 is an out-of-band port assigned to
> this POC**, kept deliberately so existing DNS/nginx wiring is not broken. It is a known
> deviation from §1 — not a rule in the context file. Being backend-less, this POC
> consumes no `43XX` port, so no `43XX` number is reserved for it.

## Build + run (on the server)

```bash
npm install && npm run build
pm2 start serve --name "aldhaher-water_3251" -- ./dist -p 3251
pm2 save
```

`npm install` installs nothing (zero dependencies) — it only validates the lockfile.
`npm run build` runs `node scripts/build.mjs`, which copies the app into `dist/` and
leaves out `docs/`, `reference/` (client PDF/PPTX), `tools/`, `scripts/`, `package*.json`
and every `*.md` / `*.bat` / `*.ps1` / `*.py`. It fails loudly if `index.html` or
`mobile.html` is missing from the output.

Requires `serve` installed globally on the server (`npm i -g serve`), as for the other POCs.

Pages: `/` (desktop SCADA / 3D twin / ERP console) and `/mobile.html` (driver wallet app).

### Routing — why there is no `-s`, and why `serve.json` matters

This is a **multi-page** app with **no client-side router** (no `pushState` / `popstate` /
`hashchange` anywhere in the source), and `index.html` deep-links into the driver app five
times as `mobile.html?screen=topup|qr|stations|history|receipt`, which
[`mobile.js`](mobile.js) reads back via `new URLSearchParams(location.search).get("screen")`.
Two `serve` defaults break that, so both are switched off in `serve.json`:

| Problem | Cause | Effect if left on |
| --- | --- | --- |
| `-s` (SPA mode) | rewrites every unmatched path to `index.html` | `/mobile.html` serves the **desktop** document — driver app unreachable |
| `cleanUrls` (on by default) | 301s `/mobile.html` → `/mobile` and **drops the query string** | all five deep links land on the wallet's default screen, never the requested one |

`serve.json` (repo root, copied into `dist/` by the build):

```json
{
  "cleanUrls": false,
  "directoryListing": false,
  "rewrites": [
    { "source": "/", "destination": "/index.html" }
  ]
}
```

`serve` reads it automatically from the directory it serves. `directoryListing: false` plus
the explicit `/` rewrite are both required: with `cleanUrls` off, `/` would otherwise render
a **file listing of `dist/`** instead of the console. Do not add `-s` back, and do not drop
`serve.json` — each alone reintroduces one of the two failures above.

## nginx — `/etc/nginx/conf/astrikos.conf`

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

No `astriverse.conf` block — there is no backend to route to.

Apply: `sudo nginx -t && sudo systemctl reload nginx`

## Cloudflare DNS

- `aldhaher-water.astrikos.xyz` → **Orange** (proxied)
- No `-api` record is needed.

## Verify

All of the following were run green against `serve ./dist -p 3251` locally before this file
was committed.

```bash
H=https://aldhaher-water.astrikos.xyz:8443

# 1. desktop console at / (must be the console, NOT a listing of dist/)
curl -k  $H/           | grep -o '<title>[^<]*</title>'
#   expect: <title>S!aP — MEW Al Dhaher Water Filling Station</title>
#   "Files within dist" here => serve.json's `/` rewrite is missing

# 2. driver app reachable and NOT shadowed by index.html
curl -k  $H/mobile.html | grep -o '<title>[^<]*</title>'
#   expect: <title>MEW Pay — Water Wallet</title>
#   desktop title here => `-s` is still on the pm2 command

# 3. the five deep links keep their ?screen= param (no 301 stripping it)
for s in topup qr stations history receipt; do
  printf '%-9s %s\n' "$s" "$(curl -ks -o /dev/null -w '%{http_code} %{redirect_url}' "$H/mobile.html?screen=$s")"
done
#   expect: 200 with an EMPTY redirect_url for all five
#   "301 .../mobile" => cleanUrls is still on

# 4. assets served
curl -kI $H/app.js                              # 200
curl -kI $H/vendor/three/build/three.module.js  # 200
curl -kI $H/assets/models/manifest.json         # 200

# 5. internal material absent from dist/
for p in docs/ reference/ tools/ scripts/ package.json run_demo.bat README.md DEPLOY.md; do
  printf '%-16s %s\n' "$p" "$(curl -ks -o /dev/null -w '%{http_code}' "$H/$p")"
done
#   expect: 404 for every one
```

## Notes

- `.htaccess` is left over from the earlier Hostinger/LiteSpeed deployment and is not used
  on this server (the build excludes dotfiles from `dist/`).
- `run_demo.bat` and `.claude/launch.json` are local dev conveniences only. They are not
  part of the deploy path and the build excludes them from `dist/`.
- `dist/` is ~128 MB, almost all of it `assets/` (3D models, HDRI, textures). First load on
  a slow link is heavy; the 3D twin is the bulk of it.
- If a backend is ever added, ask for a `43XX` port, add `VITE_API_URL` / `VITE_SOCKET_URL`
  to `.env.production`, add an `aldhaher-water-api.astrikos.xyz` block to `astriverse.conf`
  with the websocket-upgrade headers (§7), and set that record to **Gray** (DNS-only).

# My Field Atlas

A geological field notebook: projects containing multiple KMZ/KML files, GPS routes, located photographs, and waypoints. Upload intact KMZ archives directly in the website; no manual unpacking is required.

The website runs on **GitHub Pages**. A small **Cloudflare Worker** handles uploads and access; **R2** stores original files, display photos, and map data; **D1** stores projects, authors, file metadata, and sessions.

## Finish publishing

Follow **[DEPLOYMENT.md](docs/DEPLOYMENT.md)**. The Cloudflare account, bucket, and database must be connected before the independent website can accept uploads. Source code alone does not configure the cloud account.

The website's intended address is `https://altarcag.github.io/my-field-atlas/`. This is the deployment target, not a claim that setup is already complete.

## Features

- Projects such as URG-2026 contain any number of independently named files, uploaded one at a time.
- Project checkboxes show/hide all children; file checkboxes control individual days.
- Author labels, dates, notes, and route colors are recorded per file.
- Photo waypoints display square thumbnails. Click to enlarge and browse. Ordinary waypoints display pins.
- OpenStreetMap, satellite imagery, and 3D terrain views.
- Original uploads remain downloadable. Display photos are resized to JPEG (up to 2,000 pixels); originals remain in the KMZ.
- Shared upload password and a separate owner password, both configured outside the website. Owner access permits deletion; shared uploaders can add projects/files and edit file details.
- The Library navigation entry remains reserved for a later release.

## Development

Use Node 24 and the pnpm version pinned in package.json.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
pnpm db:local
pnpm dev:api
```

In another terminal run `pnpm dev`. Open the address Vite prints, ending with `/my-field-atlas/`. Leave `VITE_API_BASE_URL` unset locally to use the development proxy. If `.env` sets it to a hosted backend, local requests go there instead.

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm api:check
```

The last command checks Worker bundling without publishing. `wrangler.local.jsonc` is for local development only. `wrangler.jsonc` describes production; `scripts/deploy-api.mjs` fills in your database ID, applies new migrations, and deploys. Existing migrations must not be rewritten.

## How uploads work

The browser parses KML and extracts referenced pictures from KMZ. It sends the original in 5 MiB parts, normalized photos, and validated route/point data to the API. A file only becomes visible after completion. The website fetches current projects/files from the API, so uploads do not require Git commits or a Pages rebuild.

Login uses an eight-hour bearer session stored in the current tab's session storage. Only an HMAC of each random token is stored in D1. Cross-site cookies are not required. Passwords are never included in the frontend build. Every mutation checks the session and allowed Origin; login attempts are rate-limited. Changing a password invalidates sessions created with that password. Author labels are self-reported, not verified identities.

The independent website is intended for public map viewing. Ready files and photos can be read through the API without an upload password. R2 itself can remain private. Do not treat the upload password as a privacy password for field data.

## Import support and limits

Supports KML LineString/MultiGeometry, gx:Track/gx:MultiTrack, Point waypoints, PhotoOverlay points, HTML image references, and AlpineQuest photo ExtendedData. Photos need waypoint coordinates and matching archive paths; unreferenced JPEG EXIF is not used to invent associations. JPEG, PNG, and WebP inputs are supported. Standalone KML cannot bundle local pictures; use KMZ to keep those together. External HTTPS image references remain dependent on their source websites.

Limits: 512 MiB per KMZ, 12 MiB standalone KML, 768 MiB expanded archive, 40 MiB per archive entry, 4,000 entries, 1,000 embedded photos, 2,000 waypoints, and 200,000 route coordinates. Encrypted/ZIP64 archives and unsafe paths are rejected. Only the main KML document is imported when an archive contains several; import notes disclose this. Keep the tab open during uploads; cross-page upload resume is not implemented.

## Maps and attribution

Rendering: [MapLibre GL JS](https://maplibre.org/). Standard map: [OpenStreetMap](https://www.openstreetmap.org/copyright). Satellite imagery: Esri World Imagery (third-party imagery, not open-source imagery). Terrain: [Mapterhorn](https://mapterhorn.com/attribution), with 1.2× vertical exaggeration. Provider attribution remains visible. Internet access is needed; no bulk/offline map downloader is included.

The MapLibre worker and shared module are copied from the installed package into a versioned path during the build, including its license. This avoids runtime worker 404s and supports the GitHub Pages repository subdirectory.

## Existing data and backups

This repository contains no field photographs or existing cloud data. The earlier hosted prototype and its uploaded files remain separate. Re-upload original KMZs into the new website, or arrange a deliberate transfer of its database and R2 objects. Preserve IDs and `trips/{id}/...` paths for a full transfer, and configure new passwords rather than transferring old login sessions.

Keep independent copies of original field files and periodically export D1 and copy R2 to a separate location. GitHub stores the code, not backups of user uploads.

## Verification

Importer and project checks cover photos-only KMZ, KML, nested/Unicode image paths, route segments, malformed archives, grouping, authors, and partial visibility. API integration checks run actual route handlers with SQLite and a storage test double, applying migrations over a v1 record. They check upload/finalization, owner versus contributor access, session revocation, secret rotation, and cross-origin Worker requests. TypeScript, the static build, and Worker dry-run bundling are also checked. Live cloud acceptance testing follows account configuration.

# Network Dashboard

Public dashboard showing the state of the Moonlight network. Serves as the council discovery layer — councils register their contracts and jurisdictions, anyone can browse.

## What it does

- **Map view**: World map with councils plotted by declared jurisdiction, dot size reflects number of channels
- **Council list**: All registered councils with on-chain state (supply, provider count, channel assets)
- **Transaction feed**: Recent on-chain events across all channels (bundles, provider changes)
- **Council detail**: Drill into a council to see its channels, providers, and activity

## Development

```bash
# Install dependencies
deno install

# Build the app bundle
deno task build

# Start dev server (port 3030, watches for changes)
deno task dev

# Run tests
deno task test
```

## Testing

Unit tests cover DOM helpers, SVG sanitization, provider counting logic, URL validation, config, and routing.

```bash
deno task test
```

## Deployment

Static files are deployed to a public [Tigris](https://www.tigrisdata.com/) bucket on Fly.io.

- **Bucket**: `network-dashboard`
- **URL**: https://network-dashboard.fly.storage.tigris.dev/index.html
- **Auto-deploy**: bump `version` in `deno.json`, push to `main`
- **Secrets** (set in GitHub repo settings): `TIGRIS_ACCESS_KEY_ID`, `TIGRIS_SECRET_ACCESS_KEY`, `COUNCILS_JSON`

Pipeline:

1. Push to `main` triggers `auto-version.yml` (reads version from `deno.json`, creates git tag)
2. Tag push (`v*`) triggers `deploy.yml` (generates config from secrets, builds production bundle, deploys to Tigris)

### Manual deploy

```bash
deno task build -- --production
aws s3 sync public/ s3://network-dashboard/ \
  --endpoint-url https://fly.storage.tigris.dev \
  --acl public-read --delete
```

## Architecture

Static SPA (no backend, no auth). Reads on-chain state via Stellar RPC. World map data fetched from jsDelivr CDN (Natural Earth TopoJSON). Council registry is a hardcoded config for MVP (eventually an API).

```
Browser
  ├── Stellar RPC ── contract queries (supply, events)
  ├── jsDelivr CDN ── world map TopoJSON
  └── Config (config.js) ── council registry, RPC URLs
```

## GitHub Secrets

Required for CI deploys:

| Secret | Purpose |
|--------|---------|
| `TIGRIS_ACCESS_KEY_ID` | Tigris CDN upload |
| `TIGRIS_SECRET_ACCESS_KEY` | Tigris CDN upload |
| `COUNCILS_JSON` | Council registry (JSON array) |
| `AUTO_VERSION_TOKEN` | PAT for auto-tag workflow |

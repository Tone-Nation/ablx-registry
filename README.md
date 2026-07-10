# ablx-registry

The open registry behind **[ablx.live](https://ablx.live)** — a catalog of every public
Ableton Live Extension (`.ablx`). One JSON file per listing, submissions by pull request,
authors own their entries.

- **Browse**: https://ablx.live
- **Machine-readable**: https://ablx.live/api/registry.json (CORS-open; schema: `/api/schema.json`)
- **Submit or correct a listing**: see [SUBMITTING.md](SUBMITTING.md) — one small JSON file, one PR
- **Authors**: claim, correct, or remove your listing anytime via PR or issue; requests honored same-day

## Layout

- `registry/extensions/*.json` — the catalog (schema: `registry/schema.json`)
- `scripts/build.mjs` — zero-dependency static build: registry → `dist/` (site + API + sitemap)
- `src/`, `static/` — site styles, filter script, assets

## Develop

```sh
node scripts/build.mjs --check   # validate registry entries (runs in CI on every PR)
node scripts/build.mjs           # build the site to dist/
```

Merges to `main` deploy https://ablx.live automatically.

Maintained by the Patchwright project. Not affiliated with Ableton AG.

Preview a local build with `npx serve dist` after running the build.

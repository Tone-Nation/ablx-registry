# Submit an extension to ablx.live

Every listing is one JSON file in this repository. Submitting is a pull request — free,
no exclusivity, and we always link to *your* homepage and *your* download.

## How

1. Copy any file in `registry/extensions/` as a starting point.
2. Name it `<slug>.json` (kebab-case, matching the `slug` field).
3. Fill in the fields — `registry/schema.json` documents all of them. The important ones:
   - `homepageUrl` — your repo or product page (we always link out to you)
   - `downloadUrl` — where a user actually gets the `.ablx`
   - `description` — one or two plain factual sentences
   - `categories` — 1–3 of: `workflow`, `midi-tools`, `audio-tools`, `arrangement`,
     `organization`, `generative`, `fun`, `integration`, `utilities`
4. Run `node scripts/build.mjs --check` to validate (CI runs the same check on your PR).
5. Open the pull request. A maintainer verifies links resolve, the product is a real
   Extensions-SDK `.ablx`, and the description describes rather than sells — then merges.
   The site redeploys automatically.

## Ground rules

- Extensions-SDK `.ablx` products only — no Max for Live devices, control surface
  scripts, or action packs (great tools, different registry).
- Paid extensions are welcome — set `price` and link your own checkout.
- You own your listing: PR an update or removal anytime, and author requests are
  honored same-day, no questions asked.

## Claiming an existing listing

The catalog was seeded with publicly available extensions, linked to their authors' own
pages. If one is yours: open a PR or an issue to correct anything, change the
`downloadUrl`, or take it down.

#!/usr/bin/env node
/**
 * ablx.live static build. Zero dependencies, same idiom as ../site.
 *
 *   node scripts/build.mjs           build to dist/
 *   node scripts/build.mjs --check   validate registry only, no output
 *
 * Input:  registry/extensions/*.json  (one file per extension, see registry/schema.json)
 * Output: dist/ — fully rendered, crawlable HTML + /api/registry.json
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://ablx.live';
const CHECK_ONLY = process.argv.includes('--check');

/* ── categories ──────────────────────────────────────────────── */
const CATEGORIES = {
  workflow:     { label: 'Workflow',     color: 'var(--k-action)' },
  'midi-tools': { label: 'MIDI tools',   color: 'var(--k-music)' },
  'audio-tools':{ label: 'Audio tools',  color: 'var(--k-object)' },
  arrangement:  { label: 'Arrangement',  color: 'var(--k-set)' },
  organization: { label: 'Organization', color: 'var(--k-ui)' },
  generative:   { label: 'Generative',   color: 'var(--k-logic)' },
  fun:          { label: 'Fun',          color: 'var(--k-trigger)' },
  integration:  { label: 'Integration',  color: 'var(--k-music)' },
  utilities:    { label: 'Utilities',    color: 'var(--k-mute)' },
};

/* ── load + validate registry ────────────────────────────────── */
const REG_DIR = join(ROOT, 'registry', 'extensions');
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const errors = [];
const entries = readdirSync(REG_DIR).filter(f => f.endsWith('.json')).sort().map(file => {
  let e;
  try { e = JSON.parse(readFileSync(join(REG_DIR, file), 'utf8')); }
  catch (err) { errors.push(`${file}: invalid JSON — ${err.message}`); return null; }
  for (const k of ['name', 'slug', 'author', 'description', 'homepageUrl', 'categories']) {
    if (!e[k] || (Array.isArray(e[k]) && !e[k].length)) errors.push(`${file}: missing required field "${k}"`);
  }
  if (e.slug && !SLUG_RE.test(e.slug)) errors.push(`${file}: slug "${e.slug}" is not kebab-case`);
  if (e.slug && file !== `${e.slug}.json`) errors.push(`${file}: filename must match slug ("${e.slug}.json")`);
  if (e.description && (e.description.length < 10 || e.description.length > 400)) {
    errors.push(`${file}: description must be 10–400 chars (is ${e.description.length})`);
  }
  for (const c of e.categories ?? []) if (!CATEGORIES[c]) errors.push(`${file}: unknown category "${c}"`);
  for (const u of ['homepageUrl', 'downloadUrl', 'authorUrl']) {
    if (e[u] && !/^https?:\/\//.test(e[u])) errors.push(`${file}: ${u} must be an absolute http(s) URL`);
  }
  return e;
}).filter(Boolean);

const slugs = new Set();
for (const e of entries) {
  if (slugs.has(e.slug)) errors.push(`duplicate slug: ${e.slug}`);
  slugs.add(e.slug);
}
if (errors.length) {
  console.error(`registry invalid (${errors.length} problem${errors.length > 1 ? 's' : ''}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`registry ok: ${entries.length} extensions`);
if (CHECK_ONLY) process.exit(0);

entries.sort((a, b) => a.name.localeCompare(b.name));
const authors = new Set(entries.map(e => e.author));

/* ── html helpers ────────────────────────────────────────────── */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const catChip = c => `<span class="cat"><i class="led" style="--led:${CATEGORIES[c].color}"></i>${esc(CATEGORIES[c].label)}</span>`;

function page({ title, description, path, body, jsonLd, bodyClass = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="theme-color" content="#2b2b2b" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${ORIGIN}${path}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="ablx.live" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${ORIGIN}${path}" />
<meta property="og:image" content="${ORIGIN}/og.svg" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="stylesheet" href="/styles.css" />
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body class="${bodyClass}">
<header class="mast">
  <div class="rail wrap">
    <a class="plate" href="/"><span class="plate-txt">ablx.live</span></a>
    <nav aria-label="Site">
      <a href="/">Catalog</a>
      <a href="/guide/">Guide</a>
      <a href="/submit/">Submit</a>
    </nav>
  </div>
</header>
<main class="wrap">
${body}
</main>
<footer class="foot wrap">
  <p>An open registry of Ableton Live Extensions. Not affiliated with Ableton AG.
     Every listing links to its author's own page — <a href="/submit/">yours belongs here too</a>.</p>
  <p class="mono dim">maintained by the <a href="https://patchwright.live" rel="noopener">Patchwright</a> project ·
     <a href="/api/registry.json">registry.json</a> · <a href="/llms.txt">llms.txt</a></p>
</footer>
<script type="module" src="/catalog.js"></script>
</body>
</html>`;
}

/* ── cards + index ───────────────────────────────────────────── */
const card = e => `
<article class="module" data-name="${esc(e.name.toLowerCase())}" data-author="${esc(e.author.toLowerCase())}"
         data-text="${esc(`${e.name} ${e.author} ${e.description}`.toLowerCase())}" data-cats="${esc(e.categories.join(' '))}">
  <div class="module-rail"><span class="screw" aria-hidden="true"></span><span class="mono module-tag">${esc(e.categories[0])}</span><span class="screw" aria-hidden="true"></span></div>
  <h2><a href="/extensions/${e.slug}/">${esc(e.name)}</a></h2>
  <p class="byline">by ${esc(e.author)}</p>
  <p class="desc">${esc(e.description)}</p>
  <div class="module-foot">
    <span class="cats">${e.categories.map(catChip).join('')}</span>
    <span class="price mono">${esc(e.price || 'free')}</span>
  </div>
</article>`;

const indexBody = `
<section class="hero">
  <p class="eyebrow mono">the open .ablx registry</p>
  <h1>The patchbay for Ableton&nbsp;Live Extensions</h1>
  <p class="lede">Every public Extension in one rack — linked straight to its author.
     Right-click tools for Live 12 Suite (beta 12.4.5+), free to browse, open to submit.</p>
  <p class="counts mono"><b>${entries.length}</b> extensions · <b>${authors.size}</b> authors · updated ${new Date().toISOString().slice(0, 10)}</p>
</section>
<section class="toolbar" aria-label="Filter extensions">
  <input id="q" class="search" type="search" placeholder="Search the rack…" aria-label="Search extensions" autocomplete="off" />
  <div class="chips" role="group" aria-label="Filter by category">
    ${Object.entries(CATEGORIES).map(([k, v]) =>
      `<button class="chip" data-cat="${k}" aria-pressed="false"><i class="led" style="--led:${v.color}"></i>${esc(v.label)}</button>`).join('\n    ')}
  </div>
</section>
<p class="mono dim result-count" id="count" aria-live="polite">${entries.length} shown</p>
<section class="rack" id="rack">
${entries.map(card).join('\n')}
<a class="module module-cta" href="/submit/">
  <div class="module-rail"><span class="screw" aria-hidden="true"></span><span class="mono module-tag">open slot</span><span class="screw" aria-hidden="true"></span></div>
  <h2>Yours belongs here</h2>
  <p class="desc">Built an extension? Add it to the registry with one pull request. Free, and we link to your page.</p>
  <span class="btn">Submit an extension</span>
</a>
</section>
<p class="empty mono" id="empty" hidden>Nothing matches — clear the search or filters.</p>`;

/* ── detail pages ────────────────────────────────────────────── */
const detailBody = e => `
<nav class="crumb mono" aria-label="Breadcrumb"><a href="/">catalog</a> / ${esc(e.slug)}</nav>
<article class="face">
  <div class="module-rail"><span class="screw" aria-hidden="true"></span><span class="mono module-tag">${esc(e.categories[0])}</span><span class="screw" aria-hidden="true"></span></div>
  <h1>${esc(e.name)}</h1>
  <p class="byline">by ${e.authorUrl ? `<a href="${esc(e.authorUrl)}" rel="noopener">${esc(e.author)}</a>` : esc(e.author)}</p>
  <p class="desc">${esc(e.description)}</p>
  <div class="face-actions">
    ${e.downloadUrl ? `<a class="btn" href="${esc(e.downloadUrl)}" rel="noopener">Download .ablx ↗</a>` : ''}
    <a class="btn btn-quiet" href="${esc(e.homepageUrl)}" rel="noopener">Author's page ↗</a>
  </div>
  <dl class="meta mono">
    <dt>categories</dt><dd>${e.categories.map(catChip).join('')}</dd>
    <dt>price</dt><dd>${esc(e.price || 'free')}</dd>
    ${e.license ? `<dt>license</dt><dd>${esc(e.license)}</dd>` : ''}
    ${e.lastUpdated ? `<dt>updated</dt><dd>${esc(e.lastUpdated)}</dd>` : ''}
    <dt>listing</dt><dd>${e.confidence === 'verified' ? 'download link verified' : 'community-listed'} · <a href="/submit/">correct or claim</a></dd>
  </dl>
</article>
<section class="install">
  <h2>Install in Live</h2>
  <ol>
    <li>Download the <code>.ablx</code> file from the author's page above.</li>
    <li>In Live, open <b>Settings → Extensions</b> (requires Live 12 Suite, beta 12.4.5+).</li>
    <li>Drag the <code>.ablx</code> file into the Extensions panel.</li>
    <li>Right-click the relevant item in your Set — the extension appears in the context menu.</li>
  </ol>
  <p class="dim">Extensions run once per trigger and edit your Set's structure. Only install from authors you trust —
     <a href="/guide/">more in the guide</a>.</p>
</section>`;

const detailJsonLd = e => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: e.name, description: e.description, url: `${ORIGIN}/extensions/${e.slug}/`,
  applicationCategory: 'MultimediaApplication', operatingSystem: 'macOS, Windows (Ableton Live 12 Suite)',
  author: { '@type': 'Person', name: e.author, ...(e.authorUrl ? { url: e.authorUrl } : {}) },
  ...(e.price === 'free' || !e.price ? { offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } : {}),
});

/* ── guide + submit pages ────────────────────────────────────── */
const guideBody = `
<article class="prose">
<h1>Guide</h1>
<h2>For Live users</h2>
<p>Ableton Live Extensions are small right-click tools for Live 12 <b>Suite</b> (public beta 12.4.5 or later).
They run once when triggered from a context menu and can read and edit your Set's structure — tracks, clips,
MIDI, devices, tempo — but never process audio in real time (that's Max for Live's job).</p>
<ol>
  <li>Get the Live 12 Suite public beta via Ableton's beta program (Centercode).</li>
  <li>Find an extension in the <a href="/">catalog</a> and download its <code>.ablx</code> from the author.</li>
  <li>In Live: <b>Settings → Extensions</b>, drag the file in.</li>
  <li>Right-click a clip, track, or the Set — the new command is in the menu.</li>
</ol>
<p><b>Safety:</b> an extension is a program. ablx.live links only to authors' own pages, marks listings whose
download location we've checked, and honors author corrections — but always use your judgment, exactly as
Ableton's own FAQ advises.</p>
<h2>For developers</h2>
<p>Extensions are TypeScript/JavaScript on Node, built with Ableton's
<a href="https://ableton.github.io/extensions-sdk/" rel="noopener">Extensions SDK</a> and bundled to a
distributable <code>.ablx</code>. Two ways to build one:</p>
<ul>
  <li><b>Code:</b> the SDK directly — docs at the link above.</li>
  <li><b>No code:</b> <a href="https://patchwright.live" rel="noopener"><b>Patchwright</b></a> — a visual
  node-graph builder that exports a working <code>.ablx</code> from the browser
  (in private beta; public release soon).</li>
</ul>
<p>To list your extension here, add one JSON file to
<a href="https://github.com/Tone-Nation/ablx-registry" rel="noopener">the open registry</a> via pull request —
see <a href="/submit/">Submit</a>. Free, no exclusivity, we link to your page and your checkout.</p>
<h2>For AI agents</h2>
<p>Machine-readable entry points: <a href="/llms.txt">/llms.txt</a> (site overview) and
<a href="/api/registry.json">/api/registry.json</a> (the full catalog, CORS-enabled, stable field names
documented in the registry schema).</p>
</article>`;

const submitBody = `
<article class="prose">
<h1>Submit an extension</h1>
<p>Every listing is one JSON file in an open registry. Submitting is a pull request; a maintainer checks that
links resolve, the product is a real Extensions-SDK <code>.ablx</code>, and the description describes rather
than sells — then merges. The site redeploys automatically.</p>
<ol>
  <li>Open the registry on GitHub: <a href="https://github.com/Tone-Nation/ablx-registry" rel="noopener">Tone-Nation/ablx-registry</a>.</li>
  <li>Copy an existing entry in <code>registry/extensions/</code>, rename it to <code>&lt;your-slug&gt;.json</code>.</li>
  <li>Fill in the fields (<a href="/api/schema.json">schema</a> documents them all) and open a pull request.</li>
</ol>
<p>The full catalog is also machine-readable at <a href="/api/registry.json">/api/registry.json</a>.</p>
<p>Paid extensions are welcome — set <code>price</code> and link your own checkout. You own your listing:
updates and removals are honored anytime, no questions asked.</p>
<h2>Already listed?</h2>
<p>We seeded the catalog with publicly available extensions, each linked to its author's own page. If one is
yours: claim, correct, or remove it with a PR or an
<a href="https://github.com/Tone-Nation/ablx-registry/issues" rel="noopener">issue</a> — author requests are
honored same-day, no questions asked.</p>
</article>`;

/* ── llms.txt ────────────────────────────────────────────────── */
const llms = `# ablx.live

> The open catalog of Ableton Live Extensions (.ablx) — right-click tools for Live 12 Suite
> (public beta 12.4.5+), built on Ableton's Extensions SDK. Every listing links to the author's
> own page. Maintained by the Patchwright project.

## Source & submissions

- Open registry (one JSON file per listing, submissions by PR): https://github.com/Tone-Nation/ablx-registry

## Machine-readable catalog

- Full registry (JSON, CORS-enabled): ${ORIGIN}/api/registry.json
- Fields per entry: name, slug, author, authorUrl, homepageUrl, downloadUrl, description,
  categories, license, price, lastUpdated, confidence, builtWithPatchwright.

## Key pages

- Catalog: ${ORIGIN}/
- Per-extension: ${ORIGIN}/extensions/<slug>/
- Install + developer guide: ${ORIGIN}/guide/
- Submit a listing (PR-based, free): ${ORIGIN}/submit/

## Install steps (for assisting a user)

1. Live 12 Suite public beta 12.4.5+ required. 2. Download the .ablx from the author's page.
3. Live Settings → Extensions → drag the file in. 4. Trigger from the right-click context menu.

## Building an extension

- Ableton Extensions SDK (TypeScript/Node): https://ableton.github.io/extensions-sdk/
- No-code builder (node graph or plain-language description → .ablx): Patchwright (in private beta) — https://patchwright.live
`;

/* ── write dist ──────────────────────────────────────────────── */
const DIST = join(ROOT, 'dist');
rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'api'), { recursive: true });

const out = (p, content) => { mkdirSync(dirname(join(DIST, p)), { recursive: true }); writeFileSync(join(DIST, p), content); };

out('index.html', page({
  title: 'ablx.live — the open catalog of Ableton Live Extensions',
  description: `Browse ${entries.length} Ableton Live Extensions (.ablx) from ${authors.size} authors. Right-click tools for Live 12 Suite — every listing links to its author. Free, open registry.`,
  path: '/', body: indexBody, bodyClass: 'is-catalog',
  jsonLd: {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: 'Ableton Live Extensions catalog', numberOfItems: entries.length,
    itemListElement: entries.map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: `${ORIGIN}/extensions/${e.slug}/`, name: e.name })),
  },
}));

for (const e of entries) {
  out(`extensions/${e.slug}/index.html`, page({
    title: `${e.name} — Ableton Live Extension by ${e.author} | ablx.live`,
    description: e.description, path: `/extensions/${e.slug}/`, body: detailBody(e), jsonLd: detailJsonLd(e),
  }));
}

out('guide/index.html', page({
  title: 'Guide — installing and building Ableton Live Extensions | ablx.live',
  description: 'How to install .ablx extensions in Ableton Live 12 Suite, how to build one (SDK or no-code with Patchwright), and machine-readable entry points for AI agents.',
  path: '/guide/', body: guideBody,
}));
out('submit/index.html', page({
  title: 'Submit an extension | ablx.live',
  description: 'List your Ableton Live Extension on ablx.live with one pull request. Free, open registry — we link to your page and your checkout.',
  path: '/submit/', body: submitBody,
}));

out('api/registry.json', JSON.stringify({
  $schema: `${ORIGIN}/api/schema.json`,
  generatedAt: new Date().toISOString(),
  count: entries.length,
  extensions: entries,
}, null, 2));
out('api/schema.json', readFileSync(join(ROOT, 'registry', 'schema.json'), 'utf8'));
out('llms.txt', llms);

const pages = ['/', '/guide/', '/submit/', ...entries.map(e => `/extensions/${e.slug}/`)];
out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url><loc>${ORIGIN}${p}</loc></url>`).join('\n')}
</urlset>
`);

cpSync(join(ROOT, 'src', 'styles.css'), join(DIST, 'styles.css'));
cpSync(join(ROOT, 'src', 'catalog.js'), join(DIST, 'catalog.js'));
cpSync(join(ROOT, 'static'), DIST, { recursive: true });

console.log(`built ${pages.length + 3} files → dist/ (${entries.length} extensions, ${authors.size} authors)`);

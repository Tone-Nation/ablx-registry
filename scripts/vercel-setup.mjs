#!/usr/bin/env node
/**
 * One-shot Vercel setup for ablx.live. Idempotent — safe to re-run.
 *
 *   VERCEL_TOKEN=<token> node store/scripts/vercel-setup.mjs
 *
 * Does, in order:
 *   1. Creates the "ablx-live" project in the Tone Nation team (root directory
 *      store/, linked to the Tone-Nation/Patchwright GitHub repo) if missing.
 *   2. Attaches ablx.live and www.ablx.live (www → apex redirect), plus
 *      ablx.store (+ www) as permanent redirects to ablx.live.
 *   3. Triggers a production deployment from the current git branch.
 *   4. Prints the DNS records Vercel expects, with live verification status.
 *
 * Needs: Node 18+ (global fetch). No packages.
 */
const TOKEN = process.env.VERCEL_TOKEN;
const TEAM = 'team_YXS0tcJQntlSp7c7ayjVcDNb'; // Tone Nation
const PROJECT = 'ablx-live';
const REPO = 'Tone-Nation/Patchwright';
const APEX = 'ablx.live';
const BRANCH = process.env.DEPLOY_REF || 'claude/music-launcher-research-azlt4c';

if (!TOKEN) { console.error('Set VERCEL_TOKEN first.'); process.exit(1); }

const api = async (method, path, body) => {
  const res = await fetch(`https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}teamId=${TEAM}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};

/* 1 ── project ─────────────────────────────────────────────── */
let project = await api('GET', `/v9/projects/${PROJECT}`);
if (project.status === 404) {
  console.log(`creating project ${PROJECT}…`);
  project = await api('POST', '/v11/projects', {
    name: PROJECT,
    rootDirectory: 'store',
    gitRepository: { type: 'github', repo: REPO },
  });
  if (project.status >= 400 && JSON.stringify(project.data).match(/git|repo|installation/i)) {
    console.warn('git link failed (Vercel GitHub app may not cover this repo) — creating without it:');
    console.warn(`  ${JSON.stringify(project.data.error || project.data)}`);
    project = await api('POST', '/v11/projects', { name: PROJECT, rootDirectory: 'store' });
  }
}
if (project.status >= 400) { console.error('project setup failed:', JSON.stringify(project.data)); process.exit(1); }
const linked = Boolean(project.data.link?.type);
console.log(`project ok: ${PROJECT} (root: ${project.data.rootDirectory ?? 'store'}, git: ${linked ? project.data.link.repo || REPO : 'NOT LINKED'})`);

/* 2 ── domains ─────────────────────────────────────────────── */
for (const d of [
  { name: APEX },
  { name: `www.${APEX}`, redirect: APEX, redirectStatusCode: 308 },
  { name: 'ablx.store', redirect: APEX, redirectStatusCode: 308 },
  { name: 'www.ablx.store', redirect: APEX, redirectStatusCode: 308 },
]) {
  const r = await api('POST', `/v10/projects/${PROJECT}/domains`, d);
  const already = r.status === 409 || (r.data.error?.code === 'domain_already_in_use' && String(r.data.error?.projectId ?? '').length);
  if (r.status < 400 || already) console.log(`domain ok: ${d.name}${already ? ' (already attached)' : ''}`);
  else console.error(`domain ${d.name} failed:`, JSON.stringify(r.data.error || r.data));
}

/* 3 ── production deployment ───────────────────────────────── */
if (linked) {
  console.log(`deploying ${BRANCH} → production…`);
  const dep = await api('POST', '/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1', {
    name: PROJECT,
    target: 'production',
    gitSource: { type: 'github', org: REPO.split('/')[0], repo: REPO.split('/')[1], ref: BRANCH },
    // Required on a project's first deployment (missing_project_settings otherwise);
    // must match store/vercel.json.
    projectSettings: { buildCommand: 'node scripts/build.mjs', outputDirectory: 'dist' },
  });
  if (dep.status >= 400) console.error('deployment failed:', JSON.stringify(dep.data.error || dep.data));
  else console.log(`deployment queued: https://${dep.data.url} (${dep.data.readyState})`);
} else {
  console.log(`no git link — deploy with the CLI instead, from the repo root:`);
  console.log(`  npx vercel deploy --prod --yes --token $VERCEL_TOKEN --scope tonenation`);
}

/* 4 ── DNS verification status ─────────────────────────────── */
const cfg = await api('GET', `/v6/domains/${APEX}/config`);
console.log(`\nDNS for ${APEX}: ${cfg.data.misconfigured === false ? 'CONFIGURED ✓' : 'NOT CONFIGURED YET'}`);
console.log('Namecheap → Advanced DNS records needed:');
console.log('  A      @    76.76.21.21');
console.log('  CNAME  www  cname.vercel-dns-0.com');
if (cfg.data.recommendedIPv4?.length || cfg.data.recommendedCNAME?.length) {
  console.log('Vercel-recommended values for this domain (prefer these if different):');
  for (const v of cfg.data.recommendedIPv4 ?? []) console.log(`  A      @    ${Array.isArray(v.value) ? v.value.join(' / ') : v.value}`);
  for (const v of cfg.data.recommendedCNAME ?? []) console.log(`  CNAME  www  ${Array.isArray(v.value) ? v.value.join(' / ') : v.value}`);
}
console.log('\nRe-run this script anytime to re-check status. It changes nothing that already exists.');

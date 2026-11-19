#!/usr/bin/env node
/**
 * Build the plugin market index from `sources.json`.
 *
 * Each source publishes its own one-entry index as a release asset
 * (`releases/latest/download/index.json`), produced by `scripts/release.mjs` in
 * the plugin repository. This script only aggregates:
 *
 *   sources.json  →  fetch each source's index  →  dist/index.json
 *
 * Consequences worth keeping:
 *   - No GitHub API and no token: release asset URLs are plain HTTPS.
 *   - No knowledge of plugin repository layout: a source can be any
 *     `owner/repo` (or a full `indexUrl`) that publishes our index format.
 *   - Entries keep their ABSOLUTE, tag-pinned zip URLs, so a merged index is
 *     immutable — publishing a newer plugin release never changes the URL a
 *     client already resolved.
 *
 * A broken source does not take the registry down: it is reported and its
 * entry is omitted. A registry with zero entries fails the build.
 *
 * Usage: node scripts/build-registry.mjs [--out <dir>] [--sources <file>]
 *
 *   --sources  source list to aggregate (default: sources.json). A local path
 *              is accepted for `indexUrl`, so the merge can be exercised
 *              without publishing anything.
 */
import { isAbsolute } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outFlag = process.argv.indexOf('--out');
const OUT = outFlag >= 0 ? resolve(process.argv[outFlag + 1]) : join(ROOT, 'dist');
const sourcesFlag = process.argv.indexOf('--sources');
const SOURCES_FILE =
  sourcesFlag >= 0 ? resolve(process.argv[sourcesFlag + 1]) : join(ROOT, 'sources.json');

const SHA256_RE = /^[a-f0-9]{64}$/i;

function indexUrlFor(source) {
  if (source.indexUrl) return source.indexUrl;
  if (!source.repo || !/^[\w.-]+\/[\w.-]+$/.test(source.repo)) {
    throw new Error('source needs `repo` (owner/name) or `indexUrl`');
  }
  return `https://github.com/${source.repo}/releases/latest/download/index.json`;
}

async function fetchJson(url) {
  // Local path: fixture/test registries, no server needed.
  if (isAbsolute(url)) return JSON.parse(readFileSync(url, 'utf-8'));
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(await res.text());
}

function validateEntry(entry, source) {
  if (!entry || typeof entry !== 'object') throw new Error('entry is not an object');
  if (entry.id !== source.id) {
    throw new Error(`index id "${entry.id}" does not match source id "${source.id}"`);
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(entry.version ?? ''))) {
    throw new Error(`version "${entry.version}" is not semver`);
  }
  if (!SHA256_RE.test(String(entry.sha256 ?? ''))) throw new Error('sha256 is missing or malformed');
  if (!/^https:\/\//i.test(String(entry.url ?? ''))) throw new Error('url must be absolute https');
  return entry;
}

const sourcesFile = JSON.parse(readFileSync(SOURCES_FILE, 'utf-8'));
const sources = Array.isArray(sourcesFile.sources) ? sourcesFile.sources : [];
if (sources.length === 0) {
  console.error('sources.json has no sources');
  process.exit(1);
}

const plugins = [];
const failed = [];
for (const source of sources) {
  const indexUrl = indexUrlFor(source);
  try {
    const index = await fetchJson(indexUrl);
    if (!Array.isArray(index.plugins) || index.plugins.length !== 1) {
      throw new Error(`expected exactly one plugin in ${indexUrl}`);
    }
    const entry = validateEntry(index.plugins[0], source);
    plugins.push({
      ...entry,
      official: source.official === true,
      categories: Array.isArray(source.categories) ? source.categories : [],
    });
    console.log(`  ✓ ${source.id.padEnd(20)} v${entry.version.padEnd(10)} ${source.repo ?? indexUrl}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failed.push({ source, message, notFound: /HTTP 404/.test(message) });
    // Warning, not error: one unpublished plugin must not freeze the whole
    // registry. The matrix is visible in the workflow summary / log.
    console.log(`::warning::${source.id}: ${message}`);
    console.log(`  ✗ ${source.id.padEnd(20)} ${message}`);
  }
}

if (plugins.length === 0) {
  // A brand-new registry whose plugins have not published yet is normal, not
  // broken. Anything else (malformed index, wrong id, missing sha256) is a
  // real error and must be visible as a failed run.
  if (failed.length === sources.length && failed.every((f) => f.notFound)) {
    console.log('::warning::no plugin release published yet — leaving the registry unchanged');
    process.exit(0);
  }
  console.error('no source produced a valid entry — refusing to publish an empty registry');
  process.exit(1);
}

// Official plugins first, then alphabetical — the client renders catalog order.
plugins.sort((a, b) => {
  const byOfficial = Number(b.official) - Number(a.official);
  return byOfficial !== 0 ? byOfficial : a.id.localeCompare(b.id);
});

mkdirSync(OUT, { recursive: true });
const indexPath = join(OUT, 'index.json');
writeFileSync(
  indexPath,
  `${JSON.stringify({ version: 1, updated: new Date().toISOString(), plugins }, null, 2)}\n`,
);

console.log(`\n${plugins.length}/${sources.length} source(s) merged → ${indexPath}`);
if (failed.length > 0) console.log(`failed: ${failed.map((s) => s.id).join(', ')}`);

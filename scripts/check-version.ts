import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/**
 * One version label, everywhere.
 *
 * The pause card, the credits and `window.__CAMPUS.version` must all print the repo's
 * `VERSION` file — never a hand-typed copy — and the printed stamp carries the commit
 * the build came from. This gate holds the wiring in source, and, when a build is
 * present, checks that the label actually reached the emitted JavaScript.
 *
 *   npm run check:version                 # source wiring
 *   tsx scripts/check-version.ts dist     # source wiring + the shipped bundle
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const version = read('VERSION').trim();
const pkg = JSON.parse(read('package.json')) as {version?: string};

assert.match(version, /^\d+\.\d+\.\d+$/, `VERSION must be a bare semver, read "${version}"`);
assert.equal(pkg.version, version, `package.json version (${pkg.version}) must match VERSION (${version})`);
console.log(`PASS VERSION ${version} matches package.json`);

const vite = read('vite.config.ts');
assert.match(vite, /readFileSync\(resolve\('VERSION'\)/, 'vite.config.ts must read VERSION rather than restate it');
assert.match(vite, /__BUILD_VERSION__:JSON\.stringify\(BUILD_VERSION\)/, 'vite.config.ts must inject __BUILD_VERSION__');
assert.match(vite, /'rev-parse','--short=12','HEAD'/, 'vite.config.ts must derive the build SHA from the commit');
assert.match(vite, /__BUILD_SHA__:JSON\.stringify\(BUILD_SHA\)/, 'vite.config.ts must inject __BUILD_SHA__');
console.log('PASS vite.config.ts injects __BUILD_VERSION__ and __BUILD_SHA__');

const versionModule = read('src/version.ts');
assert.match(versionModule, /typeof __BUILD_VERSION__ === 'string'/, 'src/version.ts must guard the injected constant for the Node gates');
assert.match(versionModule, /typeof __BUILD_SHA__ === 'string'/, 'src/version.ts must guard the injected SHA for the Node gates');
assert.match(versionModule, /BUILD_LABEL = `v\$\{BUILD_VERSION\}`/, 'src/version.ts must expose the printed label v<version>');
assert.match(versionModule, /BUILD_STAMP = `\$\{BUILD_LABEL\} · \$\{BUILD_SHA\}`/, 'src/version.ts must expose the printed stamp label · commit');

const main = read('src/main.ts');
assert.match(main, /import \{BUILD_VERSION,BUILD_STAMP\} from '\.\/version'/, 'main.ts must read the version from src/version.ts');
assert.match(main, /id="build-version"/, 'the pause card must carry a #build-version line');
assert.match(main, /buildVersion\.textContent=`HKU: Barrier 2030 · \$\{BUILD_STAMP\}`/, 'the pause card must print the label and commit');
assert.match(main, /version:BUILD_VERSION,/, 'window.__CAMPUS.version must expose the build version');
console.log('PASS pause card and __CAMPUS.version read the version module');

const ending = read('src/campaign/endingChapter.ts');
assert.match(ending, /import \{BUILD_STAMP\} from '\.\.\/version'/, 'the credits must read BUILD_STAMP from src/version.ts');
assert.match(ending, /class="ending-build">'\+BUILD_STAMP\+'</, 'the credits must print the stamp');
console.log('PASS credits print BUILD_STAMP');

// The shipped bundle: only checked when a build directory is passed and exists, because
// CI may run this gate before `vite build`. A stale build is reported, not silently trusted.
const dist = process.argv[2];
if (dist) {
 const assets = path.join(root, dist, 'assets');
 if (!fs.existsSync(assets)) {
  console.log(`NOTE ${dist}/assets does not exist yet; skipped the bundle check`);
 } else {
  const hits: string[] = [];
  const shas = new Set<string>();
  for (const file of fs.readdirSync(assets)) {
   if (!file.endsWith('.js')) continue;
   const code = fs.readFileSync(path.join(assets, file), 'utf8');
   if (code.includes(version)) hits.push(file);
   for (const match of code.matchAll(/\b[0-9a-f]{12}(?:-dirty)?\b/g)) shas.add(match[0]);
  }
  assert.ok(hits.length > 0, `${dist} carries no JavaScript mentioning version ${version}; was it built from this tree?`);
  const commits = [...shas].slice(0, 3).join(', ') || 'none';
  console.log(`PASS ${dist} carries ${version} in ${hits.length} JavaScript chunk(s): ${hits.slice(0, 4).join(', ')}${hits.length > 4 ? ' …' : ''}`);
  console.log(`INFO ${dist} commit stamps seen: ${commits}`);
 }
}

console.log(`check-version: ${version}`);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/**
 * One version label, everywhere.
 *
 * The pause card, the credits and `window.__CAMPUS.version` must all print the repo's
 * `VERSION` file — never a hand-typed copy. This gate holds the wiring in source, and,
 * when a build is present, checks that the label actually reached the emitted JavaScript.
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
console.log('PASS vite.config.ts injects __BUILD_VERSION__ from VERSION');

const versionModule = read('src/version.ts');
assert.match(versionModule, /typeof __BUILD_VERSION__ === 'string'/, 'src/version.ts must guard the injected constant for the Node gates');
assert.match(versionModule, /BUILD_LABEL = `v\$\{BUILD_VERSION\}`/, 'src/version.ts must expose the printed label v<version>');

const main = read('src/main.ts');
assert.match(main, /import \{BUILD_VERSION,BUILD_LABEL\} from '\.\/version'/, 'main.ts must read the version from src/version.ts');
assert.match(main, /id="build-version"/, 'the pause card must carry a #build-version line');
assert.match(main, /buildVersion\.textContent=`HKU: Barrier 2030 · \$\{BUILD_LABEL\}`/, 'the pause card must print the label');
assert.match(main, /version:BUILD_VERSION,/, 'window.__CAMPUS.version must expose the build version');
console.log('PASS pause card and __CAMPUS.version read BUILD_VERSION');

const ending = read('src/campaign/endingChapter.ts');
assert.match(ending, /import \{BUILD_LABEL\} from '\.\.\/version'/, 'the credits must read BUILD_LABEL from src/version.ts');
assert.match(ending, /class="ending-build">'\+BUILD_LABEL\+'</, 'the credits must print the label');
console.log('PASS credits print BUILD_LABEL');

// The shipped bundle: only checked when a build directory is passed and exists, because
// CI may run this gate before `vite build`. A stale build is reported, not silently trusted.
const dist = process.argv[2];
if (dist) {
 const assets = path.join(root, dist, 'assets');
 if (!fs.existsSync(assets)) {
  console.log(`NOTE ${dist}/assets does not exist yet; skipped the bundle check`);
 } else {
  const hits: string[] = [];
  for (const file of fs.readdirSync(assets)) {
   if (!file.endsWith('.js')) continue;
   const code = fs.readFileSync(path.join(assets, file), 'utf8');
   if (code.includes(`"${version}"`) || code.includes(`'${version}'`) || code.includes(version)) hits.push(file);
  }
  assert.ok(hits.length > 0, `${dist} carries no JavaScript mentioning version ${version}; was it built from this tree?`);
  console.log(`PASS ${dist} carries ${version} in ${hits.length} JavaScript chunk(s): ${hits.slice(0, 4).join(', ')}${hits.length > 4 ? ' …' : ''}`);
 }
}

console.log(`check-version: ${version}`);

// Rebuild the mock-view harness against the current src/opening/ui.ts.
// Run from the repository root: node evidence/opening-ui/harness/build.mjs
import {build} from '../../../node_modules/esbuild/lib/main.js';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [join(here, 'main.ts')],
  bundle: true,
  outfile: join(here, 'bundle.js'),
  format: 'esm',
  target: 'es2022',
  loader: {'.css': 'css'},
  legalComments: 'none',
  plugins: [{
    name: 'stub-save-module',
    setup(b) {
      b.onResolve({filter: /gameplay\/save$/}, () => ({path: join(here, 'save-stub.ts')}));
    },
  }],
});
console.log('harness bundle built:', join(here, 'bundle.js'));

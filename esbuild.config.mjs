import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');
const banner = readFileSync(join(root, 'userscript.meta.js'), 'utf8').trimEnd() + '\n';

const options = {
  entryPoints: [join(root, 'src/main.ts')],
  outfile: join(root, 'BigBlackGymLog.js'),
  bundle: true,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  banner: { js: banner },
  loader: {
    '.css': 'text',
    '.html': 'text'
  },
  legalComments: 'none',
  logLevel: 'info'
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(options);
}

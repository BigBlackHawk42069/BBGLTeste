import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(root, '..', 'BigBlackGymLog.js'), 'utf8');
const start = src.indexOf("    function isDevMode()");
const end = src.lastIndexOf('    //# sourceURL=BBGL.js');
if (start < 0 || end < 0) throw new Error('Could not locate IIFE body bounds');
const body = src.slice(start, end).replace(/\s+$/, '');
const out = `export function boot() {\n${body}\n}\n`;
writeFileSync(join(root, '..', 'src', 'legacy.js'), out);
console.log(`Wrote src/legacy.js (${out.length} chars)`);

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const legacyPath = join(root, 'src/legacy.js');
let src = readFileSync(legacyPath, 'utf8');

const cssStart = src.indexOf('    const CSS_STYLES = `');
const cssEnd = src.indexOf('`;\n\n    function injectStyles()');
if (cssStart < 0 || cssEnd < 0) throw new Error('CSS_STYLES bounds not found');

let css = src.slice(cssStart + '    const CSS_STYLES = `'.length, cssEnd);
css = css
  .replaceAll('${ASSETS.GLASS_OVERLAY}', '__ASSETS_GLASS_OVERLAY__')
  .replaceAll('${ASSETS.STICKER_BG}', '__ASSETS_STICKER_BG__')
  .replaceAll('${ASSETS.HEADER_IMG}', '__ASSETS_HEADER_IMG__')
  .replaceAll('${ASSETS.NEW_STICKER_FRAME}', '__ASSETS_NEW_STICKER_FRAME__')
  .replaceAll('${CROWN_BADGE_URL}', '__CROWN_BADGE_URL__');

mkdirSync(join(root, 'src/ui'), { recursive: true });
writeFileSync(join(root, 'src/ui/styles.css'), css.replace(/^\n/, ''));

src = src.replace(
  /    const CSS_STYLES = `[\s\S]*?`;\n\n    function injectStyles\(\) \{[\s\S]*?^    \}\n\n    function cacheDOM/m,
  '    function cacheDOM'
);

if (src.includes('const CSS_STYLES') || src.includes('function injectStyles()')) {
  throw new Error('Failed to strip CSS_STYLES / injectStyles from legacy.js');
}

if (!src.startsWith('import ')) {
  src = `import { CUSTOM_STICKERS } from './ui/assets.ts';\nimport { ASSETS, ICONS } from './ui/icons.ts';\nimport { injectStyles } from './ui/styles.ts';\n\n` + src;
}

src = src.replace(/\n    const _d = s => atob\(s\);\n    const CUSTOM_STICKERS = \[[\s\S]*?\];\n    CUSTOM_STICKERS\.forEach\(s => \{ s\.url = cdnize\(s\.url\); \}\);\n/, '\n');

src = src.replace(
  /\n    \/\*\*\n     \*  \[SECTION III\] THE PHYSIQUE[\s\S]*?\n    const ASSETS = \{[\s\S]*?\n    \};\n    const ICONS = \{[\s\S]*?\n    \};\n    \/\/ A0 level badge:[\s\S]*?\n    const EXP_CROWN_PATH = "[^"]+";\n    const CROWN_BADGE_SVG = `[^`]+`;\n    const CROWN_BADGE_URL = `[^`]+`;\n/,
  '\n'
);

writeFileSync(legacyPath, src);
console.log('Phase 1 extract: CSS + assets stripped from legacy.js');

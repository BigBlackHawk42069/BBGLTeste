const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '04-section-iii-styles.js');
const INDENT = ' '.repeat(20);
const WIDTH = 120;

const raw = fs.readFileSync(FILE, 'utf8');
const lines = raw.split('\n');

// --- Step 1: Dynamic boundary detection ---

// Shaft start: first line with exactly 20-space indent followed by CSS content
let shaftStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (/^ {20}[.#@a-zA-Z_]/.test(lines[i])) {
    shaftStart = i;
    break;
  }
}

// Shaft end: last line before first "balls" line (two /*===*/ blocks on same line)
let shaftEnd = -1;
for (let i = shaftStart + 1; i < lines.length; i++) {
  if (/\/\*=+\*\/.*\/\*=+\*\//.test(lines[i])) {
    shaftEnd = i - 1;
    break;
  }
}

if (shaftStart === -1 || shaftEnd === -1) {
  console.error('Could not detect shaft boundaries. Aborting.');
  process.exit(1);
}

console.log(`Shaft detected: lines ${shaftStart + 1}–${shaftEnd + 1} (${shaftEnd - shaftStart + 1} lines)`);

// --- Step 2: Strip indent and padding from each shaft line ---

const shaftLines = lines.slice(shaftStart, shaftEnd + 1);
const stripped = shaftLines.map(line => {
  let s = line.startsWith(INDENT) ? line.slice(INDENT.length) : line;
  s = s.replace(/\s*\/\*-+\*\/\s*$/, '');
  return s;
});

// --- Step 3: Join into one raw CSS string ---

const joined = stripped.join(' ').replace(/\s{2,}/g, ' ').trim();

// --- Step 4: Protect template literals ${...} ---

const placeholders = [];
const withPH = joined.replace(/\$\{[^}]+\}/g, match => {
  const idx = placeholders.length;
  placeholders.push(match);
  return `__PH${idx}__`;
});

// --- Step 5: Tokenize on ; { } boundaries ---

const tokens = withPH.match(/[^;{}]*[;{}]\s*/g) || [];

// --- Step 6 & 7: Greedy bin-packing at WIDTH=120, pad remainder ---

function padLine(content) {
  const trimmed = content.trimEnd();
  const remaining = WIDTH - trimmed.length;
  if (remaining >= 5) {
    const dashes = '-'.repeat(remaining - 5);
    return INDENT + trimmed + ' /*' + dashes + '*/';
  }
  return INDENT + trimmed;
}

const newShaftLines = [];
let current = '';

for (const token of tokens) {
  if (current.length === 0 || current.length + token.length <= WIDTH) {
    current += token;
  } else {
    newShaftLines.push(padLine(current));
    current = token;
  }
}
if (current.length > 0) {
  newShaftLines.push(padLine(current));
}

// --- Step 8: Restore placeholders ---

const restored = newShaftLines.map(line =>
  line.replace(/__PH(\d+)__/g, (_, i) => placeholders[parseInt(i, 10)])
);

// --- Write back ---

const before = lines.slice(0, shaftStart);
const after = lines.slice(shaftEnd + 1);
const newContent = [...before, ...restored, ...after].join('\n');

fs.writeFileSync(FILE, newContent, 'utf8');

console.log(`Done. Shaft: ${shaftLines.length} lines → ${restored.length} lines`);

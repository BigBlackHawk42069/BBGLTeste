import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const srcRoot = new URL('../src/', import.meta.url).pathname;
const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.js') && name !== 'app-context.js') files.push(p);
  }
}
walk(srcRoot);

const fileLocals = new Map();
const allNames = new Set();
for (const p of files) {
  const text = readFileSync(p, 'utf8');
  const locals = new Set();
  for (const m of text.matchAll(/^app\.([A-Za-z_$][\w$]*) = /gm)) {
    locals.add(m[1]);
    allNames.add(m[1]);
  }
  fileLocals.set(p, locals);
}

function isWs(c) { return c === ' ' || c === '\t' || c === '\n' || c === '\r'; }

function skipString(s, i) {
  const q = s[i];
  i++;
  while (i < s.length) {
    if (s[i] === '\\') { i += 2; continue; }
    if (s[i] === q) return i + 1;
    i++;
  }
  return i;
}

function process(code, locals) {
  const others = [...allNames].filter(n => !locals.has(n));
  let out = '';
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '"' || c === "'") {
      const n = skipString(code, i);
      out += code.slice(i, n);
      i = n;
      continue;
    }
    if (c === '`') {
      out += '`';
      i++;
      while (i < code.length) {
        if (code[i] === '\\') { out += code.slice(i, i + 2); i += 2; continue; }
        if (code[i] === '`') { out += '`'; i++; break; }
        if (code[i] === '$' && code[i + 1] === '{') {
          out += '${';
          i += 2;
          let depth = 1;
          const start = i;
          while (i < code.length && depth > 0) {
            if (code[i] === '"' || code[i] === "'") { i = skipString(code, i); continue; }
            if (code[i] === '{') { depth++; i++; continue; }
            if (code[i] === '}') { depth--; if (depth === 0) break; i++; continue; }
            i++;
          }
          out += process(code.slice(start, i), locals);
          if (code[i] === '}') { out += '}'; i++; }
          continue;
        }
        out += code[i];
        i++;
      }
      continue;
    }
    if (c === '/' && code[i + 1] === '/') {
      const n = code.indexOf('\n', i);
      const end = n < 0 ? code.length : n;
      out += code.slice(i, end);
      i = end;
      continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      const n = code.indexOf('*/', i + 2);
      const end = n < 0 ? code.length : n + 2;
      out += code.slice(i, end);
      i = end;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < code.length && /[\w$]/.test(code[j])) j++;
      const word = code.slice(i, j);
      const prev = i > 0 ? code[i - 1] : '';
      let k = i - 1;
      while (k >= 0 && isWs(code[k])) k--;
      const prevSig = k >= 0 ? code[k] : '';
      let after = j;
      while (after < code.length && isWs(code[after])) after++;
      const isMethod = (prevSig === '{' || prevSig === ',') && code[after] === '(';
      const isDecl = /^(?:async\s+)?function$/.test(code.slice(Math.max(0, i - 16), i).trim().split(/\s+/).pop() || '') ||
        /\b(?:const|let|var|function|class|export)\s+$/.test(code.slice(Math.max(0, i - 20), i));
      if (others.includes(word) && prev !== '.' && !isMethod && !isDecl) {
        out += 'app.' + word;
      } else {
        out += word;
      }
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

let changed = 0;
for (const p of files) {
  const before = readFileSync(p, 'utf8');
  const after = process(before, fileLocals.get(p));
  if (after !== before) {
    writeFileSync(p, after);
    changed++;
    console.log('fixed', p.slice(srcRoot.length));
  }
}
console.log('updated', changed, 'files; names', allNames.size);

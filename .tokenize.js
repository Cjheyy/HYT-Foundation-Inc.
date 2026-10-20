const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || 'src');
const EXT = new Set(['.css']);

// Literal -> token. Every token is defined with the SAME literal in :root, so
// light mode is byte-identical after the swap.
const MAP = {
  '#1f2937': 'var(--dark-text)',
  '#6b7280': 'var(--muted-text)',
  '#4b5563': 'var(--muted-text-strong)',
  '#374151': 'var(--dark-text)',
  '#5b6472': 'var(--muted-text-strong)',
  '#1a1a1a': 'var(--dark-text)',
  '#0e1726': 'var(--dark-text)',
  '#e5e7eb': 'var(--border)',
  '#b8441f': 'var(--accent-text)',
  '#b42318': 'var(--danger-text)',
  '#b91c1c': 'var(--danger-text)',
  '#991b1b': 'var(--danger-text)',
  '#92400e': 'var(--warning-text)',
  '#9a3412': 'var(--warning-text)',
  '#c2410c': 'var(--accent-strong)',
  '#065f46': 'var(--success-text)',
  '#0e7490': 'var(--info-text)',
  '#0f5566': 'var(--info-text)',
  '#1e40af': 'var(--link-text)',
  '#1d4ed8': 'var(--link-text)',
  '#5b21b6': 'var(--purple-text)'
};

// White is only a surface when it is a background. As a text colour it must
// stay white (hero copy, buttons on brand colour).
const WHITE_BG = /(background(?:-color)?\s*:\s*)(white|#fff\b|#ffffff)\b/gi;

let files = 0;
let edited = 0;
let declsRemoved = 0;
let declsMapped = 0;
let literals = 0;

function transform(text) {
  let removed = 0;
  let mapped = 0;

  // Pass 1: palette declarations.
  const lines = text.split('\n').map((line) => {
    const m = line.match(/^(\s*)(--[a-z-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;\s*$/);
    if (!m) return line;
    const [, indent, name, value] = m;
    const token = MAP[value.toLowerCase()];
    if (!token) return line;
    // Re-declaring a token with its own root value is redundant, and worse, it
    // would shadow the dark override. Drop it.
    if (token === `var(${name})`) {
      removed += 1;
      return null;
    }
    mapped += 1;
    return `${indent}${name}: ${token};`;
  }).filter((line) => line !== null);

  let out = lines.join('\n');

  // Pass 2: any remaining literal in any property.
  out = out.replace(/#[0-9a-fA-F]{6}\b/g, (hex) => {
    const token = MAP[hex.toLowerCase()];
    if (!token) return hex;
    literals += 1;
    return token;
  });

  // Pass 3: white backgrounds become the surface token.
  out = out.replace(WHITE_BG, (match, prefix) => `${prefix}var(--surface)`);

  declsRemoved += removed;
  declsMapped += mapped;
  return out;
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!EXT.has(path.extname(entry.name))) continue;
    files += 1;
    const before = fs.readFileSync(full, 'utf8');
    const after = transform(before);
    if (after !== before) {
      fs.writeFileSync(full, after, 'utf8');
      edited += 1;
    }
  }
}

walk(ROOT);
console.log(`css files scanned : ${files}`);
console.log(`files rewritten   : ${edited}`);
console.log(`decls removed     : ${declsRemoved}`);
console.log(`decls re-pointed  : ${declsMapped}`);
console.log(`literals swapped  : ${literals}`);

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || 'src');
const EXT = new Set(['.js', '.jsx', '.css']);

let files = 0;
let changed = 0;

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
    const after = before
      // Spaced em dash and en dash collapse to a spaced hyphen.
      .replace(/\s*[\u2014\u2013]\s*/g, ' - ')
      // Any remaining unspaced one becomes a bare hyphen.
      .replace(/[\u2014\u2013]/g, '-');

    if (after !== before) {
      fs.writeFileSync(full, after, 'utf8');
      changed += 1;
      const remaining = (before.match(/[\u2014\u2013]/g) || []).length;
      console.log(`  ${path.relative(ROOT, full)}  (${remaining} replaced)`);
    }
  }
}

walk(ROOT);
console.log('');
console.log(`scanned ${files} files, rewrote ${changed}`);

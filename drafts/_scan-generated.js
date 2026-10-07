const fs = require('fs');
const s = fs.readFileSync('src/index.css', 'utf8');
const lines = s.split('\n');
const start = lines.findIndex((l) => l.includes('GENERATED: light surfaces'));
const end = lines.findIndex((l) => l.includes('GENERATED: dark hardcoded text'));
console.log('block1 lines', start + 1, '..', end);
const block = lines.slice(start, end).join('\n');
const re = new RegExp('color:' + String.raw`\s*` + '(#[0-9A-Fa-f]{6})', 'g');
const hexes = [...block.matchAll(re)].map((m) => m[1].toUpperCase());
const uniq = [...new Set(hexes)];
const lum = (h) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const bad = uniq.filter((h) => lum(h) > 0.35);
console.log('distinct colours:', uniq.length);
console.log('LIGHT (lum>0.35 -> low contrast on white):', bad.join(' ') || 'none');
const whiteRe = new RegExp('rgba' + String.raw`\(` + '255', 'g');
console.log('rgba(255 count in block1:', (block.match(whiteRe) || []).length);
const b2 = lines.slice(end).join('\n');
const h2 = [...new Set([...b2.matchAll(re)].map((m) => m[1].toUpperCase()))];
console.log('block2 distinct colours:', h2.length, '| light ones:', h2.filter((h) => lum(h) > 0.35).join(' ') || 'none');
console.log('total lines in index.css:', lines.length);

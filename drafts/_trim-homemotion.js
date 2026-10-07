/**
 * The `.reveal-card` / `.reveal-wipe` mechanism is now shared component CSS in
 * src/index.css (all five posting surfaces use it, not just Home's rails).
 * Remove HomeMotion.css's copy so there is one definition, not two that drift.
 */
const fs = require('fs');
const p = 'src/pages/public/HomeMotion.css';
let s = fs.readFileSync(p, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
const before = s;

const startMarker = '/* ==========================================================================\n   6. FEATURED CARDS';
const startIdx = s.indexOf(startMarker);
if (startIdx === -1) {
  console.error('start marker not found');
  process.exit(1);
}
const endMarker = '/* ==========================================================================\n   10. Reduced motion';
const endIdx = s.indexOf(endMarker, startIdx);
if (endIdx === -1) {
  console.error('end marker not found');
  process.exit(1);
}

const replacement = [
  '/* ==========================================================================',
  '   6. FEATURED CARDS — clip-path circle reveal',
  '',
  '   MOVED.  The reveal is no longer a Home-only effect: all five browsable',
  '   posting surfaces (Home rails, public Programs, public Opportunities,',
  '   student Opportunities) now share it, so the definition lives with the',
  '   shared card CSS in src/index.css alongside `.card.reveal-card:hover`.',
  '   Keeping a second copy here meant the two drifted — this file still held the',
  '   saturated gradient long after the shared rule had moved to a light wash.',
  '   ========================================================================== */',
  '',
  '',
].join(eol);

s = s.slice(0, startIdx) + replacement + s.slice(endIdx);

if (s === before) {
  console.error('no change');
  process.exit(1);
}
fs.writeFileSync(p, s, 'utf8');
console.log('trimmed, eol=' + JSON.stringify(eol));

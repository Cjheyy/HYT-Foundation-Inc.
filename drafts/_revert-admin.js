const fs = require('fs');
const p = 'src/pages/admin/Admin.css';
let s = fs.readFileSync(p, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
const before = s;

// 1. .posting-card-org — the org accent goes back to the brand orange token.
s = s.replace(
  /  \/\* Was var\(--primary-orange\)[^\n]*\r?\n     end\. A light tone clears[^\n]*\r?\n  color: rgba\(255, 255, 255, 0\.92\);/,
  '  /* White card again: the deepened brand orange reads at 5.41:1 here, and the' + eol +
  '     token flips to white under the posting card\'s hover gradient. */' + eol +
  '  color: var(--accent-text, #B8441F);'
);

if (s === before) {
  console.error('NO CHANGE — pattern did not match');
  process.exit(1);
}
fs.writeFileSync(p, s, 'utf8');
console.log('ok, eol=' + JSON.stringify(eol));

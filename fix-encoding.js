const fs = require('fs');
const path = require('path');

function walk(dir) {
  const files = [];
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) files.push(...walk(fp));
    else if (f.endsWith('.html') || f.endsWith('.js')) files.push(fp);
  }
  return files;
}

const dir = 'C:/Users/hi/OneDrive/Desktop/new1/frontend';
const files = walk(dir);
let totalFixed = 0;

const REPLACEMENTS = [
  // 4-char mojibake
  ['\u00C3\u201A\u00C2\u00B1', '\u00B1'],  // Ã‚Â± -> ±
  ['\u00E2\u201A\u00AC\u201D', '\u2014'],
  ['\u00E2\u201A\u00AC\u201C', '\u201C'],
  ['\u00E2\u00E2\u20AC\u00A0', ' '],
  // 3-char mojibake
  ['\u00E2\u20AC\u201D', '\u2014'],
  ['\u00E2\u20AC\u201C', '\u201C'],
  ['\u00E2\u20AC\u2018', '\u2018'],
  ['\u00E2\u20AC\u2019', '\u2019'],
  ['\u00E2\u20AC\u2013', '\u2013'],
  ['\u00E2\u20AC\u2122', '\u2122'],
  ['\u00E2\u2020\u2019', '\u2192'],
  ['\u00E2\u2020\u2018', '\u2190'],
  ['\u00E2\u2020\u201C', '\u2191'],
  ['\u00E2\u2020\u201D', '\u2193'],
  ['\u00E2\u0153\u201C', '\u2713'],
  // 2-char mojibake
  ['\u00C3\u2014', '\u00D7'],
  ['\u00C3\u00A2', '\u00E2'],
  ['\u00C2\u00A9', '\u00A9'],
  ['\u00C2\u00B7', '\u00B7'],
  ['\u00C2\u00A0', ' '],
  ['\u00C2\u00AB', '\u00AB'],
  ['\u00C2\u00BB', '\u00BB'],
  ['\u00E2\u2014', '\u2014'],
];

for (const f of files) {
  let content = fs.readFileSync(f, 'utf8');
  let fixed = 0;
  for (const [broken, correct] of REPLACEMENTS) {
    while (content.includes(broken)) {
      content = content.split(broken).join(correct);
      fixed++;
    }
  }
  if (fixed > 0) {
    fs.writeFileSync(f, content, 'utf8');
    const short = f.replace(dir + '/', '');
    console.log(short + ': fixed ' + fixed);
    totalFixed += fixed;
  }
}
console.log('\nTotal: ' + totalFixed + ' more fixes');

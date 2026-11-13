const fs = require('fs');
const path = require('path');

function search(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== 'node_modules' && f !== '.next') search(full);
    } else if (/\.(tsx?|jsx?)$/.test(f)) {
      const c = fs.readFileSync(full, 'utf8');
      if (c.includes('dayNumberFromLaneStart')) {
        console.log(full);
      }
    }
  }
}

search('src');

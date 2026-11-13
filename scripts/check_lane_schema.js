const fs = require('fs');
const c = fs.readFileSync('src/lib/validation/schemas.ts', 'utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('laneSchema')) {
    console.log(lines.slice(Math.max(0, i-2), i+20).join('\n'));
  }
});

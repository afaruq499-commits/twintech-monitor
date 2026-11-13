const fs = require('fs');
const c = fs.readFileSync('src/lib/date-utils.ts', 'utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('laneDatesIso')) {
    console.log(lines.slice(Math.max(0, i-5), i+20).join('\n'));
  }
});

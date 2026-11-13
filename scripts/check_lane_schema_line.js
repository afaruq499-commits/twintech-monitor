const fs = require('fs');
const c = fs.readFileSync('src/lib/validation/schemas.ts', 'utf8');
c.split('\n').forEach((l, i) => {
  if (l.includes('laneSchema')) console.log((i+1) + ': ' + l);
});

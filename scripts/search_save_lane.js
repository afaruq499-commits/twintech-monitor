const fs = require('fs');
const c = fs.readFileSync('src/components/LaneGridEditorClient.tsx', 'utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('saveLane') || l.includes('handleSaveLane') || l.includes('/api/lanes/')) {
    console.log((i+1) + ': ' + l.trim());
  }
});

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'DesignStudio.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const occurrences = [];
lines.forEach((line, index) => {
  if (line.includes('const WavyGlass') || line.includes('function WavyGlass')) {
    occurrences.push(index + 1);
  }
});

console.log('WavyGlass definitions found at lines:', occurrences);
if (occurrences.length > 0) {
  for (let i = occurrences[0] - 2; i < occurrences[0] + 50; i++) {
    console.log(`${i+1}: ${lines[i]}`);
  }
}

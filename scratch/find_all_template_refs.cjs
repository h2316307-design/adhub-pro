const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'DesignStudio.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Searching for "coverTemplate" occurrences:');
lines.forEach((line, index) => {
  if (line.includes('coverTemplate')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});

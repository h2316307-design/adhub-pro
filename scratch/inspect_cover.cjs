const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'DesignStudio.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

function printRange(start, end) {
  console.log(`--- Lines ${start} to ${end} ---`);
  for (let i = start - 1; i < end && i < lines.length; i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}

// Find renderCoverToBlob
const renderIndex = lines.findIndex(l => l.includes('renderCoverToBlob ='));
if (renderIndex !== -1) {
  printRange(renderIndex + 1, renderIndex + 100);
} else {
  console.log('renderCoverToBlob not found');
}

// Find where templates are rendered in JSX (probably "coverTemplate" or "template1")
console.log('\n--- Template JSX Matches ---');
lines.forEach((line, index) => {
  if (line.includes('coverTemplate ===') || line.includes('coverTemplate ===') || line.includes('template1') && line.includes('&&')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});

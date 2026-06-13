const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'DesignStudio.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('// ============= TEMPLATE') || line.includes('TEMPLATE 3') || line.includes('TEMPLATE 1') || line.includes('TEMPLATE 2') || line.includes('TEMPLATE 4')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});

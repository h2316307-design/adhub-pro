const fs = require('fs');
const path = require('path');

const queryDir = 'E:/adhub-pro-main (4)/adhub-pro-main/Supabase Query';
const filePath = path.join(queryDir, 'Supabase Query Performance Statements (atqjaiebixuzomrfwilu).csv');

function parseCSVCharByChar(content) {
  const rows = [];
  let inQuotes = false;
  let currentField = '';
  let currentRow = [];
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.length > 0 && currentRow.some(f => f !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }
  
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }
  
  return rows;
}

if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const allRows = parseCSVCharByChar(content);
  
  const headers = allRows[0];
  console.log('Headers:', headers);
  
  for (let i = 1; i < allRows.length; i++) {
    const r = allRows[i];
    console.log(`\nRow #${i}:`);
    headers.forEach((h, idx) => {
      let val = r[idx] || '';
      if (h === 'query') {
        val = val.replace(/\s+/g, ' ').slice(0, 150) + '...';
      }
      console.log(`  ${h}: ${val}`);
    });
  }
}

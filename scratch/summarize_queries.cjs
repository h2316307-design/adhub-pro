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
  const rows = [];
  for (let i = 1; i < allRows.length; i++) {
    const r = allRows[i];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] || '';
    });
    rows.push(obj);
  }
  
  // Filter for authenticated and anon roles (application traffic)
  const appRows = rows.filter(r => {
    const role = r.rolname;
    return role === 'authenticated' || role === 'anon';
  });
  
  // Sort by total_time descending
  const sorted = appRows.sort((a, b) => {
    return parseFloat(b.total_time || 0) - parseFloat(a.total_time || 0);
  });
  
  console.log(`=== TOP 15 SLOWEST APPLICATION QUERIES === (Total app queries: ${appRows.length})`);
  sorted.slice(0, 15).forEach((r, idx) => {
    console.log(`\n#${idx + 1}: Calls: ${r.calls} | Mean: ${parseFloat(r.mean_time || 0).toFixed(2)}ms | Total: ${parseFloat(r.total_time || 0).toFixed(2)}ms | Role: ${r.rolname}`);
    console.log(`Query: ${(r.query || '').replace(/\s+/g, ' ').slice(0, 300)}...`);
    if (r.index_advisor_result && r.index_advisor_result !== 'null' && r.index_advisor_result.trim() !== '') {
      console.log(`Index Advisor Suggestion: ${r.index_advisor_result}`);
    }
  });
} else {
  console.log('File not found:', filePath);
}

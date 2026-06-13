const fs = require('fs');
const path = require('path');

const queryDir = 'E:/adhub-pro-main (4)/adhub-pro-main/Supabase Query';
const filePath = path.join(queryDir, 'Supabase Query Performance Statements (atqjaiebixuzomrfwilu).csv');

if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  console.log('Lines count:', lines.length);
  
  // Print first 5 lines directly
  lines.slice(0, 5).forEach((l, idx) => console.log(`Line ${idx}:`, l));
}

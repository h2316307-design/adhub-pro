const fs = require('fs');
const path = require('path');

const queryDir = 'E:/adhub-pro-main (4)/adhub-pro-main/Supabase Query';
const filePath = path.join(queryDir, 'Supabase Query Performance Statements (atqjaiebixuzomrfwilu).csv');

if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let quotesCount = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '"') quotesCount++;
  }
  console.log('Total quotes count in file:', quotesCount);
}

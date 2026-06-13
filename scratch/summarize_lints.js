const fs = require('fs');
const path = require('path');

const queryDir = 'E:/adhub-pro-main (4)/adhub-pro-main/Supabase Query';

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function processLintsFile(fileName) {
  const filePath = path.join(queryDir, fileName);
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  
  const lints = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    if (values.length < headers.length) continue;
    
    const lint = {};
    headers.forEach((h, index) => {
      lint[h] = values[index];
    });
    lints.push(lint);
  }
  return lints;
}

function summarizeLints() {
  const files = [
    'Supabase Performance Security Lints (atqjaiebixuzomrfwilu).csv',
    'Supabase Performance Security Lints (atqjaiebixuzomrfwilu) (1).csv',
    'Supabase Performance Security Lints (atqjaiebixuzomrfwilu) (2).csv'
  ];

  let allLints = [];
  files.forEach(f => {
    allLints = allLints.concat(processLintsFile(f));
  });

  // Deduplicate by cache_key or metadata
  const uniqueLints = {};
  allLints.forEach(l => {
    const key = l.cache_key || (l.name + '_' + l.detail);
    if (!uniqueLints[key]) {
      uniqueLints[key] = l;
    }
  });

  const lintList = Object.values(uniqueLints);
  console.log(`Total unique lints found: ${lintList.length}`);

  // Group by name (lint rule)
  const groupedByName = {};
  lintList.forEach(l => {
    if (!groupedByName[l.name]) {
      groupedByName[l.name] = [];
    }
    groupedByName[l.name].push(l);
  });

  console.log('\n--- Grouped Lint Rules ---');
  Object.keys(groupedByName).forEach(name => {
    console.log(`${name}: ${groupedByName[name].length} occurrences`);
    // Print first 3 details
    groupedByName[name].slice(0, 3).forEach(l => {
      console.log(`  - [${l.level}] ${l.detail}`);
    });
    if (groupedByName[name].length > 3) {
      console.log(`  - ... and ${groupedByName[name].length - 3} more`);
    }
  });
}

summarizeLints();

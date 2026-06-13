const fs = require('fs');
const logPath = 'C:\\Users\\p\\.gemini\\antigravity\\brain\\6bb409be-b1f5-42c3-bf97-16c53a5c71ef\\.system_generated\\logs\\transcript.jsonl';
const fileContent = fs.readFileSync(logPath, 'utf8');
const lines = fileContent.split('\n');

// Search for steps that contain the card rendering code without truncation
const searchTerms = ['installed_image_url', 'billboard_code', 'glass-drip-grad', 'dripping/melting'];

for (const line of lines) {
  if (!line.trim()) continue;
  const obj = JSON.parse(line);
  const content = obj.content || '';
  
  // Look for steps containing the card SVG glass drip gradient - this is unique to collage
  if (content.includes('glass-drip-grad') && !content.includes('<truncated')) {
    console.log(`Step ${obj.step_index} (type: ${obj.type}) has glass-drip-grad WITHOUT truncation, length: ${content.length}`);
  }
  if (content.includes('glass-drip-grad') && content.includes('<truncated')) {
    console.log(`Step ${obj.step_index} (type: ${obj.type}) has glass-drip-grad WITH truncation, length: ${content.length}`);
  }
}

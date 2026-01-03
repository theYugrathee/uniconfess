import fs from 'fs';
const content = fs.readFileSync('App.tsx', 'utf8').split(/\r?\n/);
const newContent = [...content.slice(0, 15), ...content.slice(373)].join('\n');
fs.writeFileSync('App.tsx', newContent);
console.log('Fixed App.tsx');

const fs = require('fs');

const files = ['src/App.tsx', 'src/AdminPanel.tsx'];

const replacements = [
  { regex: /bg-\[#0a0a0a\]/g, replace: 'bg-white dark:bg-[#0a0a0a]' },
  { regex: /bg-\[#111\]/g, replace: 'bg-white dark:bg-[#111]' },
  { regex: /bg-\[#1a1a1a\]/g, replace: 'bg-gray-100 dark:bg-[#1a1a1a]' },
  { regex: /bg-\[#151515\]/g, replace: 'bg-gray-50 dark:bg-[#151515]' },
  { regex: /border-\[#222\]/g, replace: 'border-gray-200 dark:border-[#222]' },
  { regex: /border-\[#333\]/g, replace: 'border-gray-300 dark:border-[#333]' },
  { regex: /border-dashed border-\[#333\]/g, replace: 'border-dashed border-gray-300 dark:border-[#333]' },
  { regex: /text-\[#e5e5e5\]/g, replace: 'text-gray-900 dark:text-[#e5e5e5]' },
  { regex: /text-\[#999\]/g, replace: 'text-gray-500 dark:text-[#999]' },
  { regex: /text-\[#666\]/g, replace: 'text-gray-400 dark:text-[#666]' },
  { regex: /text-white/g, replace: 'text-gray-900 dark:text-white' },
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  replacements.forEach(r => {
    content = content.replace(r.regex, r.replace);
  });
  
  // Revert common specific cases that shouldn't have changed text-white to text-gray-900
  // e.g., toast error bg is red, text should remain white
  content = content.replace(/bg-black\/80 text-gray-900 dark:text-white/g, 'bg-black/80 text-white');
  content = content.replace(/hover:text-gray-900 dark:text-white/g, 'hover:text-black dark:hover:text-white');
  
  fs.writeFileSync(file, content);
});

console.log('Colors replaced!');

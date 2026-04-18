// scripts/collect-routes.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DOMAIN_PATH = path.join(__dirname, '../domain');
const OUTPUT_PATH = path.join(__dirname, '../all-routes-combined.txt');

// Patterns to look for
const ROUTE_PATTERNS = [
  'router.get',
  'router.post', 
  'router.put',
  'router.delete',
  'router.patch',
  'router.use'
];

function collectRoutes(dir, output = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      collectRoutes(fullPath, output);
    } else if (item.endsWith('.routes.js') || item.endsWith('.route.js') || item === 'index.js') {
      output.push({
        file: fullPath,
        content: fs.readFileSync(fullPath, 'utf-8')
      });
    }
  }
  
  return output;
}

function combineRoutes(routeFiles) {
  let combined = `// ============================================\n`;
  combined += `// COMBINED ROUTES - Generated: ${new Date().toISOString()}\n`;
  combined += `// ============================================\n\n`;
  
  for (const routeFile of routeFiles) {
    combined += `\n// ============================================\n`;
    combined += `// FILE: ${path.relative(process.cwd(), routeFile.file)}\n`;
    combined += `// ============================================\n\n`;
    combined += routeFile.content;
    combined += `\n\n`;
  }
  
  return combined;
}

// Main execution
function main() {
  console.log('🔍 Scanning domain folder for route files...');
  
  const routeFiles = collectRoutes(DOMAIN_PATH);
  console.log(`📁 Found ${routeFiles.length} route files`);
  
  const combined = combineRoutes(routeFiles);
  fs.writeFileSync(OUTPUT_PATH, combined);
  
  console.log(`✅ Routes combined and saved to: ${OUTPUT_PATH}`);
  console.log(`📊 File size: ${(combined.length / 1024).toFixed(2)} KB`);
}

main();
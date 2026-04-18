// fix-imports.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_PATH = __dirname;

class ImportFixer {
  constructor() {
    this.stats = {
      filesScanned: 0,
      filesModified: 0,
      importsFixed: 0,
      skipped: 0,
      notFound: 0,
      errors: []
    };
    
    // Will hold the complete file structure
    this.fileIndexByPath = new Map(); // key: absolutePath, value: { relativePath, rootFolder, pathFromRoot, fileName }
    this.fileIndexByName = new Map(); // key: fileName, value: array of file info
    this.rootFolders = new Set();
    this.aliasMap = new Map();
  }

  isRelativePath(p) {
    return p.startsWith('./') || p.startsWith('../');
  }

  /**
   * Build complete file and folder structure of backend
   */
  async buildStructure() {
    console.log('📁 Building project structure...\n');
    
    // Get all files (excluding node_modules, .git, etc.)
    const files = await glob('**/*.js', {
      cwd: BACKEND_PATH,
      ignore: [
        'node_modules/**',
        '.git/**',
        'temp/**',
        'cache/**',
        'backups/**',
        'logs/**',
        'dist/**',
        'build/**',
        'coverage/**',
        '*.test.js',
        '*.spec.js'
      ],
      absolute: true,
      nodir: true
    });
    
    for (const absolutePath of files) {
      const relativePath = path.relative(BACKEND_PATH, absolutePath);
      const parts = relativePath.split(path.sep);
      const rootFolder = parts[0];
      const fileName = path.basename(absolutePath);
      
      // Track root folders
      if (rootFolder && !rootFolder.startsWith('.')) {
        this.rootFolders.add(rootFolder);
      }
      
      // Store the path WITHOUT the root folder for alias resolution
      const pathFromRoot = parts.slice(1).join('/');
      
      const fileInfo = {
        absolutePath: absolutePath,
        relativePath: relativePath,
        rootFolder: rootFolder,
        pathFromRoot: pathFromRoot,
        fileName: fileName,
        fullPath: relativePath
      };
      
      this.fileIndexByPath.set(absolutePath, fileInfo);
      
      // Index by filename (for searching)
      if (!this.fileIndexByName.has(fileName)) {
        this.fileIndexByName.set(fileName, []);
      }
      this.fileIndexByName.get(fileName).push(fileInfo);
    }
    
    // Build alias map based on ACTUAL root folders
    for (const folder of this.rootFolders) {
      this.aliasMap.set(folder, `#${folder}`);
    }
    
    console.log(`   Found ${this.fileIndexByPath.size} files`);
    console.log(`   Found ${this.rootFolders.size} root folders: ${[...this.rootFolders].join(', ')}`);
    console.log(`   Aliases: ${[...this.aliasMap.entries()].map(([k,v]) => `${k}->${v}`).join(', ')}\n`);
  }

  /**
   * Find a file by searching the entire structure
   */
  findFileByPath(absolutePath) {
    // Try exact match first
    let fileInfo = this.fileIndexByPath.get(absolutePath);
    if (fileInfo) return fileInfo;
    
    // Try with .js extension
    if (!absolutePath.endsWith('.js')) {
      fileInfo = this.fileIndexByPath.get(absolutePath + '.js');
      if (fileInfo) return fileInfo;
      
      // Try with /index.js
      fileInfo = this.fileIndexByPath.get(path.join(absolutePath, 'index.js'));
      if (fileInfo) return fileInfo;
    }
    
    return null;
  }

  /**
   * Search for a file by its name across the entire project
   */
  searchFileByName(fileName, originalPath, currentFileDir) {
    const candidates = this.fileIndexByName.get(fileName);
    
    if (!candidates || candidates.length === 0) {
      return null;
    }
    
    if (candidates.length === 1) {
      return candidates[0];
    }
    
    // Multiple candidates - try to find the most likely one
    // Prefer files that are in a similar path structure
    const currentParts = currentFileDir.split(path.sep);
    
    // Score each candidate
    const scored = candidates.map(candidate => {
      let score = 0;
      const candidateParts = candidate.relativePath.split(path.sep);
      
      // Higher score for same root folder
      if (candidate.rootFolder === currentParts[currentParts.length - 1]) {
        score += 10;
      }
      
      // Higher score for shorter path (closer to root)
      score -= candidateParts.length;
      
      return { candidate, score };
    });
    
    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);
    
    return scored[0].candidate;
  }

  /**
   * Get alias for a file based on its actual location
   */
  getAliasForFile(fileInfo) {
    if (!fileInfo) return null;
    
    const rootFolder = fileInfo.rootFolder;
    const alias = this.aliasMap.get(rootFolder);
    
    if (!alias) return null;
    
    // Build the import path WITHOUT duplicating the root folder
    const importPath = fileInfo.pathFromRoot 
      ? `${alias}/${fileInfo.pathFromRoot}`
      : alias;
    
    return importPath;
  }

  async processFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const currentFileDir = path.dirname(filePath);
      const relativeFilePath = path.relative(BACKEND_PATH, filePath);
      
      // Match import statements
      const importRegex = /from\s+['"](.+?)['"]/g;
      let newContent = content;
      let fileModified = false;
      
      const matches = [...content.matchAll(importRegex)];
      
      for (const match of matches) {
        const importPath = match[1];
        
        // Skip non-relative imports (npm packages, absolute paths)
        if (!this.isRelativePath(importPath)) {
          this.stats.skipped++;
          continue;
        }
        
        // Skip ./ imports - leave them as is
        if (importPath.startsWith('./')) {
          this.stats.skipped++;
          continue;
        }
        
        // Resolve to absolute path based on current file
        const resolvedAbsolutePath = path.resolve(currentFileDir, importPath);
        
        // Try to find the file by exact path resolution
        let fileInfo = this.findFileByPath(resolvedAbsolutePath);
        
        // If not found by exact path, try searching by filename
        if (!fileInfo) {
          const fileName = path.basename(importPath);
          fileInfo = this.searchFileByName(fileName, importPath, currentFileDir);
          
          if (fileInfo) {
            console.log(`   🔍 Found by search: ${importPath} -> ${fileInfo.relativePath}`);
          }
        }
        
        if (!fileInfo) {
          this.stats.notFound++;
          console.log(`❌ NOT FOUND: ${importPath} in ${relativeFilePath}`);
          console.log(`   Resolved to: ${resolvedAbsolutePath}`);
          console.log(`   Searched for filename: ${path.basename(importPath)}\n`);
          continue;
        }
        
        // Get the correct alias for this file
        const aliasPath = this.getAliasForFile(fileInfo);
        
        if (!aliasPath) {
          this.stats.errors.push({
            file: relativeFilePath,
            import: importPath,
            resolved: resolvedAbsolutePath,
            error: `No alias for root folder: ${fileInfo.rootFolder}`
          });
          continue;
        }
        
        // Only replace if different
        if (aliasPath !== importPath) {
          newContent = newContent.replace(importPath, aliasPath);
          fileModified = true;
          this.stats.importsFixed++;
          console.log(`✅ ${importPath} -> ${aliasPath} (in ${relativeFilePath})`);
        }
      }
      
      if (fileModified) {
        await fs.writeFile(filePath, newContent, 'utf8');
        this.stats.filesModified++;
      }
      
      this.stats.filesScanned++;
      
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
      this.stats.errors.push({
        file: filePath,
        error: error.message
      });
    }
  }

  async walkDirectory(dirPath) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        const skipDirs = ['node_modules', '.git', 'temp', 'cache', '__tests__', 'backups', 'logs', 'dist', 'build', 'coverage'];
        if (!skipDirs.includes(entry.name)) {
          await this.walkDirectory(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        await this.processFile(fullPath);
      }
    }
  }

  async run() {
    console.log('🔧 Import Fixer - Building from actual project structure\n');
    console.log('=' .repeat(70));
    
    // First, build the complete structure
    await this.buildStructure();
    
    console.log('=' .repeat(70));
    console.log('\n🔍 Scanning and fixing imports...\n');
    
    // Then process all files in domain
    const domainPath = path.join(BACKEND_PATH, 'domain');
    await this.walkDirectory(domainPath);
    
    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('\n📊 ========== FINAL SUMMARY ==========');
    console.log(`\n📁 STRUCTURE:`);
    console.log(`   Root folders found: ${[...this.rootFolders].join(', ')}`);
    console.log(`   Total files indexed: ${this.fileIndexByPath.size}`);
    
    console.log(`\n📝 RESULTS:`);
    console.log(`   Files scanned: ${this.stats.filesScanned}`);
    console.log(`   Files modified: ${this.stats.filesModified}`);
    console.log(`   Imports fixed: ${this.stats.importsFixed}`);
    console.log(`   Imports skipped (./ or npm): ${this.stats.skipped}`);
    console.log(`   Imports where file NOT found: ${this.stats.notFound}`);
    console.log(`   Errors: ${this.stats.errors.length}`);
    
    if (this.stats.notFound > 0) {
      console.log(`\n⚠️  WARNING: ${this.stats.notFound} imports could not be resolved.`);
      console.log(`   These imports were left unchanged. Check the logs above.`);
    }
    
    if (this.stats.errors.length > 0) {
      console.log(`\n❌ ERRORS:`);
      this.stats.errors.forEach(err => {
        console.log(`   - ${err.file}: ${err.error}`);
      });
    }
    
    console.log('\n✅ Done!\n');
  }
}

const fixer = new ImportFixer();
fixer.run().catch(console.error);
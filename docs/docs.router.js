import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Configuration
const CONFIG = {
    DOCS_ROOT: path.resolve('docs'),
    CACHE_TTL: 5 * 60 * 1000,
    ALLOWED_EXTENSIONS: new Set(['.md', '.mdx']),
    THEME: {
        light: {
            primary: '#3b82f6',
            secondary: '#8b5cf6',
            background: '#ffffff',
            sidebar: '#f8fafc',
            card: '#ffffff',
            text: '#1e293b',
            textSecondary: '#64748b',
            border: '#e2e8f0',
            accent: '#f59e0b'
        },
        dark: {
            primary: '#60a5fa',
            secondary: '#a78bfa',
            background: '#0f172a',
            sidebar: '#1e293b',
            card: '#1e293b',
            text: '#f1f5f9',
            textSecondary: '#94a3b8',
            border: '#334155',
            accent: '#fbbf24'
        }
    }
};

// Cache manager
class CacheManager {
    constructor() {
        this.cache = new Map();
    }

    get(key) {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > CONFIG.CACHE_TTL) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clear() {
        this.cache.clear();
    }
}

const cache = new CacheManager();

// Security utilities
class Security {
    static isValidPath(base, target) {
        const resolved = path.resolve(base, target);
        return resolved.startsWith(base + path.sep) || resolved === base;
    }

    static sanitizeFilename(filename) {
        return filename.replace(/[^a-zA-Z0-9._-]/g, '');
    }
}

// File system utilities
class FileSystem {
    static async readFileSafe(filepath) {
        try {
            return await fs.readFile(filepath, 'utf-8');
        } catch {
            return null;
        }
    }

    static async readYAMLFrontmatter(content) {
        const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (!match) return { meta: {}, content };

        try {
            const yamlContent = match[1];
            const meta = {};

            yamlContent.split('\n').forEach(line => {
                const match = line.match(/^(\w+):\s*(.*)$/);
                if (match) {
                    const [, key, value] = match;
                    if (value === 'true' || value === 'false') {
                        meta[key] = value === 'true';
                    } else if (!isNaN(value) && value.trim() !== '') {
                        meta[key] = Number(value);
                    } else {
                        meta[key] = value;
                    }
                }
            });

            return { meta, content: match[2] };
        } catch {
            return { meta: {}, content: match[2] };
        }
    }

    static async getFileStats(filepath) {
        try {
            const stats = await fs.stat(filepath);
            return {
                exists: true,
                isDirectory: stats.isDirectory(),
                size: stats.size,
                modified: stats.mtime
            };
        } catch {
            return { exists: false };
        }
    }
}

// Document processor
class DocumentProcessor {
    constructor() {
        this.setupRenderer();
    }

    setupRenderer() {
        const renderer = new marked.Renderer();
        renderError.heading = (tokens, depth) => {
            const text = tokens.text;
            const slugger = new marked.Slugger();
            const id = slugger.slug(text);
            return `
        <h${depth} id="${id}" class="heading-link">
            <a href="#${id}" class="heading-anchor">#</a>
            ${text}
        </h${depth}>
      `;
        };

        // Fixed code renderer
        renderer.code = ({ text, lang, isEscaped }) => {
            const validLang = lang || 'text';
            // Handle the code parameter - it should be a string
            const codeString = typeof text === 'string' ? text : String(text);
            const encoded = Buffer.from(codeString).toString('base64');
            return `
        <div class="code-block">
          <div class="code-header">
            <span class="language">${validLang}</span>
            <button class="copy-btn" data-code="${encoded}">
              <i class="far fa-copy"></i> Copy
            </button>
          </div>
          <pre><code class="language-${validLang}">${codeString}</code></pre>
        </div>
      `;
        };

        // Custom horizontal rule
        renderer.hr = () => {
            return `<hr class="custom-hr"/>`;
        };
        // Custom blockquote
        renderer.blockquote = ({tokens}) => {
            const content = tokens.map(token => token.text).join('');
            return `<blockquote class="custom-blockquote">${marked.parse(content)}</blockquote>`;
        };

        // Custom table
        renderer.table = ({ header, rows, align }) => {
            return `
        <div class="table-container">
          <table class="docs-table">
            <thead>
              <tr>
            ${header.map((cell, i) => `
              <th style="text-align: ${align[i] || 'left'}">
                ${marked.parse(cell.text)}
              </th>
            `).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
            <tr>
              ${row.map((cell, i) => `
                <td style="text-align: ${align[i] || 'left'}">
                  ${marked.parse(cell.text)}
                </td>
              `).join('')}
            </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
            `;
        };
        // Custom link
        renderer.link = (href, title, text) => {
            const isExternal = href.startsWith('http');
            const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
            const externalIcon = isExternal ? ' <i class="fas fa-external-link-alt external-icon"></i>' : '';
            return `<a href="${href}"${target} class="docs-link">${text}${externalIcon}</a>`;
        };

        marked.setOptions({
            renderer,
            gfm: true,
            breaks: true,
            pedantic: false,
            smartLists: true,
            smartypants: true
        });
    }

    async processMarkdown(content) {
        const { meta, content: markdownContent } = await FileSystem.readYAMLFrontmatter(content);

        const html = marked.parse(markdownContent);

        return {
            html,
            meta
        };
    }
}


// Sidebar builder
class SidebarBuilder {
    async buildTree(dir, basePath = '') {
        const cacheKey = `sidebar:${dir}:${basePath}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        try {
            const files = await fs.readdir(dir);
            const items = [];

            for (const name of files) {
                if (name.startsWith('.')) continue;

                const fullPath = path.join(dir, name);
                const relativePath = path.join(basePath, name);
                const stats = await FileSystem.getFileStats(fullPath);

                if (!stats.exists) continue;

                const isDir = stats.isDirectory;
                let meta = {};
                let order = items.length;

                if (!isDir && CONFIG.ALLOWED_EXTENSIONS.has(path.extname(name))) {
                    const content = await FileSystem.readFileSafe(fullPath);
                    if (content) {
                        const result = await FileSystem.readYAMLFrontmatter(content);
                        meta = result.meta;
                        order = result.meta?.order || order;
                    }
                }

                const item = {
                    id: Buffer.from(relativePath).toString('base64'),
                    name: path.basename(name, path.extname(name)),
                    type: isDir ? 'dir' : 'file',
                    path: relativePath,
                    order,
                    meta
                };

                if (isDir) {
                    item.children = await this.buildTree(fullPath, relativePath);
                }

                items.push(item);
            }

            items.sort((a, b) => {
                if (a.order !== b.order) return (a.order || 0) - (b.order || 0);
                return a.name.localeCompare(b.name);
            });

            cache.set(cacheKey, items);
            return items;
        } catch (error) {
            console.error('Error building sidebar:', error);
            return [];
        }
    }

    renderSidebar(items, currentPath, depth = 0) {
        if (!items.length) return '';

        return `
      <ul class="sidebar-list depth-${depth}">
        ${items.map(item => {
            const isActive = item.path === currentPath;
            const hasChildren = item.children && item.children.length > 0;
            const displayName = item.meta?.title || item.name;

            let html = '';
            if (item.type === 'dir') {
                const icon = item.meta?.icon || '📁';
                html = `
              <li class="sidebar-item dir ${isActive ? 'active' : ''}">
                <details ${depth === 0 ? 'open' : ''}>
                  <summary>
                    <span class="icon">${icon}</span>
                    <span class="name">${displayName}</span>
                    ${item.meta?.count ? `<span class="count">${item.meta.count}</span>` : ''}
                  </summary>
                  ${hasChildren ? this.renderSidebar(item.children, currentPath, depth + 1) : ''}
                </details>
              </li>
            `;
            } else {
                const icon = item.meta?.icon || '📄';
                html = `
              <li class="sidebar-item file ${isActive ? 'active' : ''}">
                <a href="/docs/${item.path.replace(/\.md$/, '')}" 
                   class="sidebar-link ${isActive ? 'active' : ''}"
                   data-path="${item.path}"
                   data-title="${displayName}">
                  <span class="icon">${icon}</span>
                  <span class="name">${displayName}</span>
                  ${item.meta?.status ? `<span class="badge ${item.meta.status}">${item.meta.status}</span>` : ''}
                </a>
              </li>
            `;
            }
            return html;
        }).join('')}
      </ul>
    `;
    }
}

// Main renderer
class PageRenderer {
    constructor() {
        this.sidebarBuilder = new SidebarBuilder();
        this.docProcessor = new DocumentProcessor();
    }

    async renderPage(requestedPath, resolvedPath, isDir, isPartial = false) {
        if (isPartial) {
            return await this.renderPartialContent(requestedPath, resolvedPath, isDir);
        }

        const cacheKey = `page:${requestedPath}:${isDir}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;

        const sidebarItems = await this.sidebarBuilder.buildTree(CONFIG.DOCS_ROOT);
        const sidebarHTML = this.sidebarBuilder.renderSidebar(sidebarItems, requestedPath);

        let contentHTML = '';
        let title = 'Bride Gap API Docs';
        let meta = {};

        if (isDir) {
            const indexFile = path.join(resolvedPath, 'index.md');
            const indexContent = await FileSystem.readFileSafe(indexFile);

            if (indexContent) {
                const processed = await this.docProcessor.processMarkdown(indexContent);
                contentHTML = processed.html;
                meta = processed.meta;
                title = meta.title || path.basename(requestedPath) || 'Documentation';
            } else {
                const files = await fs.readdir(resolvedPath);
                contentHTML = this.renderDirectoryView(requestedPath, files);
                title = requestedPath || 'Documentation';
            }
        } else {
            const fileContent = await FileSystem.readFileSafe(resolvedPath);
            if (fileContent) {
                const processed = await this.docProcessor.processMarkdown(fileContent);
                contentHTML = processed.html;
                meta = processed.meta;
                title = meta.title || path.basename(requestedPath, path.extname(requestedPath));
            }
        }

        const page = this.generateFullPage(title, sidebarHTML, contentHTML, meta);
        cache.set(cacheKey, page);
        return page;
    }

    async renderPartialContent(requestedPath, resolvedPath, isDir) {
        let contentHTML = '';
        let title = 'Bride Gap API Docs';
        let meta = {};

        if (isDir) {
            const indexFile = path.join(resolvedPath, 'index.md');
            const indexContent = await FileSystem.readFileSafe(indexFile);

            if (indexContent) {
                const processed = await this.docProcessor.processMarkdown(indexContent);
                contentHTML = processed.html;
                meta = processed.meta;
                title = meta.title || path.basename(requestedPath) || 'Documentation';
            } else {
                const files = await fs.readdir(resolvedPath);
                contentHTML = this.renderDirectoryView(requestedPath, files);
                title = requestedPath || 'Documentation';
            }
        } else {
            const fileContent = await FileSystem.readFileSafe(resolvedPath);
            if (fileContent) {
                const processed = await this.docProcessor.processMarkdown(fileContent);
                contentHTML = processed.html;
                meta = processed.meta;
                title = meta.title || path.basename(requestedPath, path.extname(requestedPath));
            }
        }

        return JSON.stringify({
            title,
            content: contentHTML,
            meta,
            requestedPath,
            isDir
        });
    }

    renderDirectoryView(dirPath, files) {
        return `
      <div class="directory-view">
        <h1><i class="fas fa-folder-open"></i> ${dirPath || 'Root Directory'}</h1>
        <p class="directory-description">Browse through the documentation files</p>
        <div class="file-grid">
          ${files.map(file => {
            const ext = path.extname(file);
            const isMarkdown = CONFIG.ALLOWED_EXTENSIONS.has(ext);
            const icon = isMarkdown ? '<i class="fas fa-file-alt"></i>' : '<i class="fas fa-folder"></i>';
            const typeClass = isMarkdown ? 'file' : 'folder';
            return `
              <a href="/docs/${path.join(dirPath, file)}" class="file-item ${typeClass}">
                <div class="file-icon">${icon}</div>
                <div class="file-info">
                  <div class="file-name">${file}</div>
                  <div class="file-type">${isMarkdown ? 'Markdown Document' : 'Folder'}</div>
                </div>
              </a>
            `;
        }).join('')}
        </div>
      </div>
    `;
    }

    generateFullPage(title, sidebar, content, meta) {
        return `
      <!DOCTYPE html>
      <html lang="en" class="light-theme">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} | Bride Gap API Docs</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
        <style>
          :root {
            /* Light theme variables */
            --primary: ${CONFIG.THEME.light.primary};
            --secondary: ${CONFIG.THEME.light.secondary};
            --background: ${CONFIG.THEME.light.background};
            --sidebar-bg: ${CONFIG.THEME.light.sidebar};
            --card: ${CONFIG.THEME.light.card};
            --text: ${CONFIG.THEME.light.text};
            --text-secondary: ${CONFIG.THEME.light.textSecondary};
            --border: ${CONFIG.THEME.light.border};
            --accent: ${CONFIG.THEME.light.accent};
            --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            --radius: 12px;
          }

          .dark-theme {
            --primary: ${CONFIG.THEME.dark.primary};
            --secondary: ${CONFIG.THEME.dark.secondary};
            --background: ${CONFIG.THEME.dark.background};
            --sidebar-bg: ${CONFIG.THEME.dark.sidebar};
            --card: ${CONFIG.THEME.dark.card};
            --text: ${CONFIG.THEME.dark.text};
            --text-secondary: ${CONFIG.THEME.dark.textSecondary};
            --border: ${CONFIG.THEME.dark.border};
            --accent: ${CONFIG.THEME.dark.accent};
            --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.4);
            color-scheme: dark;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: var(--background);
            color: var(--text);
            transition: all 0.3s ease;
            min-height: 100vh;
            display: flex;
          }

          .sidebar {
            width: 300px;
            background-color: var(--sidebar-bg);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            overflow-y: auto;
            z-index: 100;
          }

          .sidebar-header {
            padding: 1.5rem;
            border-bottom: 1px solid var(--border);
            background-color: var(--card);
            position: sticky;
            top: 0;
            z-index: 10;
          }

          .logo {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 0.5rem;
          }

          .logo-icon {
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 1.25rem;
          }

          .logo-text h1 {
            font-size: 1.25rem;
            font-weight: 700;
            color: var(--text);
            margin: 0;
          }

          .logo-text p {
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin: 0;
          }

          .sidebar-content {
            padding: 1rem;
            flex: 1;
          }

          .sidebar-list {
            list-style: none;
          }

          .sidebar-item {
            margin-bottom: 0.25rem;
          }
          
          .custom-hr {
            height: 1px;
            background-color: var(--primary);
            border: none;
            margin: 1rem 0;
          }

          .sidebar-link {
            display: flex;
            align-items: center;
            padding: 0.75rem 1rem;
            border-radius: var(--radius);
            color: var(--text);
            text-decoration: none;
            transition: all 0.2s ease;
            gap: 0.75rem;
            font-size: 0.9375rem;
          }

          .sidebar-link:hover {
            background-color: var(--background);
            transform: translateX(4px);
          }

          .sidebar-item.active .sidebar-link {
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white;
            font-weight: 600;
            box-shadow: var(--shadow);
          }

          .sidebar-item.dir summary {
            cursor: pointer;
            padding: 0.75rem 1rem;
            border-radius: var(--radius);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            transition: all 0.2s ease;
            user-select: none;
            list-style: none;
          }

          .sidebar-item.dir summary::-webkit-details-marker {
            display: none;
          }

          .sidebar-item.dir summary:after {
            content: '›';
            margin-left: auto;
            transition: transform 0.2s ease;
          }

          .sidebar-item.dir details[open] summary:after {
            transform: rotate(90deg);
          }

          .sidebar-item.dir summary:hover {
            background-color: var(--background);
          }

          .sidebar-list.depth-1 {
            margin-left: 1.5rem;
            margin-top: 0.5rem;
          }

          .icon {
            font-size: 1.125rem;
            width: 20px;
            text-align: center;
          }

          .badge {
            font-size: 0.6875rem;
            padding: 0.2rem 0.5rem;
            border-radius: 20px;
            margin-left: auto;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .badge.draft { background-color: #fbbf24; color: #000; }
          .badge.review { background-color: var(--primary); color: white; }
          .badge.done { background-color: #10b981; color: white; }
          .badge.new { background-color: var(--secondary); color: white; }

          .count {
            background-color: var(--background);
            color: var(--text-secondary);
            font-size: 0.75rem;
            padding: 0.125rem 0.5rem;
            border-radius: 10px;
            margin-left: auto;
          }

          .main {
            flex: 1;
            margin-left: 300px;
            padding: 2rem 3rem;
            max-width: 900px;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 3rem;
            padding-bottom: 1.5rem;
            border-bottom: 2px solid var(--border);
          }

          .header h1 {
            font-size: 2.5rem;
            font-weight: 800;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin: 0;
          }

          .theme-toggle {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }

          .theme-btn {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--card);
            border: 1px solid var(--border);
            color: var(--text);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
            transition: all 0.3s ease;
          }

          .theme-btn:hover {
            transform: rotate(30deg);
            box-shadow: var(--shadow);
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white;
          }

          .moon-icon {
            display: none;
          }

          .dark-theme .sun-icon {
            display: none;
          }

          .dark-theme .moon-icon {
            display: inline;
          }

          .content {
            line-height: 1.8;
            font-size: 1.125rem;
          }

          .content h1, .content h2, .content h3, .content h4 {
            margin-top: 2.5rem;
            margin-bottom: 1.25rem;
            font-weight: 700;
          }

          .content h1 { 
            font-size: 2.5rem; 
            border-bottom: 3px solid var(--primary);
            padding-bottom: 0.5rem;
          }
          .content h2 { 
            font-size: 2rem; 
            color: var(--text);
          }
          .content h3 { 
            font-size: 1.5rem; 
            color: var(--text-secondary);
          }

          .heading-link {
            position: relative;
            scroll-margin-top: 2rem;
          }

          .heading-anchor {
            position: absolute;
            left: -1.75rem;
            opacity: 0;
            transition: all 0.2s ease;
            text-decoration: none;
            color: var(--primary);
            font-size: 1.25rem;
          }

          .heading-link:hover .heading-anchor {
            opacity: 1;
            transform: scale(1.1);
          }

          .code-block {
            background: var(--card);
            border-radius: var(--radius);
            overflow: hidden;
            margin: 2rem 0;
            border: 1px solid var(--border);
            box-shadow: var(--shadow);
          }

          .code-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem 1.5rem;
            background-color: var(--sidebar-bg);
            border-bottom: 1px solid var(--border);
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.875rem;
          }

          .copy-btn {
            background: var(--background);
            color: var(--text);
            border: 1px solid var(--border);
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.875rem;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .copy-btn:hover {
            background: var(--primary);
            color: white;
            border-color: var(--primary);
            transform: translateY(-2px);
          }

          .copy-btn.copied {
            background: #10b981;
            color: white;
            border-color: #10b981;
          }

          pre code {
            display: block;
            padding: 1.5rem;
            overflow-x: auto;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9375rem;
            line-height: 1.6;
          }

          .directory-view {
            padding: 1rem 0;
          }

          .directory-description {
            color: var(--text-secondary);
            margin-bottom: 2rem;
            font-size: 1.125rem;
          }

          .file-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 1.25rem;
            margin-top: 2rem;
          }

          .file-item {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 1.5rem;
            text-decoration: none;
            color: var(--text);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 1rem;
            box-shadow: var(--shadow);
          }

          .file-item:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
            border-color: var(--primary);
          }

          .file-item.folder:hover {
            border-color: var(--secondary);
          }

          .file-icon {
            font-size: 1.5rem;
            color: var(--primary);
          }

          .file-item.folder .file-icon {
            color: var(--secondary);
          }

          .file-info {
            flex: 1;
          }

          .file-name {
            font-weight: 600;
            margin-bottom: 0.25rem;
          }

          .file-type {
            font-size: 0.875rem;
            color: var(--text-secondary);
          }

          .custom-blockquote {
            border-left: 4px solid var(--primary);
            padding: 1.5rem 2rem;
            margin: 2rem 0;
            background: var(--sidebar-bg);
            border-radius: 0 var(--radius) var(--radius) 0;
            font-style: italic;
            position: relative;
          }

          .custom-blockquote:before {
            content: '"';
            position: absolute;
            top: -0.5rem;
            left: 0.5rem;
            font-size: 3rem;
            color: var(--primary);
            opacity: 0.2;
            font-family: serif;
          }

          .table-container {
            overflow-x: auto;
            margin: 2rem 0;
            border-radius: var(--radius);
            border: 1px solid var(--border);
          }

          .docs-table {
            width: 100%;
            border-collapse: collapse;
          }

          .docs-table th {
            background-color: var(--sidebar-bg);
            color: var(--text);
            padding: 1rem;
            text-align: left;
            font-weight: 600;
            border-bottom: 2px solid var(--border);
          }

          .docs-table td {
            padding: 1rem;
            border-bottom: 1px solid var(--border);
            background-color: var(--card);
          }

          .docs-table tr:hover td {
            background-color: var(--sidebar-bg);
          }

          .docs-link {
            color: var(--primary);
            text-decoration: none;
            font-weight: 500;
            transition: all 0.2s ease;
            border-bottom: 1px solid transparent;
          }

          .docs-link:hover {
            border-bottom-color: var(--primary);
          }

          .external-icon {
            font-size: 0.75em;
            margin-left: 0.25rem;
            opacity: 0.7;
          }

          .breadcrumb {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 2rem;
            padding: 1rem;
            background: var(--card);
            border-radius: var(--radius);
            border: 1px solid var(--border);
            font-size: 0.9375rem;
          }

          .breadcrumb a {
            color: var(--text-secondary);
            text-decoration: none;
            transition: color 0.2s ease;
          }

          .breadcrumb a:hover {
            color: var(--primary);
          }

          .breadcrumb-separator {
            color: var(--text-secondary);
          }

          .loading {
            display: none;
            position: fixed;
            top: 0;
            left: 300px;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, var(--primary), var(--secondary));
            z-index: 1000;
            animation: loading 1s infinite;
          }

          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }

          .loading.active {
            display: block;
          }

          @media (max-width: 1024px) {
            .sidebar {
              width: 280px;
            }
            
            .main {
              margin-left: 280px;
              padding: 1.5rem;
            }
            
            .loading {
              left: 280px;
            }
          }

          @media (max-width: 768px) {
            .sidebar {
              transform: translateX(-100%);
              transition: transform 0.3s ease;
              width: 280px;
            }
            
            .sidebar.open {
              transform: translateX(0);
            }
            
            .main {
              margin-left: 0;
              padding: 1rem;
            }
            
            .loading {
              left: 0;
            }
            
            .menu-toggle {
              display: block;
              position: fixed;
              top: 1rem;
              left: 1rem;
              z-index: 1000;
              background: var(--card);
              border: 1px solid var(--border);
              border-radius: var(--radius);
              padding: 0.75rem;
              cursor: pointer;
              font-size: 1.25rem;
              color: var(--text);
            }
            
            .header h1 {
              font-size: 2rem;
            }
            
            .file-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 480px) {
            .content {
              font-size: 1rem;
            }
            
            .content h1 { font-size: 2rem; }
            .content h2 { font-size: 1.5rem; }
            .content h3 { font-size: 1.25rem; }
            
            .header {
              flex-direction: column;
              align-items: flex-start;
              gap: 1rem;
            }
            
            .theme-toggle {
              align-self: flex-end;
            }
          }

          /* Animations */
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .content > * {
            animation: fadeIn 0.3s ease-out forwards;
            opacity: 0;
          }

          .content > *:nth-child(1) { animation-delay: 0.1s; }
          .content > *:nth-child(2) { animation-delay: 0.2s; }
          .content > *:nth-child(3) { animation-delay: 0.3s; }
          .content > *:nth-child(4) { animation-delay: 0.4s; }
          .content > *:nth-child(5) { animation-delay: 0.5s; }

          /* Scrollbar styling */
          ::-webkit-scrollbar {
            width: 10px;
            height: 10px;
          }

          ::-webkit-scrollbar-track {
            background: var(--sidebar-bg);
          }

          ::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 5px;
          }

          ::-webkit-scrollbar-thumb:hover {
            background: var(--text-secondary);
          }
        </style>
      </head>
      <body>
        <div class="loading" id="loading"></div>
        <button class="menu-toggle" id="menu-toggle" aria-label="Toggle menu">
          <i class="fas fa-bars"></i>
        </button>

        <nav class="sidebar" id="sidebar">
          <div class="sidebar-header">
            <div class="logo">
              <div class="logo-icon">
                <i class="fas fa-bridge"></i>
              </div>
              <div class="logo-text">
                <h1>Bride Gap API</h1>
                <p>Comprehensive Documentation</p>
              </div>
            </div>
          </div>
          <div class="sidebar-content">
            ${sidebar}
          </div>
        </nav>

        <main class="main">
          <header class="header">
            <h1 id="page-title">${title}</h1>
            <div class="theme-toggle">
              <button id="theme-btn" class="theme-btn" aria-label="Toggle theme">
                <span class="sun-icon"><i class="fas fa-sun"></i></span>
                <span class="moon-icon"><i class="fas fa-moon"></i></span>
              </button>
            </div>
          </header>
          
          ${meta.breadcrumb ? this.renderBreadcrumb(meta.breadcrumb) : ''}
          
          <article class="content" id="content">
            ${content}
          </article>
        </main>

        <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
        <script>
          // Theme toggle
          const themeBtn = document.getElementById('theme-btn');
          const htmlEl = document.documentElement;
          const loadingEl = document.getElementById('loading');
          
          // Load saved theme
          const savedTheme = localStorage.getItem('bridegap-theme') || 'light';
          if (savedTheme === 'dark') {
            htmlEl.classList.remove('light-theme');
            htmlEl.classList.add('dark-theme');
          }
          
          themeBtn.addEventListener('click', () => {
            const isDark = htmlEl.classList.contains('dark-theme');
            
            if (isDark) {
              htmlEl.classList.remove('dark-theme');
              htmlEl.classList.add('light-theme');
              localStorage.setItem('bridegap-theme', 'light');
            } else {
              htmlEl.classList.remove('light-theme');
              htmlEl.classList.add('dark-theme');
              localStorage.setItem('bridegap-theme', 'dark');
            }
            
            // Add animation effect
            themeBtn.style.transform = 'rotate(180deg) scale(1.2)';
            setTimeout(() => {
              themeBtn.style.transform = '';
            }, 300);
          });

          // Copy button functionality
          document.addEventListener('click', (e) => {
            if (e.target.classList.contains('copy-btn') || e.target.closest('.copy-btn')) {
              const btn = e.target.classList.contains('copy-btn') ? e.target : e.target.closest('.copy-btn');
              const code = atob(btn.dataset.code);
              
              navigator.clipboard.writeText(code).then(() => {
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                btn.classList.add('copied');
                
                setTimeout(() => {
                  btn.innerHTML = originalHTML;
                  btn.classList.remove('copied');
                }, 2000);
              }).catch(err => {
                console.error('Failed to copy:', err);
                btn.innerHTML = '<i class="fas fa-times"></i> Error';
                setTimeout(() => {
                  btn.innerHTML = originalHTML;
                }, 2000);
              });
            }
          });

          // Syntax highlighting
          if (typeof hljs !== 'undefined') {
            hljs.highlightAll();
          }

          // Smooth scrolling for anchor links
          document.addEventListener('click', (e) => {
            if (e.target.classList.contains('heading-anchor')) {
              e.preventDefault();
              const id = e.target.getAttribute('href').slice(1);
              const element = document.getElementById(id);
              if (element) {
                element.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start'
                });
                
                // Highlight effect
                element.style.backgroundColor = 'rgba(var(--primary-rgb, 59, 130, 246), 0.1)';
                setTimeout(() => {
                  element.style.backgroundColor = '';
                }, 1000);
              }
            }
          });

          // Mobile menu toggle
          const menuToggle = document.getElementById('menu-toggle');
          const sidebar = document.getElementById('sidebar');
          
          if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
              sidebar.classList.toggle('open');
            });
            
            // Close sidebar when clicking outside on mobile
            document.addEventListener('click', (e) => {
              if (window.innerWidth <= 768) {
                if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                  sidebar.classList.remove('open');
                }
              }
            });
          }

          // Auto-expand sidebar items for current path
          const activeItems = document.querySelectorAll('.sidebar-item.active');
          activeItems.forEach(item => {
            let parent = item.parentElement.closest('details');
            while (parent) {
              parent.open = true;
              parent = parent.parentElement.closest('details');
            }
          });

          // Keyboard shortcuts
          document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + / to toggle theme
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
              e.preventDefault();
              themeBtn.click();
            }
            
            // Escape to close mobile menu
            if (e.key === 'Escape' && window.innerWidth <= 768) {
              sidebar.classList.remove('open');
            }
          });

          // Initialize theme colors for CSS variables
          function updateThemeColors() {
            const computedStyle = getComputedStyle(document.documentElement);
            const primary = computedStyle.getPropertyValue('--primary').trim();
            document.documentElement.style.setProperty('--primary-rgb', hexToRgb(primary));
          }

          function hexToRgb(hex) {
            hex = hex.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return \`\${r}, \${g}, \${b}\`;
          }

          // Initialize on load
          updateThemeColors();
          
          // Update when theme changes
          themeBtn.addEventListener('click', () => {
            setTimeout(updateThemeColors, 50);
          });

          // Client-side navigation system
          class ClientSideNavigation {
            constructor() {
              this.isInitialLoad = true;
              this.currentPath = window.location.pathname.replace('/docs', '').replace(/^\\//, '') || '';
              this.init();
            }

            init() {
              // Add click handlers to sidebar links
              this.setupSidebarLinks();
              
              // Handle browser back/forward
              window.addEventListener('popstate', (e) => {
                if (e.state) {
                  this.loadContent(e.state.path, false);
                }
              });
            }

            setupSidebarLinks() {
              document.addEventListener('click', (e) => {
                const sidebarLink = e.target.closest('.sidebar-link');
                if (sidebarLink && sidebarLink.classList.contains('sidebar-link')) {
                  e.preventDefault();
                  
                  const path = sidebarLink.getAttribute('data-path');
                  const title = sidebarLink.getAttribute('data-title');
                  
                  if (path) {
                    this.navigateTo(path, title);
                  }
                }
                
                // Handle directory links
                const fileItem = e.target.closest('.file-item');
                if (fileItem && fileItem.classList.contains('file-item')) {
                  e.preventDefault();
                  
                  const href = fileItem.getAttribute('href');
                  if (href) {
                    const path = href.replace('/docs/', '');
                    this.navigateTo(path);
                  }
                }
              });
            }

            async navigateTo(path, title = null) {
              // Update URL without full page reload
              const fullPath = '/docs/' + (path.endsWith('.md') ? path.replace(/\.md$/, '') : path);
              window.history.pushState({ path }, title || path, fullPath);
              
              // Load content
              await this.loadContent(path, true);
              
              // Update active state in sidebar
              this.updateSidebarActiveState(path);
              
              // Close mobile menu if open
              if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
              }
              
              // Scroll to top
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            async loadContent(path, showLoading = true) {
              try {
                if (showLoading) {
                  loadingEl.classList.add('active');
                }
                
                const response = await fetch(\`/docs/api/content?path=\${encodeURIComponent(path)}\`, {
                  headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                  }
                });
                
                if (!response.ok) {
                  throw new Error('Failed to load content');
                }
                
                const data = await response.json();
                
                // Update page title
                document.title = \`\${data.title} | Bride Gap API Docs\`;
                document.getElementById('page-title').textContent = data.title;
                
                // Update content with animation
                const contentEl = document.getElementById('content');
                contentEl.style.opacity = '0';
                contentEl.style.transition = 'opacity 0.3s ease';
                
                setTimeout(() => {
                  contentEl.innerHTML = data.content;
                  
                  // Update breadcrumb if exists
                  const breadcrumbEl = document.querySelector('.breadcrumb');
                  if (data.meta?.breadcrumb && breadcrumbEl) {
                    breadcrumbEl.innerHTML = this.renderBreadcrumb(data.meta.breadcrumb);
                  } else if (data.meta?.breadcrumb) {
                    // Create breadcrumb if it doesn't exist
                    const header = document.querySelector('.header');
                    const breadcrumb = document.createElement('nav');
                    breadcrumb.className = 'breadcrumb';
                    breadcrumb.innerHTML = this.renderBreadcrumb(data.meta.breadcrumb);
                    header.after(breadcrumb);
                  } else if (breadcrumbEl) {
                    breadcrumbEl.remove();
                  }
                  
                  // Reinitialize syntax highlighting
                  if (typeof hljs !== 'undefined') {
                    hljs.highlightAll();
                  }
                  
                  // Reinitialize animations
                  this.initializeContentAnimations();
                  
                  contentEl.style.opacity = '1';
                  
                  // Update current path
                  this.currentPath = data.requestedPath;
                  
                  // Remove loading indicator
                  if (showLoading) {
                    setTimeout(() => {
                      loadingEl.classList.remove('active');
                    }, 300);
                  }
                }, 300);
                
              } catch (error) {
                console.error('Error loading content:', error);
                loadingEl.classList.remove('active');
                
                // Fallback to full page reload
                window.location.href = '/docs/' + path;
              }
            }

            updateSidebarActiveState(path) {
              // Remove active class from all items
              document.querySelectorAll('.sidebar-item').forEach(item => {
                item.classList.remove('active');
              });
              
              // Add active class to current item
              const activeLink = document.querySelector(\`.sidebar-link[data-path="\${path}"]\`);
              if (activeLink) {
                activeLink.closest('.sidebar-item').classList.add('active');
                
                // Expand parent directories
                let parent = activeLink.closest('details');
                while (parent) {
                  parent.open = true;
                  parent = parent.parentElement.closest('details');
                }
              }
            }

            renderBreadcrumb(paths) {
              const items = paths.map((path, index) => {
                if (index === paths.length - 1) {
                  return \`<span class="breadcrumb-current">\${path.name}</span>\`;
                }
                return \`<a href="\${path.url}">\${path.name}</a>\`;
              }).join('<span class="breadcrumb-separator">/</span>');
              
              return items;
            }

            initializeContentAnimations() {
              const contentItems = document.querySelectorAll('#content > *');
              contentItems.forEach((item, index) => {
                item.style.animationDelay = \`\${0.1 + index * 0.1}s\`;
                item.style.animation = 'fadeIn 0.3s ease-out forwards';
                item.style.opacity = '0';
              });
            }
          }

          // Initialize client-side navigation
          const navigation = new ClientSideNavigation();
        </script>
      </body>
      </html>
    `;
    }

    renderBreadcrumb(paths) {
        const items = paths.map((path, index) => {
            if (index === paths.length - 1) {
                return `<span class="breadcrumb-current">${path.name}</span>`;
            }
            return `<a href="${path.url}">${path.name}</a>`;
        }).join('<span class="breadcrumb-separator">/</span>');

        return `<nav class="breadcrumb">${items}</nav>`;
    }
}

// Main route handler
const pageRenderer = new PageRenderer();

router.get(/^\/(.*)$/, async (req, res) => {
    try {
        // Check if it's a content API request
        if (req.path === '/api/content' && req.get('X-Requested-With') === 'XMLHttpRequest') {
            const requestedPath = req.query.path || '';
            
            if (!Security.isValidPath(CONFIG.DOCS_ROOT, requestedPath)) {
                return res.status(403).json({ error: 'Access Denied' });
            }

            const resolvedPath = path.resolve(CONFIG.DOCS_ROOT, requestedPath);
            const stats = await FileSystem.getFileStats(resolvedPath);

            if (!stats.exists) {
                // Try appending .md extension
                const mdPath = resolvedPath + '.md';
                const mdStats = await FileSystem.getFileStats(mdPath);
                if (mdStats.exists && !mdStats.isDirectory) {
                    const content = await pageRenderer.renderPartialContent(requestedPath + '.md', mdPath, false);
                    return res.send(content);
                }
                return res.status(404).json({ error: 'Document not found' });
            }

            const isDir = stats.isDirectory;
            const content = await pageRenderer.renderPartialContent(requestedPath, resolvedPath, isDir);
            return res.send(content);
        }

        // Regular page request
        let requestedPath = (req.params[0] || '').replace(/^\/+/, '');

        if (!Security.isValidPath(CONFIG.DOCS_ROOT, requestedPath)) {
            return res.status(403).send(this.renderError('Access Denied', 'Invalid path requested.', 403));
        }

        const resolvedPath = path.resolve(CONFIG.DOCS_ROOT, requestedPath);
        const stats = await FileSystem.getFileStats(resolvedPath);

        if (!stats.exists) {
            // Try appending .md extension
            const mdPath = resolvedPath + '.md';
            const mdStats = await FileSystem.getFileStats(mdPath);
            if (mdStats.exists && !mdStats.isDirectory) {
                const page = await pageRenderer.renderPage(requestedPath + '.md', mdPath, false);
                return res.send(page);
            }
            return res.status(404).send(this.renderError('404 - Not Found', `Document not found: ${requestedPath}`, 404));
        }

        if (stats.isDirectory) {
            const page = await pageRenderer.renderPage(requestedPath, resolvedPath, true);
            return res.send(page);
        }

        if (!CONFIG.ALLOWED_EXTENSIONS.has(path.extname(requestedPath))) {
            return res.status(400).send(this.renderError('Bad Request', 'Only markdown files are allowed.', 400));
        }

        const page = await pageRenderer.renderPage(requestedPath, resolvedPath, false);
        return res.send(page);

    } catch (error) {
        console.error('Error serving docs:', error);
        return res.status(500).send(this.renderError('500 - Server Error', error.message, 500));
    }
});

// Helper function to render error pages
function renderError(title, message, code) {
    const isDark = Math.random() > 0.5; // Simple fallback
    const theme = isDark ? CONFIG.THEME.dark : CONFIG.THEME.light;

    return `
    <!DOCTYPE html>
    <html lang="en" class="${isDark ? 'dark-theme' : 'light-theme'}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} | Bride Gap API Docs</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <style>
        :root {
          --primary: ${theme.primary};
          --secondary: ${theme.secondary};
          --background: ${theme.background};
          --text: ${theme.text};
          --card: ${theme.card};
        }
        
        body {
          font-family: 'Inter', sans-serif;
          background: var(--background);
          color: var(--text);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          margin: 0;
        }
        
        .error-container {
          text-align: center;
          max-width: 600px;
          padding: 3rem;
          background: var(--card);
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        
        .error-icon {
          font-size: 4rem;
          color: var(--primary);
          margin-bottom: 1.5rem;
        }
        
        .error-code {
          font-size: 4rem;
          font-weight: 800;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 1rem;
        }
        
        .error-title {
          font-size: 1.5rem;
          margin-bottom: 1rem;
          color: var(--text);
        }
        
        .error-message {
          color: var(--text);
          opacity: 0.8;
          margin-bottom: 2rem;
          line-height: 1.6;
        }
        
        .error-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }
        
        .error-btn {
          padding: 0.75rem 1.5rem;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .error-btn.primary {
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          color: white;
        }
        
        .error-btn.secondary {
          background: transparent;
          color: var(--text);
          border: 2px solid var(--primary);
        }
        
        .error-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <div class="error-icon">
          <i class="fas fa-${code === 404 ? 'map-signs' : 'exclamation-triangle'}"></i>
        </div>
        <div class="error-code">${code}</div>
        <div class="error-title">${title}</div>
        <div class="error-message">${message}</div>
        <div class="error-actions">
          <a href="/docs" class="error-btn primary">
            <i class="fas fa-home"></i> Return to Docs
          </a>
          <button onclick="history.back()" class="error-btn secondary">
            <i class="fas fa-arrow-left"></i> Go Back
          </button>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Attach renderError to router for use in route handler
router.renderError = renderError;

// API endpoints
router.get('/api/sidebar', async (req, res) => {
    try {
        const sidebarBuilder = new SidebarBuilder();
        const tree = await sidebarBuilder.buildTree(CONFIG.DOCS_ROOT);
        res.json({ success: true, data: tree });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to load sidebar',
            message: error.message
        });
    }
});

router.get('/api/stats', async (req, res) => {
    try {
        const stats = {
            totalFiles: 0,
            totalDirs: 0,
            cacheSize: cache.cache.size,
            uptime: process.uptime()
        };

        const countItems = async (dir) => {
            const files = await fs.readdir(dir, { withFileTypes: true });

            for (const file of files) {
                if (file.isDirectory()) {
                    stats.totalDirs++;
                    await countItems(path.join(dir, file.name));
                } else if (CONFIG.ALLOWED_EXTENSIONS.has(path.extname(file.name))) {
                    stats.totalFiles++;
                }
            }
        };

        await countItems(CONFIG.DOCS_ROOT);
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/api/cache/clear', (req, res) => {
    const auth = req.headers.authorization;
    if (process.env.NODE_ENV === 'production' && auth !== `Bearer ${process.env.ADMIN_TOKEN}`) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const sizeBefore = cache.cache.size;
    cache.clear();

    res.json({
        success: true,
        message: 'Cache cleared successfully',
        cleared: sizeBefore
    });
});

export default router;
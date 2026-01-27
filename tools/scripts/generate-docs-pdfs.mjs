#!/usr/bin/env node
/**
 * RADIANT Documentation PDF Generator
 * 
 * Converts all markdown documentation files to PDF format.
 * 
 * Usage:
 *   npx md-to-pdf --install  # Install dependencies first
 *   node tools/scripts/generate-docs-pdfs.mjs
 * 
 * Output:
 *   All PDFs will be placed in /docs/pdf/ directory
 */

import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, readFileSync } from 'fs';
import { join, basename, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const DOCS_DIR = join(PROJECT_ROOT, 'docs');
const PDF_OUTPUT_DIR = join(DOCS_DIR, 'pdf');
const ROOT_DOCS = ['CHANGELOG.md', 'README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'SECURITY.md', 'TECHNICAL_DEBT.md'];

// PDF styling
const PDF_OPTIONS = {
  stylesheet: `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      max-width: 100%;
      padding: 0 20px;
    }
    h1 { color: #1a1a2e; border-bottom: 2px solid #4a90d9; padding-bottom: 8px; font-size: 24pt; }
    h2 { color: #16213e; border-bottom: 1px solid #ddd; padding-bottom: 5px; font-size: 18pt; margin-top: 30px; }
    h3 { color: #1f4068; font-size: 14pt; margin-top: 25px; }
    h4 { color: #1b1b2f; font-size: 12pt; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 10pt; }
    pre { background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 9pt; }
    pre code { background: transparent; padding: 0; color: inherit; }
    table { border-collapse: collapse; width: 100%; margin: 15px 0; font-size: 10pt; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background: #4a90d9; color: white; }
    tr:nth-child(even) { background: #f9f9f9; }
    blockquote { border-left: 4px solid #4a90d9; margin: 15px 0; padding: 10px 20px; background: #f8f9fa; }
    a { color: #4a90d9; }
    img { max-width: 100%; height: auto; }
    .mermaid { background: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; }
    hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
  `,
  pdf_options: {
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size: 9px; color: #999; width: 100%; text-align: center; padding: 5px 0;">RADIANT Documentation</div>',
    footerTemplate: '<div style="font-size: 9px; color: #999; width: 100%; text-align: center; padding: 5px 0;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
  }
};

/**
 * Recursively find all markdown files
 */
function findMarkdownFiles(dir, files = []) {
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory() && item !== 'pdf' && item !== 'node_modules') {
      findMarkdownFiles(fullPath, files);
    } else if (item.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Check if md-to-pdf is installed
 */
function checkDependencies() {
  try {
    execSync('npx md-to-pdf --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Install md-to-pdf if needed
 */
async function installDependencies() {
  console.log('📦 Installing md-to-pdf...');
  try {
    execSync('npm install -g md-to-pdf', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error('❌ Failed to install md-to-pdf. Please run: npm install -g md-to-pdf');
    return false;
  }
}

/**
 * Convert a single markdown file to PDF
 */
async function convertToPdf(mdPath, outputDir) {
  const relativePath = relative(PROJECT_ROOT, mdPath);
  const pdfName = relativePath.replace(/\//g, '_').replace('.md', '.pdf');
  const pdfPath = join(outputDir, pdfName);
  
  return new Promise((resolve) => {
    const args = [
      'md-to-pdf',
      mdPath,
      '--dest', pdfPath,
      '--pdf-options', JSON.stringify(PDF_OPTIONS.pdf_options),
      '--stylesheet', PDF_OPTIONS.stylesheet.replace(/\n/g, ' ')
    ];
    
    const proc = spawn('npx', args, { 
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true 
    });
    
    let stderr = '';
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, path: pdfPath, name: pdfName });
      } else {
        resolve({ success: false, path: mdPath, error: stderr || 'Unknown error' });
      }
    });
    
    proc.on('error', (err) => {
      resolve({ success: false, path: mdPath, error: err.message });
    });
  });
}

/**
 * Generate index HTML for easy downloading
 */
function generateIndex(pdfs, outputDir) {
  const categories = {};
  
  for (const pdf of pdfs) {
    let category = 'Root';
    if (pdf.includes('docs_authentication_')) category = 'Authentication';
    else if (pdf.includes('docs_security_')) category = 'Security';
    else if (pdf.includes('docs_api_')) category = 'API Reference';
    else if (pdf.includes('docs_sections_')) category = 'Technical Sections';
    else if (pdf.includes('docs_phases_')) category = 'Implementation Phases';
    else if (pdf.includes('THINKTANK')) category = 'Think Tank';
    else if (pdf.includes('RADIANT')) category = 'RADIANT Platform';
    else if (pdf.includes('CATO') || pdf.includes('GENESIS')) category = 'Safety & Ethics';
    else if (pdf.includes('CORTEX') || pdf.includes('AGI') || pdf.includes('CONSCIOUSNESS')) category = 'AI Architecture';
    else if (pdf.includes('docs_')) category = 'Documentation';
    
    if (!categories[category]) categories[category] = [];
    categories[category].push(pdf);
  }
  
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RADIANT Documentation PDFs</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px; margin: 0 auto; padding: 40px 20px;
      background: #f5f5f7; color: #1d1d1f;
    }
    h1 { color: #1d1d1f; border-bottom: 2px solid #0071e3; padding-bottom: 15px; }
    h2 { color: #1d1d1f; margin-top: 40px; padding: 10px 0; border-bottom: 1px solid #d2d2d7; }
    .category { background: white; border-radius: 12px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .pdf-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }
    .pdf-link { 
      display: block; padding: 12px 15px; background: #f5f5f7; border-radius: 8px;
      color: #0071e3; text-decoration: none; font-size: 14px;
      transition: background 0.2s;
    }
    .pdf-link:hover { background: #e8e8ed; }
    .stats { background: #0071e3; color: white; padding: 20px; border-radius: 12px; margin-bottom: 30px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; text-align: center; }
    .stat-number { font-size: 32px; font-weight: bold; }
    .stat-label { font-size: 14px; opacity: 0.9; }
    .download-all { 
      display: inline-block; background: #0071e3; color: white; padding: 15px 30px;
      border-radius: 8px; text-decoration: none; font-weight: 500; margin: 20px 0;
    }
    .download-all:hover { background: #0077ed; }
  </style>
</head>
<body>
  <h1>📚 RADIANT Documentation PDFs</h1>
  
  <div class="stats">
    <div class="stats-grid">
      <div><div class="stat-number">${pdfs.length}</div><div class="stat-label">Total Documents</div></div>
      <div><div class="stat-number">${Object.keys(categories).length}</div><div class="stat-label">Categories</div></div>
      <div><div class="stat-number">v5.52.29</div><div class="stat-label">Version</div></div>
    </div>
  </div>
  
  <p>All RADIANT documentation converted to PDF format for offline reading and distribution.</p>
`;

  const sortedCategories = Object.keys(categories).sort();
  for (const category of sortedCategories) {
    const pdfsInCategory = categories[category].sort();
    html += `
  <div class="category">
    <h2>${category} (${pdfsInCategory.length})</h2>
    <div class="pdf-list">
`;
    for (const pdf of pdfsInCategory) {
      const displayName = pdf.replace(/_/g, ' / ').replace('.pdf', '').replace('docs / ', '');
      html += `      <a href="${pdf}" class="pdf-link">📄 ${displayName}</a>\n`;
    }
    html += `    </div>
  </div>
`;
  }

  html += `
  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #d2d2d7; color: #86868b; font-size: 12px;">
    Generated on ${new Date().toISOString().split('T')[0]} | RADIANT v5.52.29
  </footer>
</body>
</html>`;

  writeFileSync(join(outputDir, 'index.html'), html);
  console.log('📋 Generated index.html');
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 RADIANT Documentation PDF Generator\n');
  
  // Check/install dependencies
  if (!checkDependencies()) {
    const installed = await installDependencies();
    if (!installed) process.exit(1);
  }
  
  // Create output directory
  if (!existsSync(PDF_OUTPUT_DIR)) {
    mkdirSync(PDF_OUTPUT_DIR, { recursive: true });
  }
  
  // Find all markdown files
  const docsFiles = findMarkdownFiles(DOCS_DIR);
  const rootFiles = ROOT_DOCS.map(f => join(PROJECT_ROOT, f)).filter(f => existsSync(f));
  const allFiles = [...rootFiles, ...docsFiles];
  
  console.log(`📁 Found ${allFiles.length} markdown files\n`);
  
  // Convert files
  const results = { success: [], failed: [] };
  let processed = 0;
  
  for (const file of allFiles) {
    processed++;
    const shortName = relative(PROJECT_ROOT, file);
    process.stdout.write(`\r[${processed}/${allFiles.length}] Converting: ${shortName.substring(0, 50).padEnd(50)}`);
    
    const result = await convertToPdf(file, PDF_OUTPUT_DIR);
    if (result.success) {
      results.success.push(result.name);
    } else {
      results.failed.push({ path: shortName, error: result.error });
    }
  }
  
  console.log('\n');
  
  // Generate index
  generateIndex(results.success, PDF_OUTPUT_DIR);
  
  // Summary
  console.log('═'.repeat(60));
  console.log(`✅ Successfully converted: ${results.success.length} files`);
  if (results.failed.length > 0) {
    console.log(`❌ Failed: ${results.failed.length} files`);
    for (const f of results.failed.slice(0, 5)) {
      console.log(`   - ${f.path}`);
    }
    if (results.failed.length > 5) {
      console.log(`   ... and ${results.failed.length - 5} more`);
    }
  }
  console.log('═'.repeat(60));
  console.log(`\n📂 PDFs saved to: ${PDF_OUTPUT_DIR}`);
  console.log(`🌐 Open index.html in a browser to browse all PDFs\n`);
}

main().catch(console.error);

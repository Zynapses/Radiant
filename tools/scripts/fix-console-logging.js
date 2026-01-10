#!/usr/bin/env node
/**
 * RADIANT Console Logging Migration Script
 * 
 * Replaces console.log/warn/error with structured logger calls.
 * Run with: node tools/scripts/fix-console-logging.js
 */

const fs = require('fs');
const path = require('path');

const LAMBDA_DIR = '/Users/robertlong/CascadeProjects/Radiant/packages/infrastructure/lambda';

// Files to skip (already using structured logging)
const SKIP_FILES = [
  'enhanced-logger.ts',
  'logger.ts',
  'logging.ts',
];

// Get relative import path for logger
function getLoggerImport(filePath) {
  const relative = path.relative(path.dirname(filePath), path.join(LAMBDA_DIR, 'shared/logging/enhanced-logger'));
  const normalized = relative.replace(/\\/g, '/');
  return normalized.startsWith('.') ? normalized : './' + normalized;
}

// Check if file already imports logger
function hasLoggerImport(content) {
  return /import\s+{[^}]*logger[^}]*}\s+from\s+['"].*enhanced-logger['"]/.test(content) ||
         /import\s+{[^}]*logger[^}]*}\s+from\s+['"].*logging['"]/.test(content) ||
         /import\s+{[^}]*enhancedLogger[^}]*}\s+from/.test(content);
}

// Transform console statements
function transformConsoleStatements(content, filePath) {
  let changes = 0;
  let result = content;

  // Pattern: console.log('message', var) -> logger.info('message', { data: var })
  // Pattern: console.log('message') -> logger.info('message')
  // Pattern: console.error('message', error) -> logger.error('message', error)
  // Pattern: console.warn('message') -> logger.warn('message')

  // Simple console.log with just a string
  result = result.replace(
    /console\.log\((['"`][^'"`]+['"`])\);?/g,
    (match, msg) => {
      changes++;
      return `logger.info(${msg});`;
    }
  );

  // console.log with template literal only
  result = result.replace(
    /console\.log\((`[^`]+`)\);?/g,
    (match, msg) => {
      changes++;
      return `logger.info(${msg});`;
    }
  );

  // console.log with string + additional args
  result = result.replace(
    /console\.log\((['"`][^'"`]+['"`]),\s*([^)]+)\);?/g,
    (match, msg, args) => {
      changes++;
      // If args looks like an error or object, wrap appropriately
      const trimmedArgs = args.trim();
      if (trimmedArgs.startsWith('{')) {
        return `logger.info(${msg}, ${trimmedArgs});`;
      }
      return `logger.info(${msg}, { data: ${trimmedArgs} });`;
    }
  );

  // console.error with message + error object
  result = result.replace(
    /console\.error\((['"`][^'"`]+['"`]),\s*(error|err|e)\);?/g,
    (match, msg, errVar) => {
      changes++;
      return `logger.error(${msg}, ${errVar});`;
    }
  );

  // console.error with just a string
  result = result.replace(
    /console\.error\((['"`][^'"`]+['"`])\);?/g,
    (match, msg) => {
      changes++;
      return `logger.error(${msg});`;
    }
  );

  // console.error with string + other args
  result = result.replace(
    /console\.error\((['"`][^'"`]+['"`]),\s*([^)]+)\);?/g,
    (match, msg, args) => {
      changes++;
      const trimmedArgs = args.trim();
      // Check if it's likely an error object
      if (/^(error|err|e)$/.test(trimmedArgs) || trimmedArgs.includes('Error')) {
        return `logger.error(${msg}, ${trimmedArgs});`;
      }
      return `logger.error(${msg}, undefined, { data: ${trimmedArgs} });`;
    }
  );

  // console.warn with just a string
  result = result.replace(
    /console\.warn\((['"`][^'"`]+['"`])\);?/g,
    (match, msg) => {
      changes++;
      return `logger.warn(${msg});`;
    }
  );

  // console.warn with string + args
  result = result.replace(
    /console\.warn\((['"`][^'"`]+['"`]),\s*([^)]+)\);?/g,
    (match, msg, args) => {
      changes++;
      const trimmedArgs = args.trim();
      if (trimmedArgs.startsWith('{')) {
        return `logger.warn(${msg}, ${trimmedArgs});`;
      }
      return `logger.warn(${msg}, { data: ${trimmedArgs} });`;
    }
  );

  return { content: result, changes };
}

// Add logger import if needed
function addLoggerImport(content, filePath) {
  if (hasLoggerImport(content)) {
    return content;
  }

  const importPath = getLoggerImport(filePath);
  const importStatement = `import { logger } from '${importPath}';\n`;

  // Find the last import statement and add after it
  const importMatch = content.match(/^(import\s+.+from\s+.+;?\n)+/m);
  if (importMatch) {
    const lastImportEnd = importMatch.index + importMatch[0].length;
    return content.slice(0, lastImportEnd) + importStatement + content.slice(lastImportEnd);
  }

  // No imports found, add at the beginning (after any comments/docs)
  const docMatch = content.match(/^(\/\*\*[\s\S]*?\*\/\s*\n|\/\/.*\n)*/);
  if (docMatch && docMatch[0]) {
    return docMatch[0] + importStatement + '\n' + content.slice(docMatch[0].length);
  }

  return importStatement + content;
}

// Process a single file
function processFile(filePath) {
  const fileName = path.basename(filePath);
  if (SKIP_FILES.includes(fileName)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Skip if no console statements
  if (!/console\.(log|error|warn)/.test(content)) {
    return null;
  }

  const { content: transformed, changes } = transformConsoleStatements(content, filePath);
  
  if (changes === 0) {
    return null;
  }

  // Add import if we made changes
  const withImport = addLoggerImport(transformed, filePath);
  
  fs.writeFileSync(filePath, withImport);
  
  return { path: filePath, changes };
}

// Find all TypeScript files
function findTsFiles(dir) {
  const files = [];
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...findTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main
function main() {
  console.log('Scanning for console statements...\n');
  
  const files = findTsFiles(LAMBDA_DIR);
  const results = [];
  
  for (const file of files) {
    const result = processFile(file);
    if (result) {
      results.push(result);
      console.log(`✓ ${path.relative(LAMBDA_DIR, result.path)} (${result.changes} changes)`);
    }
  }
  
  console.log(`\n✅ Fixed ${results.reduce((sum, r) => sum + r.changes, 0)} console statements in ${results.length} files`);
}

main();

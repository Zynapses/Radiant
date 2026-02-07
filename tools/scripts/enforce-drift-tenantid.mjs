/**
 * Drift Enforcement Script: Add tenantId to all modelRouterService.invoke() calls
 * Usage: node tools/scripts/enforce-drift-tenantid.mjs [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICES_DIR = path.join(__dirname, '../../packages/infrastructure/lambda/shared/services');
const DRY_RUN = process.argv.includes('--dry-run');

const SKIP_FILES = new Set([
  'model-router.service.ts',
  'drift-aware-weighting.service.ts',
  'drift-correction.service.ts',
  'drift-detection.service.ts', // Uses invoke for testing, tenantId not relevant
  'agi-orchestrator.service.ts', // Already fixed manually
]);

// Empty = audit all files
const PHASE2_ONLY = new Set([]);

function findInvokeCalls(content) {
  const calls = [];
  const pattern = /modelRouterService\.invoke\(\{/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const startIndex = match.index + match[0].length;
    let depth = 1;
    let i = startIndex;
    while (i < content.length && depth > 0) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') depth--;
      i++;
    }
    const endIndex = i;
    const block = content.substring(startIndex, endIndex);
    const hasTenantId = /\btenantId\b/.test(block);
    const lineNumber = content.substring(0, match.index).split('\n').length;

    calls.push({ startIndex, endIndex, hasTenantId, lineNumber });
  }

  return calls;
}

function findTenantIdInScope(content, invokeLineNumber) {
  const lines = content.split('\n');
  
  for (let i = invokeLineNumber - 1; i >= Math.max(0, invokeLineNumber - 150); i--) {
    const line = lines[i];
    
    // Method parameter patterns
    if (/tenantId:\s*string/.test(line) && !line.includes('interface') && !line.includes('export type')) return 'tenantId';
    if (/request:\s*OrchestrationRequest/.test(line)) return 'request.tenantId';
    if (/context:\s*PipelineExecutionContext/.test(line)) return 'context.tenantId';
    if (/context:\s*MethodExecutionContext/.test(line)) return 'context.tenantId';
    
    // Request object patterns (interfaces with tenantId field)
    if (/request:\s*SuperiorRequest/.test(line)) return 'request.tenantId';
    if (/request:\s*SynthesisRequest/.test(line)) return 'request.tenantId';
    if (/request:\s*ConsensusRequest/.test(line)) return 'request.tenantId';
    if (/request:\s*\w+Request/.test(line) && !line.includes('//')) {
      // Generic request pattern - check if the file has tenantId on request
      const fileContent = content;
      if (/tenantId:\s*string/.test(fileContent.substring(0, 500))) return 'request.tenantId';
    }
    
    // MethodInput pattern (orchestration-methods inner classes)
    if (/input:\s*MethodInput/.test(line)) return 'input.tenantId';
    
    // Tree pattern (tree-of-thoughts)
    if (/tree:\s*ReasoningTree/.test(line)) return 'tree.tenantId';
    if (/\(tree\b/.test(line) && /ReasoningTree/.test(line)) return 'tree.tenantId';
    
    // Destructured patterns
    if (/const\s*\{\s*[^}]*tenantId[^}]*\}\s*=/.test(line)) return 'tenantId';
    
    // Variable assignment
    if (/const\s+tenantId\s*=/.test(line)) return 'tenantId';
    if (/let\s+tenantId\s*=/.test(line)) return 'tenantId';
    
    // Object property access
    if (/tree\.tenantId/.test(line) && !line.includes('//')) return 'tree.tenantId';
    if (/config\.tenantId/.test(line) && !line.includes('//')) return 'config.tenantId';
    if (/params\.tenantId/.test(line) && !line.includes('//')) return 'params.tenantId';
    if (/options\.tenantId/.test(line) && !line.includes('//')) return 'options.tenantId';
    if (/input\.tenantId/.test(line) && !line.includes('//')) return 'input.tenantId';
    if (/req\.tenantId/.test(line) && !line.includes('//')) return 'req.tenantId';
    if (/result\.tenantId/.test(line) && !line.includes('//')) return 'result.tenantId';
  }

  return null;
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const calls = findInvokeCalls(content);
  
  if (calls.length === 0) return { file: path.basename(filePath), fixed: 0, skipped: 0, warnings: [] };

  let fixed = 0;
  let skipped = 0;
  const warnings = [];
  let newContent = content;
  let offset = 0;

  for (const call of calls) {
    if (call.hasTenantId) {
      skipped++;
      continue;
    }

    const tenantIdVar = findTenantIdInScope(content, call.lineNumber);
    if (!tenantIdVar) {
      warnings.push(`  WARN: No tenantId in scope at line ${call.lineNumber}`);
      skipped++;
      continue;
    }

    // Find the indentation of the next line after the opening brace
    const afterBrace = content.substring(call.startIndex);
    const nextLineMatch = afterBrace.match(/\n(\s+)/);
    const indent = nextLineMatch ? nextLineMatch[1] : '        ';

    const insertPos = call.startIndex + offset;
    const tenantIdText = tenantIdVar === 'tenantId' ? 'tenantId,' : `tenantId: ${tenantIdVar},`;
    const insertText = `\n${indent}${tenantIdText}`;
    newContent = newContent.substring(0, insertPos) + insertText + newContent.substring(insertPos);
    offset += insertText.length;
    fixed++;
  }

  if (fixed > 0 && !DRY_RUN) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }

  return { file: path.basename(filePath), fixed, skipped, warnings };
}

function getAllServiceFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllServiceFiles(fullPath));
    } else if (entry.name.endsWith('.service.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main
console.log(`\nDrift Enforcement: Adding tenantId to modelRouterService.invoke() calls`);
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (writing files)'}\n`);

const files = getAllServiceFiles(SERVICES_DIR);
let totalFixed = 0;
let totalSkipped = 0;
let filesModified = 0;
const allWarnings = [];

for (const filePath of files) {
  const basename = path.basename(filePath);
  if (SKIP_FILES.has(basename)) continue;
  if (PHASE2_ONLY.size > 0 && !PHASE2_ONLY.has(basename)) continue;

  const result = processFile(filePath);
  if (result.fixed > 0) {
    console.log(`  FIXED ${result.file}: ${result.fixed} fixed, ${result.skipped} already ok`);
    filesModified++;
  }
  if (result.warnings.length > 0) {
    allWarnings.push({ file: result.file, warnings: result.warnings });
  }
  totalFixed += result.fixed;
  totalSkipped += result.skipped;
}

if (allWarnings.length > 0) {
  console.log(`\nWarnings (no tenantId found in scope):`);
  for (const w of allWarnings) {
    console.log(`  ${w.file}:`);
    w.warnings.forEach(msg => console.log(`    ${msg}`));
  }
}

console.log(`\nSummary:`);
console.log(`  Files modified: ${filesModified}`);
console.log(`  Invoke calls fixed: ${totalFixed}`);
console.log(`  Already had tenantId / no scope: ${totalSkipped}`);
console.log(`  ${DRY_RUN ? '(DRY RUN - no files changed)' : 'All files updated!'}\n`);

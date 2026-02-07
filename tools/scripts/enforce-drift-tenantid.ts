/**
 * Drift Enforcement Script: Add tenantId to all modelRouterService.invoke() calls
 * 
 * This script finds all .ts files in lambda/shared/services that call
 * modelRouterService.invoke() without tenantId, and adds it.
 * 
 * For each invoke call, it looks upward in the file to find the nearest
 * tenantId variable in scope (from method parameters or destructured context).
 * 
 * Usage: npx ts-node tools/scripts/enforce-drift-tenantid.ts [--dry-run]
 */

import * as fs from 'fs';
import * as path from 'path';

const SERVICES_DIR = path.join(__dirname, '../../packages/infrastructure/lambda/shared/services');
const DRY_RUN = process.argv.includes('--dry-run');

// Files that already have tenantId in all invoke calls (skip)
const SKIP_FILES = new Set([
  'model-router.service.ts', // Handled separately (it's the source)
  'drift-aware-weighting.service.ts',
  'drift-correction.service.ts', 
  'drift-detection.service.ts', // Uses invoke for testing, tenantId not always available
]);

// Files already fixed
const ALREADY_FIXED = new Set([
  'agi-orchestrator.service.ts',
]);

interface InvokeCall {
  startIndex: number;
  endIndex: number;
  hasTenantId: boolean;
  lineNumber: number;
}

function findInvokeCalls(content: string): InvokeCall[] {
  const calls: InvokeCall[] = [];
  const pattern = /modelRouterService\.invoke\(\{/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    const startIndex = match.index + match[0].length;
    // Find the matching closing brace
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

function findTenantIdInScope(content: string, invokeLineNumber: number): string | null {
  const lines = content.split('\n');
  
  // Look backwards from the invoke call to find the enclosing method's tenantId
  for (let i = invokeLineNumber - 1; i >= Math.max(0, invokeLineNumber - 100); i--) {
    const line = lines[i];
    
    // Check for tenantId in method parameters
    if (/tenantId:\s*string/.test(line)) return 'tenantId';
    if (/tenantId\s*=/.test(line) && !line.includes('interface') && !line.includes('type')) return 'tenantId';
    
    // Check for request.tenantId pattern
    if (/request:\s*OrchestrationRequest/.test(line)) return 'request.tenantId';
    
    // Check for context.tenantId pattern
    if (/context\.tenantId/.test(line)) return 'context.tenantId';
    if (/ctx\.tenantId/.test(line)) return 'ctx.tenantId';
    if (/config\.tenantId/.test(line)) return 'config.tenantId';
    
    // Check for PipelineExecutionContext
    if (/context:\s*PipelineExecutionContext/.test(line)) return 'context.tenantId';
    
    // Check for destructured tenantId
    if (/const\s*\{[^}]*tenantId[^}]*\}/.test(line)) return 'tenantId';
    
    // Check for tree.tenantId pattern
    if (/tree\.tenantId/.test(line)) return 'tree.tenantId';
  }

  return null;
}

function processFile(filePath: string): { file: string; fixed: number; skipped: number } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const calls = findInvokeCalls(content);
  
  if (calls.length === 0) return { file: path.basename(filePath), fixed: 0, skipped: 0 };

  let fixed = 0;
  let skipped = 0;
  let newContent = content;
  let offset = 0;

  for (const call of calls) {
    if (call.hasTenantId) {
      skipped++;
      continue;
    }

    const tenantIdVar = findTenantIdInScope(content, call.lineNumber);
    if (!tenantIdVar) {
      console.log(`  WARN: No tenantId in scope at line ${call.lineNumber} in ${path.basename(filePath)}`);
      skipped++;
      continue;
    }

    // Insert tenantId after the opening { of the invoke call
    const insertPos = call.startIndex + offset;
    const insertText = `\n        tenantId: ${tenantIdVar},`;
    newContent = newContent.substring(0, insertPos) + insertText + newContent.substring(insertPos);
    offset += insertText.length;
    fixed++;
  }

  if (fixed > 0 && !DRY_RUN) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }

  return { file: path.basename(filePath), fixed, skipped };
}

function getAllServiceFiles(dir: string): string[] {
  const files: string[] = [];
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
console.log(`\n🔍 Drift Enforcement: Adding tenantId to modelRouterService.invoke() calls`);
console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (writing files)'}\n`);

const files = getAllServiceFiles(SERVICES_DIR);
let totalFixed = 0;
let totalSkipped = 0;
let filesModified = 0;

for (const filePath of files) {
  const basename = path.basename(filePath);
  if (SKIP_FILES.has(basename) || ALREADY_FIXED.has(basename)) continue;

  const result = processFile(filePath);
  if (result.fixed > 0) {
    console.log(`  ✅ ${result.file}: ${result.fixed} fixed, ${result.skipped} skipped`);
    filesModified++;
  } else if (result.skipped > 0) {
    console.log(`  ⏭️  ${result.file}: ${result.skipped} already have tenantId`);
  }
  totalFixed += result.fixed;
  totalSkipped += result.skipped;
}

console.log(`\n📊 Summary:`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Invoke calls fixed: ${totalFixed}`);
console.log(`   Already had tenantId: ${totalSkipped}`);
console.log(`   ${DRY_RUN ? '(DRY RUN - no files changed)' : 'All files updated!'}\n`);

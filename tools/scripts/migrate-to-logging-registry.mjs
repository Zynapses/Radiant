#!/usr/bin/env node
/**
 * migrate-to-logging-registry.mjs
 * 
 * Migrates all Lambda files from legacy enhancedLogger to the Logging Registry.
 * 
 * Usage:
 *   node tools/scripts/migrate-to-logging-registry.mjs          # dry-run (audit)
 *   node tools/scripts/migrate-to-logging-registry.mjs --fix     # apply changes
 */

import fs from 'fs';
import path from 'path';

const DRY_RUN = !process.argv.includes('--fix');
const LAMBDA_ROOT = path.resolve('packages/infrastructure/lambda');
const SERVICES_DIR = path.join(LAMBDA_ROOT, 'shared/services');
const REGISTRY_FILE = 'logging-registry.service';

// ─── Category mapping based on file path / name patterns ───────────────────

const CATEGORY_RULES = [
  // Security domain
  [/security|sentinel|attack|threat|vulnerability|firewall|waf|anomaly/i, 'security'],
  // Billing domain
  [/billing|credit|metering|stripe|subscription|pricing|payment|invoice|storage-quota/i, 'billing'],
  // Audit domain
  [/audit|oversight|compliance|regulatory|hipaa|gdpr|soc2/i, 'audit'],
  // Access domain
  [/auth|identity|oauth|mfa|sso|cedar|session|token|permission|role|access-control/i, 'access'],
  // Infrastructure domain
  [/monitoring|health|thermal|infrastructure|cdk|deploy|migration|scaling|sqs|redis/i, 'infrastructure'],
  // Performance domain
  [/metric|performance|latency|benchmark|load-test|profil/i, 'performance'],
  // Error domain (specific error tracking services)
  [/error-track|crash-report/i, 'error'],
  // Default
  [/./, 'application'],
];

function getCategory(filePath) {
  const relPath = path.relative(LAMBDA_ROOT, filePath).toLowerCase();
  const fileName = path.basename(filePath).toLowerCase();
  
  // Admin Lambda handlers → audit (they handle admin API requests)
  if (relPath.startsWith('admin/')) return 'audit';
  
  // API Lambda handlers → application
  if (relPath.startsWith('api/')) return 'application';
  
  // Learning Lambda handlers → application
  if (relPath.startsWith('learning/')) return 'application';
  
  // Think Tank handlers → application
  if (relPath.startsWith('thinktank/') || relPath.startsWith('thinktank-admin/')) return 'application';
  
  // Worker handlers → application
  if (relPath.startsWith('workers/')) return 'application';
  
  // Analytics handlers → performance
  if (relPath.startsWith('analytics/')) return 'performance';
  
  // EventBridge handlers → infrastructure
  if (relPath.startsWith('eventbridge/')) return 'infrastructure';
  
  // Visual pipeline → application
  if (relPath.startsWith('visual-pipeline/')) return 'application';
  
  // Authorizer → access
  if (relPath.startsWith('authorizer/')) return 'access';
  
  // For services and other files, use pattern matching on filename + parent dir
  const dirName = path.dirname(filePath).toLowerCase();
  const combined = `${dirName}/${fileName}`;
  
  for (const [pattern, category] of CATEGORY_RULES) {
    if (pattern.test(combined)) {
      return category;
    }
  }
  return 'application';
}

// ─── Service name derivation from file path ────────────────────────────────

function getServiceName(filePath) {
  // Get path relative to lambda root
  const relPath = path.relative(LAMBDA_ROOT, filePath);
  // Remove extension
  const noExt = relPath.replace(/\.(service\.)?ts$/, '');
  
  // Convert path segments to domain/name format
  const parts = noExt.split(path.sep);
  
  // For shared/services/... files
  if (parts[0] === 'shared' && parts[1] === 'services') {
    const serviceParts = parts.slice(2);
    if (serviceParts.length === 1) {
      // e.g., shared/services/billing.ts → billing/main
      // e.g., shared/services/security-alert.service.ts → security/alert
      const name = serviceParts[0]
        .replace(/\.service$/, '')
        .replace(/\.ts$/, '');
      
      // If name has a hyphen that looks like domain-name, split it
      const hyphenIdx = name.indexOf('-');
      if (hyphenIdx > 0 && hyphenIdx < name.length - 1) {
        return `${name.substring(0, hyphenIdx)}/${name.substring(hyphenIdx + 1)}`;
      }
      return `${name}/main`;
    } else {
      // e.g., shared/services/cato/genesis.service.ts → cato/genesis
      const domain = serviceParts[0];
      const name = serviceParts.slice(1).join('-')
        .replace(/\.service$/, '')
        .replace(/\.ts$/, '');
      return `${domain}/${name}`;
    }
  }
  
  // For admin/... handler files
  if (parts[0] === 'admin') {
    const name = parts.slice(1).join('-')
      .replace(/\.handler$/, '')
      .replace(/\.ts$/, '');
    return `admin/${name}`;
  }
  
  // For learning/... files
  if (parts[0] === 'learning') {
    const name = parts.slice(1).join('-')
      .replace(/\.ts$/, '');
    return `learning/${name}`;
  }
  
  // For api/... files
  if (parts[0] === 'api') {
    const name = parts.slice(1).join('-')
      .replace(/\.ts$/, '');
    return `api/${name}`;
  }
  
  // For thinktank/... handler files
  if (parts[0] === 'thinktank' || parts[0] === 'thinktank-admin') {
    const name = parts.join('-').replace(/\.ts$/, '');
    return `thinktank/${parts.slice(1).join('-').replace(/\.ts$/, '') || 'main'}`;
  }
  
  // For workers/... handler files
  if (parts[0] === 'workers') {
    const name = parts.slice(1).join('-').replace(/\.ts$/, '');
    return `workers/${name}`;
  }
  
  // For analytics/... handler files
  if (parts[0] === 'analytics') {
    const name = parts.slice(1).join('-').replace(/\.ts$/, '');
    return `analytics/${name}`;
  }
  
  // For eventbridge/... handler files
  if (parts[0] === 'eventbridge') {
    const name = parts.slice(1).join('-').replace(/\.ts$/, '');
    return `eventbridge/${name}`;
  }
  
  // For visual-pipeline/... handler files
  if (parts[0] === 'visual-pipeline') {
    const name = parts.slice(1).join('-').replace(/\.ts$/, '');
    return `visual-pipeline/${name}`;
  }
  
  // For authorizer/... handler files
  if (parts[0] === 'authorizer') {
    const name = parts.slice(1).join('-').replace(/\.ts$/, '');
    return `authorizer/${name}`;
  }
  
  // Fallback: domain/name from path parts
  const domain = parts[0];
  const name = parts.slice(1).join('-').replace(/\.ts$/, '') || 'main';
  return `${domain}/${name}`;
}

// ─── Compute relative import path to logging-registry.service ──────────────

function getRegistryImportPath(filePath) {
  const dir = path.dirname(filePath);
  const registryPath = path.join(SERVICES_DIR, REGISTRY_FILE);
  let rel = path.relative(dir, registryPath);
  
  // Ensure it starts with ./ or ../
  if (!rel.startsWith('.')) {
    rel = './' + rel;
  }
  
  return rel;
}

// ─── Find all .ts files recursively ────────────────────────────────────────

function findTsFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === 'dist') continue;
      results.push(...findTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }
  
  return results;
}

// ─── Patterns to match ────────────────────────────────────────────────────

// Pattern 1: import { enhancedLogger as logger } from '...enhanced-logger';
const PATTERN_ALIASED = /^import\s*\{\s*enhancedLogger\s+as\s+logger\s*\}\s*from\s*['"][^'"]*enhanced-logger[^'"]*['"];?\s*$/;

// Pattern 2: import { enhancedLogger } from '...enhanced-logger';
// Followed possibly by: const logger = enhancedLogger; or const logger = enhancedLogger.child(...);
const PATTERN_DIRECT = /^import\s*\{\s*enhancedLogger\s*\}\s*from\s*['"][^'"]*enhanced-logger[^'"]*['"];?\s*$/;

// Pattern for const logger = enhancedLogger; or const logger = enhancedLogger.child(...)
const PATTERN_ASSIGN = /^const\s+logger\s*=\s*enhancedLogger(?:\.child\(.*\))?;?\s*$/;

// Pattern for usage of enhancedLogger directly (not via logger alias)
const PATTERN_DIRECT_USAGE = /enhancedLogger\.(info|warn|error|debug|fatal|child)\(/;

// ─── Main migration logic ──────────────────────────────────────────────────

function migrateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Find the enhancedLogger import line
  let importLineIdx = -1;
  let isAliased = false;
  let isDirect = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (PATTERN_ALIASED.test(lines[i])) {
      importLineIdx = i;
      isAliased = true;
      break;
    }
    if (PATTERN_DIRECT.test(lines[i])) {
      importLineIdx = i;
      isDirect = true;
      break;
    }
  }
  
  if (importLineIdx === -1) return null;
  
  // Check if this file already uses createRegisteredLogger
  if (content.includes('createRegisteredLogger')) {
    return { file: filePath, status: 'already-migrated' };
  }
  
  const serviceName = getServiceName(filePath);
  const category = getCategory(filePath);
  const importPath = getRegistryImportPath(filePath);
  
  // Build replacement lines
  const newImport = `import { createRegisteredLogger } from '${importPath}';`;
  // Lambda handlers get 'lambda' sourceType, services get 'application'
  const relPath = path.relative(LAMBDA_ROOT, filePath);
  const isHandler = !relPath.startsWith('shared/services');
  const sourceType = isHandler ? 'lambda' : 'application';
  
  const newLogger = [
    '',
    'const logger = createRegisteredLogger({',
    `  serviceName: '${serviceName}',`,
    `  category: '${category}',`,
    `  sourceType: '${sourceType}',`,
    '});',
  ];
  
  const newLines = [...lines];
  
  if (isAliased) {
    // Simple case: replace import line, add logger declaration after it
    newLines.splice(importLineIdx, 1, newImport, ...newLogger);
  } else if (isDirect) {
    // Check for follow-up assignment line
    let assignLineIdx = -1;
    for (let i = importLineIdx + 1; i < Math.min(importLineIdx + 5, lines.length); i++) {
      if (PATTERN_ASSIGN.test(lines[i].trim())) {
        assignLineIdx = i;
        break;
      }
    }
    
    if (assignLineIdx !== -1) {
      // Remove both the import and assignment, replace with new import + logger
      // Handle blank lines between them
      const linesToRemove = assignLineIdx - importLineIdx + 1;
      newLines.splice(importLineIdx, linesToRemove, newImport, ...newLogger);
    } else {
      // No assignment — enhancedLogger used directly in code
      // Replace import, add logger, and replace enhancedLogger.xxx with logger.xxx in the file
      newLines.splice(importLineIdx, 1, newImport, ...newLogger);
      
      // Replace all enhancedLogger.method() calls with logger.method()
      for (let i = 0; i < newLines.length; i++) {
        if (PATTERN_DIRECT_USAGE.test(newLines[i])) {
          newLines[i] = newLines[i].replace(/enhancedLogger\./g, 'logger.');
        }
      }
    }
  }
  
  const newContent = newLines.join('\n');
  
  if (newContent === content) {
    return { file: filePath, status: 'no-change' };
  }
  
  if (!DRY_RUN) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
  }
  
  return {
    file: path.relative(process.cwd(), filePath),
    status: DRY_RUN ? 'would-fix' : 'fixed',
    serviceName,
    category,
    importPath,
  };
}

// ─── Run ───────────────────────────────────────────────────────────────────

console.log(`\n🔧 Logging Registry Migration ${DRY_RUN ? '(DRY RUN)' : '(APPLYING FIXES)'}\n`);

const allFiles = findTsFiles(LAMBDA_ROOT);
const results = [];
let fixed = 0;
let alreadyMigrated = 0;
let noChange = 0;

for (const file of allFiles) {
  const result = migrateFile(file);
  if (result) {
    results.push(result);
    if (result.status === 'fixed' || result.status === 'would-fix') fixed++;
    else if (result.status === 'already-migrated') alreadyMigrated++;
    else if (result.status === 'no-change') noChange++;
  }
}

// Print results
const fixResults = results.filter(r => r.status === 'fixed' || r.status === 'would-fix');
if (fixResults.length > 0) {
  console.log(`📋 Files to migrate (${fixResults.length}):\n`);
  for (const r of fixResults) {
    console.log(`  ${r.status === 'fixed' ? '✅' : '📝'} ${r.file}`);
    console.log(`     → serviceName: ${r.serviceName}, category: ${r.category}`);
  }
}

if (alreadyMigrated > 0) {
  console.log(`\n✅ Already migrated: ${alreadyMigrated}`);
}
if (noChange > 0) {
  console.log(`⚪ No change needed: ${noChange}`);
}

console.log(`\n📊 Summary:`);
console.log(`   Total files scanned: ${allFiles.length}`);
console.log(`   ${DRY_RUN ? 'Would fix' : 'Fixed'}: ${fixed}`);
console.log(`   Already migrated: ${alreadyMigrated}`);
console.log(`   No change: ${noChange}`);

if (DRY_RUN && fixed > 0) {
  console.log(`\n💡 Run with --fix to apply changes:`);
  console.log(`   node tools/scripts/migrate-to-logging-registry.mjs --fix\n`);
}

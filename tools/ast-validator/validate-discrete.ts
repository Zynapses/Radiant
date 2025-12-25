import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

/**
 * RADIANT AST-based Discrete Validator
 * Parses TypeScript/JavaScript files to detect cross-component imports
 */

interface ValidationResult {
  file: string;
  violations: Violation[];
}

interface Violation {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

const RADIANT_PATHS = [
  'packages/infrastructure',
  'apps/admin-dashboard',
];

const THINKTANK_PATHS = [
  'packages/thinktank',
  'apps/thinktank',
];

const ALLOWED_SHARED_IMPORTS = [
  '@radiant/shared',
  '../shared',
  '../../shared',
];

function isRadiantPath(filePath: string): boolean {
  return RADIANT_PATHS.some(p => filePath.includes(p));
}

function isThinkTankPath(filePath: string): boolean {
  return THINKTANK_PATHS.some(p => filePath.includes(p));
}

function isAllowedImport(importPath: string): boolean {
  return ALLOWED_SHARED_IMPORTS.some(allowed => importPath.includes(allowed));
}

function validateFile(filePath: string): ValidationResult {
  const violations: Violation[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const isRadiant = isRadiantPath(filePath);
  const isThinkTank = isThinkTankPath(filePath);

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const importPath = moduleSpecifier.text;

        // Check for cross-component imports
        if (isRadiant && importPath.includes('thinktank') && !isAllowedImport(importPath)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({
            line: line + 1,
            column: character + 1,
            message: `Radiant component importing from Think Tank: ${importPath}`,
            severity: 'error',
          });
        }

        if (isThinkTank && importPath.includes('radiant') && !isAllowedImport(importPath)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({
            line: line + 1,
            column: character + 1,
            message: `Think Tank component importing from Radiant: ${importPath}`,
            severity: 'error',
          });
        }

        // Warn about direct path imports to shared
        if (importPath.includes('packages/shared') && !importPath.includes('@radiant/shared')) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          violations.push({
            line: line + 1,
            column: character + 1,
            message: `Direct path import to shared package. Use @radiant/shared instead: ${importPath}`,
            severity: 'warning',
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return { file: filePath, violations };
}

function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (item !== 'node_modules' && item !== '.git' && item !== 'dist') {
        files.push(...findTypeScriptFiles(fullPath));
      }
    } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const rootDir = path.resolve(__dirname, '../..');
  const allPaths = [...RADIANT_PATHS, ...THINKTANK_PATHS];

  console.log('🔍 AST-based discrete validation');
  console.log('');

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const componentPath of allPaths) {
    const fullPath = path.join(rootDir, componentPath);
    const files = findTypeScriptFiles(fullPath);

    for (const file of files) {
      const result = validateFile(file);

      if (result.violations.length > 0) {
        console.log(`\n📄 ${path.relative(rootDir, file)}`);

        for (const violation of result.violations) {
          const icon = violation.severity === 'error' ? '❌' : '⚠️';
          console.log(`  ${icon} Line ${violation.line}: ${violation.message}`);

          if (violation.severity === 'error') {
            totalErrors++;
          } else {
            totalWarnings++;
          }
        }
      }
    }
  }

  console.log('');
  console.log('─'.repeat(50));

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log('✅ No violations found');
    process.exit(0);
  } else {
    console.log(`Found ${totalErrors} error(s) and ${totalWarnings} warning(s)`);
    if (totalErrors > 0) {
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});

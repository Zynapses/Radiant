#!/usr/bin/env npx ts-node

/**
 * RADIANT Documentation Generator
 * 
 * Generates administrator documentation with current version and date.
 * Run as part of the build process to ensure docs are always up-to-date.
 */

import * as fs from 'fs';
import * as path from 'path';

const RADIANT_VERSION = '4.17.0';
const DOCS_DIR = path.join(__dirname, '..', 'docs');
const OUTPUT_DIR = path.join(__dirname, '..', 'dist', 'docs');

interface DocConfig {
  source: string;
  output: string;
  variables: Record<string, string>;
}

const BUILD_DATE = new Date().toISOString().split('T')[0];
const DOMAIN_PLACEHOLDER = '{{RADIANT_DOMAIN}}';

const defaultVariables: Record<string, string> = {
  '{{BUILD_DATE}}': BUILD_DATE,
  '{{RADIANT_VERSION}}': RADIANT_VERSION,
  '{{YEAR}}': new Date().getFullYear().toString(),
};

const docs: DocConfig[] = [
  {
    source: 'ADMINISTRATOR-GUIDE.md',
    output: 'ADMINISTRATOR-GUIDE.md',
    variables: defaultVariables,
  },
  {
    source: 'API_REFERENCE.md',
    output: 'API_REFERENCE.md',
    variables: defaultVariables,
  },
  {
    source: 'DEPLOYMENT-GUIDE.md',
    output: 'DEPLOYMENT-GUIDE.md',
    variables: defaultVariables,
  },
  {
    source: 'ARCHITECTURE.md',
    output: 'ARCHITECTURE.md',
    variables: defaultVariables,
  },
  {
    source: 'COMPLIANCE.md',
    output: 'COMPLIANCE.md',
    variables: defaultVariables,
  },
  {
    source: 'DISASTER_RECOVERY.md',
    output: 'DISASTER_RECOVERY.md',
    variables: defaultVariables,
  },
];

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function processTemplate(content: string, variables: Record<string, string>): string {
  let processed = content;
  
  for (const [placeholder, value] of Object.entries(variables)) {
    processed = processed.replace(new RegExp(escapeRegex(placeholder), 'g'), value);
  }
  
  return processed;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function generateDoc(config: DocConfig): void {
  const sourcePath = path.join(DOCS_DIR, config.source);
  const outputPath = path.join(OUTPUT_DIR, config.output);
  
  if (!fs.existsSync(sourcePath)) {
    console.warn(`⚠️  Source not found: ${config.source}`);
    return;
  }
  
  const content = fs.readFileSync(sourcePath, 'utf-8');
  const processed = processTemplate(content, config.variables);
  
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, processed);
  
  console.log(`✅ Generated: ${config.output}`);
}

function generateTableOfContents(): void {
  const tocPath = path.join(OUTPUT_DIR, 'INDEX.md');
  
  const toc = `# RADIANT v${RADIANT_VERSION} Documentation

> Generated: ${BUILD_DATE}

## Administrator Documentation

- [Administrator Guide](./ADMINISTRATOR-GUIDE.md) - Comprehensive admin documentation
- [API Reference](./API_REFERENCE.md) - REST API documentation
- [Deployment Guide](./DEPLOYMENT-GUIDE.md) - Deployment instructions
- [Architecture](./ARCHITECTURE.md) - System architecture overview
- [Compliance](./COMPLIANCE.md) - Security and compliance information
- [Disaster Recovery](./DISASTER_RECOVERY.md) - DR procedures

## Quick Links

| Resource | Description |
|----------|-------------|
| [Getting Started](./ADMINISTRATOR-GUIDE.md#2-getting-started) | Initial setup steps |
| [Tenant Management](./ADMINISTRATOR-GUIDE.md#4-tenant-management) | Managing tenants |
| [Billing](./ADMINISTRATOR-GUIDE.md#7-billing--subscriptions) | Billing configuration |
| [Troubleshooting](./ADMINISTRATOR-GUIDE.md#10-troubleshooting) | Common issues |

## Version Information

| Component | Version |
|-----------|---------|
| RADIANT Platform | ${RADIANT_VERSION} |
| Documentation | ${BUILD_DATE} |
| Node.js Required | >= 20.0.0 |
| TypeScript | >= 5.3.0 |

---

*This documentation index is automatically generated during the build process.*
`;

  fs.writeFileSync(tocPath, toc);
  console.log('✅ Generated: INDEX.md');
}

function generateVersionJson(): void {
  const versionPath = path.join(OUTPUT_DIR, 'version.json');
  
  const version = {
    version: RADIANT_VERSION,
    buildDate: BUILD_DATE,
    buildTimestamp: new Date().toISOString(),
    docs: docs.map(d => d.output),
  };
  
  fs.writeFileSync(versionPath, JSON.stringify(version, null, 2));
  console.log('✅ Generated: version.json');
}

function copyRunbooks(): void {
  const runbooksSource = path.join(DOCS_DIR, 'runbooks');
  const runbooksOutput = path.join(OUTPUT_DIR, 'runbooks');
  
  if (!fs.existsSync(runbooksSource)) {
    console.warn('⚠️  Runbooks directory not found');
    return;
  }
  
  ensureDir(runbooksOutput);
  
  const files = fs.readdirSync(runbooksSource);
  for (const file of files) {
    if (file.endsWith('.md')) {
      const content = fs.readFileSync(path.join(runbooksSource, file), 'utf-8');
      const processed = processTemplate(content, defaultVariables);
      fs.writeFileSync(path.join(runbooksOutput, file), processed);
      console.log(`✅ Copied runbook: ${file}`);
    }
  }
}

function main(): void {
  console.log(`\n📚 RADIANT Documentation Generator v${RADIANT_VERSION}\n`);
  console.log(`Build Date: ${BUILD_DATE}\n`);
  console.log('─'.repeat(50));
  
  ensureDir(OUTPUT_DIR);
  
  // Generate main docs
  for (const doc of docs) {
    generateDoc(doc);
  }
  
  // Generate index and version
  generateTableOfContents();
  generateVersionJson();
  
  // Copy runbooks
  copyRunbooks();
  
  console.log('─'.repeat(50));
  console.log(`\n✨ Documentation generated in: ${OUTPUT_DIR}\n`);
}

main();

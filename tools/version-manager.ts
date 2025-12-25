#!/usr/bin/env npx ts-node
/**
 * RADIANT Version Manager
 * Manages version bumping, changelog updates, and package.json synchronization
 * 
 * Usage:
 *   npx ts-node tools/version-manager.ts bump [major|minor|patch|build]
 *   npx ts-node tools/version-manager.ts set <version>
 *   npx ts-node tools/version-manager.ts info
 */

import * as fs from 'fs';
import * as path from 'path';

// MARK: - Types

interface VersionConfig {
  version: string;
  components: {
    radiantPlatform: string;
    thinkTank: string;
  };
  migrations: {
    radiant: number;
    thinktank: number;
  };
  buildNumber: number;
  lastUpdated: string;
}

interface PackageJson {
  name: string;
  version: string;
  [key: string]: unknown;
}

// MARK: - Paths

const ROOT_DIR = path.resolve(__dirname, '..');
const VERSION_FILE = path.join(ROOT_DIR, 'VERSION');
const RADIANT_VERSION_FILE = path.join(ROOT_DIR, 'RADIANT_VERSION');
const THINKTANK_VERSION_FILE = path.join(ROOT_DIR, 'THINKTANK_VERSION');
const VERSION_HISTORY_FILE = path.join(ROOT_DIR, 'VERSION_HISTORY.json');
const CHANGELOG_FILE = path.join(ROOT_DIR, 'CHANGELOG.md');

const PACKAGE_JSON_PATHS = [
  'package.json',
  'packages/shared/package.json',
  'packages/infrastructure/package.json',
  'apps/admin-dashboard/package.json',
  'apps/swift-deployer/Package.swift',
];

// MARK: - Version Operations

function readVersion(): string {
  return fs.readFileSync(VERSION_FILE, 'utf-8').trim();
}

function writeVersion(version: string): void {
  fs.writeFileSync(VERSION_FILE, version + '\n');
  fs.writeFileSync(RADIANT_VERSION_FILE, version + '\n');
}

function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.').map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function formatVersion(major: number, minor: number, patch: number): string {
  return `${major}.${minor}.${patch}`;
}

// MARK: - Bump Operations

type BumpType = 'major' | 'minor' | 'patch' | 'build';

function bumpVersion(type: BumpType): string {
  const current = readVersion();
  const [major, minor, patch] = parseVersion(current);
  
  let newVersion: string;
  
  switch (type) {
    case 'major':
      newVersion = formatVersion(major + 1, 0, 0);
      break;
    case 'minor':
      newVersion = formatVersion(major, minor + 1, 0);
      break;
    case 'patch':
      newVersion = formatVersion(major, minor, patch + 1);
      break;
    case 'build':
      // Build just increments patch for now
      newVersion = formatVersion(major, minor, patch + 1);
      break;
  }
  
  console.log(`Bumping version: ${current} → ${newVersion}`);
  
  // Update version files
  writeVersion(newVersion);
  
  // Update all package.json files
  updatePackageJsonFiles(newVersion);
  
  // Update Swift Package.swift
  updateSwiftPackage(newVersion);
  
  // Update VERSION_HISTORY.json
  updateVersionHistory(newVersion, type);
  
  // Update CHANGELOG.md
  updateChangelog(newVersion);
  
  console.log(`✅ Version bumped to ${newVersion}`);
  
  return newVersion;
}

function setVersion(version: string): string {
  console.log(`Setting version to: ${version}`);
  
  // Validate version format
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('❌ Invalid version format. Use semver: x.y.z');
    process.exit(1);
  }
  
  writeVersion(version);
  updatePackageJsonFiles(version);
  updateSwiftPackage(version);
  updateVersionHistory(version, 'manual');
  updateChangelog(version);
  
  console.log(`✅ Version set to ${version}`);
  
  return version;
}

// MARK: - Package.json Updates

function updatePackageJsonFiles(version: string): void {
  console.log('Updating package.json files...');
  
  for (const relativePath of PACKAGE_JSON_PATHS) {
    if (relativePath.endsWith('.swift')) continue; // Skip Swift files here
    
    const fullPath = path.join(ROOT_DIR, relativePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`  Skipping (not found): ${relativePath}`);
      continue;
    }
    
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const pkg: PackageJson = JSON.parse(content);
      
      const oldVersion = pkg.version;
      pkg.version = version;
      
      fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n');
      console.log(`  Updated: ${relativePath} (${oldVersion} → ${version})`);
    } catch (error) {
      console.error(`  Error updating ${relativePath}:`, error);
    }
  }
}

// MARK: - Swift Package Update

function updateSwiftPackage(version: string): void {
  const swiftPath = path.join(ROOT_DIR, 'apps/swift-deployer/Package.swift');
  
  if (!fs.existsSync(swiftPath)) {
    console.log('  Skipping Swift Package.swift (not found)');
    return;
  }
  
  try {
    let content = fs.readFileSync(swiftPath, 'utf-8');
    
    // Update version constant if present
    content = content.replace(
      /let RADIANT_VERSION = "[^"]+"/,
      `let RADIANT_VERSION = "${version}"`
    );
    
    fs.writeFileSync(swiftPath, content);
    console.log(`  Updated: apps/swift-deployer/Package.swift`);
  } catch (error) {
    console.error('  Error updating Swift Package.swift:', error);
  }
}

// MARK: - Version History Update

interface VersionHistoryEntry {
  version: string;
  date: string;
  type: string;
  hash?: string;
}

function updateVersionHistory(version: string, type: string): void {
  console.log('Updating VERSION_HISTORY.json...');
  
  let history: { versions: VersionHistoryEntry[] } = { versions: [] };
  
  if (fs.existsSync(VERSION_HISTORY_FILE)) {
    try {
      history = JSON.parse(fs.readFileSync(VERSION_HISTORY_FILE, 'utf-8'));
    } catch {
      // Start fresh if parse fails
    }
  }
  
  // Add new entry
  const entry: VersionHistoryEntry = {
    version,
    date: new Date().toISOString().split('T')[0],
    type,
  };
  
  // Try to get git hash
  try {
    const { execSync } = require('child_process');
    entry.hash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    // Git not available
  }
  
  // Check if version already exists
  const existingIndex = history.versions.findIndex(v => v.version === version);
  if (existingIndex >= 0) {
    history.versions[existingIndex] = entry;
  } else {
    history.versions.unshift(entry);
  }
  
  fs.writeFileSync(VERSION_HISTORY_FILE, JSON.stringify(history, null, 2) + '\n');
  console.log('  Updated: VERSION_HISTORY.json');
}

// MARK: - Changelog Update

function updateChangelog(version: string): void {
  console.log('Updating CHANGELOG.md...');
  
  if (!fs.existsSync(CHANGELOG_FILE)) {
    console.log('  Skipping CHANGELOG.md (not found)');
    return;
  }
  
  const content = fs.readFileSync(CHANGELOG_FILE, 'utf-8');
  const date = new Date().toISOString().split('T')[0];
  
  // Check if version already has an entry
  if (content.includes(`## [${version}]`)) {
    console.log('  Version already in CHANGELOG.md');
    return;
  }
  
  // Find the first ## header and insert before it
  const newEntry = `## [${version}] - ${date}\n\n### Added\n\n- (Add new features here)\n\n### Changed\n\n- (Add changes here)\n\n### Fixed\n\n- (Add fixes here)\n\n`;
  
  const headerMatch = content.match(/^## \[/m);
  let newContent: string;
  
  if (headerMatch && headerMatch.index !== undefined) {
    newContent = content.slice(0, headerMatch.index) + newEntry + content.slice(headerMatch.index);
  } else {
    // No existing entries, add after header
    const headerEnd = content.indexOf('\n\n') + 2;
    newContent = content.slice(0, headerEnd) + newEntry + content.slice(headerEnd);
  }
  
  fs.writeFileSync(CHANGELOG_FILE, newContent);
  console.log('  Updated: CHANGELOG.md');
}

// MARK: - Info Command

function showInfo(): void {
  const version = readVersion();
  const [major, minor, patch] = parseVersion(version);
  
  console.log('RADIANT Version Information');
  console.log('===========================');
  console.log(`Current Version: ${version}`);
  console.log(`  Major: ${major}`);
  console.log(`  Minor: ${minor}`);
  console.log(`  Patch: ${patch}`);
  console.log('');
  
  // Show version files
  console.log('Version Files:');
  console.log(`  VERSION: ${fs.existsSync(VERSION_FILE) ? readVersion() : 'NOT FOUND'}`);
  
  if (fs.existsSync(RADIANT_VERSION_FILE)) {
    console.log(`  RADIANT_VERSION: ${fs.readFileSync(RADIANT_VERSION_FILE, 'utf-8').trim()}`);
  }
  
  if (fs.existsSync(THINKTANK_VERSION_FILE)) {
    console.log(`  THINKTANK_VERSION: ${fs.readFileSync(THINKTANK_VERSION_FILE, 'utf-8').trim()}`);
  }
  
  console.log('');
  
  // Show package.json versions
  console.log('Package Versions:');
  for (const relativePath of PACKAGE_JSON_PATHS) {
    if (relativePath.endsWith('.swift')) continue;
    
    const fullPath = path.join(ROOT_DIR, relativePath);
    if (fs.existsSync(fullPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        console.log(`  ${relativePath}: ${pkg.version}`);
      } catch {
        console.log(`  ${relativePath}: (parse error)`);
      }
    }
  }
}

// MARK: - Main

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'bump':
      const bumpType = args[1] as BumpType;
      if (!['major', 'minor', 'patch', 'build'].includes(bumpType)) {
        console.error('Usage: version-manager.ts bump [major|minor|patch|build]');
        process.exit(1);
      }
      bumpVersion(bumpType);
      break;
      
    case 'set':
      const newVersion = args[1];
      if (!newVersion) {
        console.error('Usage: version-manager.ts set <version>');
        process.exit(1);
      }
      setVersion(newVersion);
      break;
      
    case 'info':
      showInfo();
      break;
      
    default:
      console.log('RADIANT Version Manager');
      console.log('');
      console.log('Usage:');
      console.log('  npx ts-node tools/version-manager.ts bump [major|minor|patch|build]');
      console.log('  npx ts-node tools/version-manager.ts set <version>');
      console.log('  npx ts-node tools/version-manager.ts info');
      break;
  }
}

main();

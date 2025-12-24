module.exports = {
  // TypeScript and JavaScript
  '*.{ts,tsx,js,jsx}': [
    'eslint --fix',
    'prettier --write',
  ],
  
  // JSON files
  '*.json': [
    'prettier --write',
  ],
  
  // Markdown
  '*.md': [
    'prettier --write',
  ],
  
  // YAML
  '*.{yml,yaml}': [
    'prettier --write',
  ],
  
  // SQL migrations - just check syntax
  'packages/infrastructure/migrations/*.sql': [
    () => 'echo "SQL files changed - ensure migrations are tested"',
  ],
  
  // Package.json - check for version consistency
  'package.json': [
    () => 'pnpm install --frozen-lockfile',
  ],
};

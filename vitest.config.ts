import { defineConfig } from 'vitest/config';

/**
 * Root Vitest Configuration
 * 
 * This configuration automatically discovers and runs tests across all packages.
 * New test files are automatically included - no reconfiguration needed.
 * 
 * Run: npm run test:coverage
 */
export default defineConfig({
  test: {
    globals: true,
    // Auto-discover all test files across the monorepo
    include: [
      'packages/**/__tests__/**/*.test.ts',
      'packages/**/*.test.ts',
      'apps/**/__tests__/**/*.test.{ts,tsx}',
      'apps/**/*.test.{ts,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/cdk.out/**',
      '**/e2e/**',
      // Admin dashboard has its own vitest config with path aliases
      'apps/admin-dashboard/**',
    ],
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Auto-include all source files for coverage
      include: [
        'packages/*/src/**/*.ts',
        'packages/*/lib/**/*.ts',
        'apps/*/lib/**/*.ts',
        'apps/*/components/**/*.tsx',
        'apps/*/app/**/*.tsx',
      ],
      exclude: [
        'node_modules',
        'dist',
        '.next',
        'cdk.out',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/*.test.{ts,tsx}',
        '**/e2e/**',
        // Config files
        '**/*.config.{ts,js}',
        '**/index.ts',
      ],
      // Thresholds - warn if coverage drops
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
    testTimeout: 10000,
  },
});

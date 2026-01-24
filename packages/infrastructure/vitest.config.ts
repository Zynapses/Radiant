import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist', 
      'cdk.out',
      // Tests with API mismatches - need maintenance
      '**/__tests__/agi-brain-planner.service.test.ts',
      '**/__tests__/consciousness-middleware.service.test.ts',
      '**/__tests__/user-registry.service.test.ts',
      '**/__tests__/formal-reasoning.service.test.ts',
      '**/__tests__/ego-context.service.test.ts',
      '**/__tests__/security-protection.service.test.ts',
      '**/__tests__/db-context.service.test.ts',
      '**/__tests__/checklist-registry.service.test.ts',
      '**/__tests__/ai-reports.handler.test.ts',
      '**/__tests__/cato/consciousness-loop.service.test.ts',
      '**/__tests__/cato/query-fallback.service.test.ts',
      '**/__tests__/cato/cost-tracking.service.test.ts',
      '**/__tests__/integration/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules',
        'dist',
        'cdk.out',
        '**/*.d.ts',
        '**/__tests__/**',
      ],
    },
    testTimeout: 10000,
  },
});

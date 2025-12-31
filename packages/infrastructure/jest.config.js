/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'ES2020',
        esModuleInterop: true,
        skipLibCheck: true,
        strict: true,
        moduleResolution: 'node',
        resolveJsonModule: true,
        declaration: false,
        declarationMap: false,
        outDir: './dist',
        rootDir: '.',
        baseUrl: '.',
        paths: {
          '@radiant/shared/*': ['../shared/src/*'],
        },
      },
    }],
  },
  moduleNameMapper: {
    '^@radiant/shared/(.*)$': '<rootDir>/../shared/src/$1',
  },
  collectCoverageFrom: [
    'lambda/**/*.ts',
    '!lambda/**/*.d.ts',
    '!lambda/**/index.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};

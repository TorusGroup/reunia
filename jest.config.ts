import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Match tsconfig paths
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          // Override for tests: CommonJS modules work better with Jest
          module: 'commonjs',
          moduleResolution: 'node',
        },
      },
    ],
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/app/**', // Next.js route handlers — covered by integration tests
  ],
  // Mock heavy dependencies not needed in unit tests
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  globals: {},
}

export default config

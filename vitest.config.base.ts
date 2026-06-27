import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      include: ['src/**/*.ts'],
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
    exclude: ['dist/**', 'node_modules/**'],
export default defineConfig({
  test: {
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'test/**/*.test.ts'],
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
  },
});

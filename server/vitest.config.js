import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup-env.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/server.js'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
      },
    },
    // Each test file gets its own isolated context
    isolate: true,
    // Print the full error stack on failure
    reporter: 'verbose',
  },
});

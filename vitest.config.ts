import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // integration suites run against the real Neon dev branch; from a CI
    // runner each round-trip is 30-100ms+ and the first query pays a
    // cold-start. Ceilings, not sleeps — local runs stay as fast as ever.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});

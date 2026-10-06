import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Rules tests need the Firestore emulator: run them with `npm run test:rules`.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    // One emulator instance, shared data: never run files/tests in parallel
    fileParallelism: false,
    testTimeout: 20000,
    // The first file loads the rules into a cold emulator (JVM warm-up + rules compile), which can exceed 10 s
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

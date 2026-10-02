import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Unit tests live in tests/unit (mirroring src/); emulator tests live in tests/rules (see vitest.rules.config.mts).
// Only pure TypeScript logic (slices, selectors, geo, i18n, crypto, data) is unit-tested here;
// nothing under test may import react-native.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

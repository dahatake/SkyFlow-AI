import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        executive: resolve(import.meta.dirname, 'presentation/executive-briefing.html'),
        ciocto: resolve(import.meta.dirname, 'presentation/cio-cto-briefing.html'),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: { provider: 'v8', include: ['src/domain/**'], exclude: ['src/domain/types.ts'], reporter: ['text-summary', 'lcov'], thresholds: { lines: 80, statements: 80 } },
  },
});
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        executive: resolve(__dirname, 'presentation/executive-briefing.html'),
        ciocto: resolve(__dirname, 'presentation/cio-cto-briefing.html'),
      },
    },
  },
  test: { environment: 'node' },
});
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  test: { include: ['tests/**/*.test.{ts,tsx}'] },
  plugins: [react()],
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    // Python/Rust create locked temporaries under .cache; watching them raises
    // EBUSY on Windows and leaves the dev server unresponsive. The environments
    // and project storage are not UI sources either.
    watch: {
      ignored: /[\\/](?:\.cache|\.tools|\.venv|projects|src-tauri|dist)[\\/]/,
    },
  },
  envPrefix: ['VITE_'],
  build: { target: 'es2022' },
});

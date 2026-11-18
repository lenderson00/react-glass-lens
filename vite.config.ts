import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The site imports the library from source, so edits show up instantly.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-glass-lens': resolve(import.meta.dirname, 'packages/react-glass-lens/src/index.ts'),
    },
  },
  server: { port: 5199 },
});

import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  envPrefix: ['VITE_', 'METICULOUS_'],
  plugins: [react()],
  resolve: {
    alias: {
      '@shotlab/meticulous-client': path.resolve(
        __dirname,
        '../../packages/meticulous-client/src/index.ts',
      ),
    },
  },
});

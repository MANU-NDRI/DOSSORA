import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const rootDir = import.meta.dirname;

export default defineConfig({
  root: rootDir,
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(rootDir, 'src') } },
  test: { environment: 'node', setupFiles: ['./vitest.setup.ts'], include: ['src/**/*.test.ts'] },
  build: { target: 'es2020' },
});

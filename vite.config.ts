import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Relative base so the build works both on GitHub Pages (/<repo>/) and locally.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 900 },
});

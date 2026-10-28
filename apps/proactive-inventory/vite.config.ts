import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built output is committed to /proactive-inventory so GitHub Pages serves it
// at https://laksiri-fernando.github.io/proactive-inventory/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: '../../proactive-inventory',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
  },
});

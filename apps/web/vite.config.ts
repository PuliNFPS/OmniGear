import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  test: { setupFiles: ['./src/test/setupCore.ts'] },
  build: {
    rollupOptions: {
      input: {
        // The read-only RAWM probe is its own entry so it never mounts the
        // editor, which applies changes to hardware as soon as a control moves.
        main: 'index.html',
        diagnostico: 'diagnostico.html',
      },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Ports are pinned (strictPort) so several demos can run side by side.
// 3251 is the port assigned for this POC on the astrikos.xyz server.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 3251, strictPort: true },
  preview: { host: true, port: 3251, strictPort: true },
  build: { chunkSizeWarningLimit: 2500 },
});

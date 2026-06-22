import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // split heavy vendors so the main app chunk stays lean and cacheable
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          physics: ['matter-js', 'poly-decomp'],
          vendor: ['react', 'react-dom', 'uuid', 'lucide-react'],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.js'],
    environment: 'node',
  },
});

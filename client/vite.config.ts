/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          const reactPkgs = ['react', 'react-dom'];
          if (reactPkgs.some(pkg => id.includes(`node_modules/${pkg}`))) return 'vendor-react';

          if (id.includes('node_modules/framer-motion')) return 'vendor-framer';

          const radixPkgs = [
            '@radix-ui/react-slot',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ];
          if (radixPkgs.some(pkg => id.includes(`node_modules/${pkg}`))) return 'vendor-radix';

          return undefined;
        },
      },
    },
  },
})

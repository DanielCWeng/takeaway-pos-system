// client/vite.config.ts

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // This correctly loads .env files from the `client` folder
    const env = loadEnv(mode, process.cwd(), ''); 
    return {
      // No server port defined here, so Vite will use its default (usually 5173)
      // This avoids conflict with our backend server on port 4000.
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
            // The '@' alias now correctly points to your source folder
          '@': path.resolve(__dirname, './src'), 
        }
      }
    };
});
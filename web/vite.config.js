import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Dev proxy
    proxy: {
      '/api': 'http://localhost:3000',
      '/ota': 'http://localhost:3000',
      '/ws':  { target: 'ws://localhost:3000', ws: true },
    }
  },
  build: {
    sourcemap: false,       // source code hide
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true },
      mangle:   { toplevel: true },
    },
    rollupOptions: {
      output: {
        // Random chunk names — harder to reverse engineer
        chunkFileNames: 'assets/[hash].js',
        entryFileNames: 'assets/[hash].js',
        assetFileNames: 'assets/[hash].[ext]',
      }
    }
  }
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 8018,
    allowedHosts: [
      'ai.liuyunxx.com',
      'localhost',
      '127.0.0.1'
    ],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5656',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
        ws: true
      }
    }
  },
  build: {
    outDir: path.join(__dirname, 'py-src', 'data_formulator', "dist"),
    rollupOptions: {
      output: {
        entryFileNames: `DataFormulator.js`,  // specific name for the main JS bundle
        chunkFileNames: `assets/[name]-[hash].js`, // keep default naming for chunks
        assetFileNames: `assets/[name]-[hash].[ext]` // keep default naming for other assets
      }
    }
  },
});

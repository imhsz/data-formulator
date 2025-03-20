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
    strictPort: true,
    open: true,
    cors: true,
    hmr: {
      host: 'localhost',
    },
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5656',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
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

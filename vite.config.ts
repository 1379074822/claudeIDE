import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      input: { main: path.resolve(__dirname, 'index.html') },
      output: {
        manualChunks: {
          'monaco-editor': ['monaco-editor'],
          'react-vendor': ['react', 'react-dom'],
          'markdown': ['react-markdown', 'remark-gfm', 'react-syntax-highlighter'],
        },
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src/renderer') },
  },
  server: { port: 5173 },
  optimizeDeps: {
    include: ['monaco-editor'],
  },
})

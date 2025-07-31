import { resolve } from 'node:path'

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/analytics.ts'),
      name: 'Analytics',
      fileName: () => 'analytics.js',
      formats: ['iife'],
    },
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Remove hash from filename
        entryFileNames: 'analytics.js',
      },
    },
  },
})

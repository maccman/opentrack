import { resolve } from 'node:path'

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/analytics.ts'),
      name: 'OpenTrackAnalytics',
      fileName: (format) => {
        const formatExtMap: Record<string, string> = {
          umd: 'analytics.umd.js',
          iife: 'analytics.iife.js',
        }
        return formatExtMap[format] || `analytics.${format}.js`
      },
      formats: ['umd', 'iife'],
    },
    outDir: 'dist',
    emptyOutDir: false, // Don't clear the dist directory
    rollupOptions: {
      output: {
        name: 'OpenTrackAnalytics',
        exports: 'default',
      },
    },
    minify: 'terser',
    sourcemap: true,
  },
})

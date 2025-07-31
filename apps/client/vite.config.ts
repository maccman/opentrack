import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
      rollupTypes: true,
    }),
  ],
  server: {
    port: 3000,
    open: '/demo.html',
  },
  build: {
    lib: {
      entry: {
        // Main universal entry point
        index: resolve(__dirname, 'src/index.ts'),
        // Browser-specific entry point
        analytics: resolve(__dirname, 'src/analytics.ts'),
        // Server-specific entry point
        server: resolve(__dirname, 'src/server.ts'),
      },
      name: 'OpenTrackAnalytics',
      fileName: (format, entryName) => {
        const formatExtMap: Record<string, string> = {
          es: 'esm.js',
          cjs: 'cjs.js',
        }
        return `${entryName}.${formatExtMap[format] || `${format}.js`}`
      },
      formats: ['es', 'cjs'], // Only ESM and CJS for multi-entry builds
    },
    outDir: 'dist',
    rollupOptions: {
      external: [],
      output: {
        exports: 'named',
      },
    },
    minify: 'terser',
    sourcemap: true,
  },
})

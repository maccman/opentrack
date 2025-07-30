import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    // You might want to add a setup file here if needed, e.g.:
    // setupFiles: './src/setupTests.ts',
  },
})

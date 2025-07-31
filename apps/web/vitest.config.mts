import { defineConfig } from 'nitro-test-utils/config'

export default defineConfig({
  nitro: {
    global: true,
  },
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '*.config.*'],
    },
    testTimeout: 30000, // Allow more time for server startup
  },
})

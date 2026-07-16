import { fileURLToPath } from 'node:url'

import { defineConfig } from 'nitro-test-utils/config'

// Set WRITE_KEY before Nitro server builds
process.env.WRITE_KEY = 'test-write-key-for-integration'
process.env.OPENTRACK_SECRET = 'test-opentrack-secret-0123456789abcdef'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  nitro: {
    global: true,
  },
  // @ts-expect-error - nitro-test-utils types don't include test property but it works
  test: {
    environment: 'node',
    testTimeout: 60000,
    setupFiles: ['./tests/setup.ts'],
  },
})

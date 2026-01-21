import { defineConfig } from 'nitro-test-utils/config'

export default defineConfig({
  nitro: {
    global: true,
  },
  // @ts-expect-error - nitro-test-utils types don't include test property but it works
  test: {
    environment: 'node',
    testTimeout: 30000,
  },
})

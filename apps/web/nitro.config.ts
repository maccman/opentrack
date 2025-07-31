import { fileURLToPath } from 'node:url'

import { defineNitroConfig } from 'nitropack/config'

//https://nitro.unjs.io/config
export default defineNitroConfig({
  compatibilityDate: '2025-07-31',
  srcDir: 'src',

  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
  },
})

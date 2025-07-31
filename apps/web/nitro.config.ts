import { fileURLToPath } from 'node:url'

import { defineNitroConfig } from 'nitropack/config'

//https://nitro.unjs.io/config
export default defineNitroConfig({
  compatibilityDate: '2025-07-31',
  srcDir: 'src',

  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
  },

  // // CORS configuration using Route Rules - the proper Nitro way
  // routeRules: {
  //   // Enable CORS for all API routes
  //   '/v1/**': {
  //     cors: true,
  //     headers: {
  //       'Access-Control-Allow-Methods': 'POST, OPTIONS',
  //       'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  //       'Access-Control-Max-Age': '86400',
  //     },
  //   },
  // },
})

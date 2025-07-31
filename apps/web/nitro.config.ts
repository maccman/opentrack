import { fileURLToPath } from 'node:url'

//https://nitro.unjs.io/config
export default defineNitroConfig({
  srcDir: 'src',

  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
  },
})

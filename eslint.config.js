// Ocavue default config isn't working for some reason
import { defineConfig } from 'eslint-define-config'

export default defineConfig({
  ignores: ['**/*.md', '.nitro/'],
  rules: {
    // Require curly braces for all control statements
    curly: ['error', 'all'],
  },
})

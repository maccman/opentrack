import { defineESLintConfig } from '@ocavue/eslint-config'

export default defineESLintConfig({
  ignores: ['**/*.md', '.nitro/'],
  rules: {
    // Require curly braces for all control statements
    curly: ['error', 'all'],
  },
})

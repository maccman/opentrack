import { defineESLintConfig } from '@ocavue/eslint-config'

export default defineESLintConfig(
  {
    typescript: true,
    prettier: true,
  },
  {
    ignores: ['**/*.md', '.nitro/', '**/.nitro/', '**/.output/'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Disable usage of any type
      '@typescript-eslint/no-explicit-any': 'error',
      // Require curly braces for all control statements
      curly: ['error', 'all'],
    },
  }
)

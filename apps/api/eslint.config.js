import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/* Same base as apps/web/eslint.config.js, for Node instead of the browser. */
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'drizzle'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
    },
    rules: {
      // Request bodies are validated by Zod; `any` is how unvalidated shapes sneak past it.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // The smoke script reports each check as `cond ? ok(…) : fail(…)`; it reads as a checklist, so it stays.
    files: ['src/smoke.ts'],
    rules: { '@typescript-eslint/no-unused-expressions': ['error', { allowTernary: true }] },
  },
)

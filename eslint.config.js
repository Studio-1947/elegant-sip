import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      /* Project rules that encode decisions made in the audit. */

      // The privacy policy promises analytics never receives personal details,
      // and `console.log` has no home in a client with no logging backend.
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],

      // localStorage is user-editable; `any` is how unvalidated shapes sneak in.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Warn, not error. The remaining hits are deliberate "reset derived state
      // when a prop changes" effects (e.g. clearing the selected variant when
      // the product id changes). They are correct but worth a second look
      // before anyone adds another — failing the build on them would just
      // train people to disable the rule.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
)

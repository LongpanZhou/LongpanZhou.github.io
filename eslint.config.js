import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// ESLint 9 reads this file (the old .eslintrc.cjs is not read any more).
export default [
  { ignores: ['dist', 'modelviewer', 'node_modules', 'public', 'scripts', 'eslint.config.js'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { '@typescript-eslint': tsPlugin, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...tsPlugin.configs['eslint-recommended'].overrides[0].rules,
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Parameters named with a leading underscore are on purpose (the editor's empty default actions)
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Glue code for the 3D libraries uses these in a few places: shown, not failing
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
    },
  },
]

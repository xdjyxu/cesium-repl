import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  unocss: true,
  vue: true,
}, {
  files: ['examples/**/*.{js,ts,jsx,tsx}'],
  rules: {
    'no-console': 'off',
    'perfectionist/sort-imports': ['error', {
      customGroups: {
        value: {
          'cesium-first': ['^cesium$', '^Sandcastle$'],
        },
      },
      groups: [
        'cesium-first',
        'type-import',
        ['value-builtin', 'value-external'],
        'type-internal',
        'value-internal',
        ['type-parent', 'type-sibling', 'type-index'],
        ['value-parent', 'value-sibling', 'value-index'],
        'unknown',
      ],
    }],
  },
})

import antfu from '@antfu/eslint-config'

export default antfu({
  /**
   * Style
   */
  stylistic: {
    indent: 2,
    quotes: 'single',
    semi: false,

    overrides: {
      'no-console': 'warn', // Warn when using console
      'no-empty': 'warn', // Warn on empty code blocks
      'unused-imports/no-unused-vars': 'warn', // Warn on unused variables or imports

      'no-async-promise-executor': 'off', // Allow async functions in Promise constructors
      'node/prefer-global/process': 'off', // Don't enforce global process object
      'eqeqeq': 'off', // Don't enforce === and !==
      'no-sequences': 'off', // Allow comma operator
      'no-extend-native': 'off', // Allow extending native prototypes

      'ts/ban-ts-comment': 'off', // Allow @ts-ignore and other TypeScript comments
      'unicorn/no-new-array': 'off', // Allow new Array()
      'ts/no-unsafe-function-type': 'off', // Allow unsafe function types
      'eslint-comments/no-unlimited-disable': 'off', // Allow unlimited ESLint rule disabling
      'prefer-promise-reject-errors': 'off', // Allow Promise.reject() without parameters

      'no-useless-return': 'off', // Allow useless return statements
      'style/no-mixed-operators': 'off', // Allow mixing different operators
      'operator-linebreak': ['off', 'after', { /** Operators at end of line when breaking */
        overrides: {
          '||': 'after', // Logical OR at end of line
          '&&': 'after', // Logical AND at end of line
          '?': 'before', // Ternary ? at start of line
          ':': 'before', // Ternary : at start of line
        },
      }],
      'ts/no-use-before-define': 'off', // Allow using variables before definition
      'ts/consistent-type-definitions': 'off', // Allow both interface and type definitions
      'no-new': 'off',

      'style/max-statements-per-line': 'off', // Allow multiple statements per line
      'no-case-declarations': 'off', // Allow variable declarations in switch cases
      'accessor-pairs': 'off', // Allow accessor pairs in getters and setters
      'no-alert': 'off', // Allow alert()

      /**
       * This config doesn't work, still removes line breaks
       * Using incorrect config to disable it
       */
      /**
       * 'no-multiple-empty-lines': ['error', { max: 3, maxBOF: 0, maxEOF: 0 }],
       * 'no-multiple-empty-lines': {},
       */
    },
  },

  /**
   * Language config
   */
  jsonc: false,
  regexp: false,
  typescript: true,
  markdown: false,

  ignores: [
    'dist',
    'public',
    'node_modules',
    '**/*.json',
    '**/*.jsonc',
    '**/*.json5',
    '**/*.d.ts',
  ],
})

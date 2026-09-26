import globals from 'globals';
export default [
  // ── The app (web/) ────────────────────────────────────────────────
  {
    files: ['web/src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]', args: 'none', ignoreRestSiblings: true }],
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-const-assign': 'error',
      'no-self-assign': 'error',
      'no-cond-assign': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-duplicate-case': 'error',
      'no-fallthrough': 'error',
      'eqeqeq': ['warn', 'smart'],
    },
  },
  {
    files: ['web/public/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser, ...globals.serviceworker } },
  },
  {
    files: ['web/tools/**/*.mjs', 'vite.config.mjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
  },
  // ── Legacy multi-page site (kept for reference, no longer built) ───
  {
    files: ['*.js'],
    ignores: ['node_modules/**','dist/**','functions/**','scripts/**','tests/**','_audit.mjs','_dbg*.mjs','_fb-mock.js','seed*.js','test-geohub.js','eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2022, sourceType: 'script',
      globals: { ...globals.browser, ...globals.serviceworker,
        GeoHub:'writable', GeoFirebase:'writable', GHI18N:'writable', GHt:'writable', GeoSocial:'writable',
        firebase:'writable', maplibregl:'writable', Stripe:'writable', supercluster:'writable', Supercluster:'writable',
        html2canvas:'writable', QRCode:'writable', Chart:'writable', gtag:'writable', dataLayer:'writable',
        GeoCurrentUser:'writable', GeoAuthReady:'writable', GeoConfig:'writable', GeoSchema:'writable',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-dupe-class-members': 'error',
      'no-unreachable': 'warn',
      'no-func-assign': 'error',
      'no-const-assign': 'error',
      'no-self-assign': 'warn',
      'no-cond-assign': 'warn',
      'no-empty-pattern': 'error',
      'no-obj-calls': 'error',
      'no-sparse-arrays': 'warn',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-unsafe-negation': 'error',
      'no-duplicate-case': 'error',
      'no-fallthrough': 'warn',
      'no-redeclare': 'warn',
    },
  },
];

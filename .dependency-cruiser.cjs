/**
 * Initialized with `pnpm exec depcruise --init yes` using dependency-cruiser 18.2.0,
 * then adapted to OmniGear's TypeScript monorepo and WASM bridge boundaries.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular-runtime-dependencies',
      comment: 'Runtime cycles make module initialization order fragile.',
      severity: 'error',
      from: {},
      to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } },
    },
    {
      name: 'no-unresolved-imports',
      comment: 'Every analyzed import must resolve through the repository configuration.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'no-undeclared-packages',
      comment: 'Imported npm packages must be declared in a package manifest.',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'no-imports-from-tests',
      comment: 'Production modules must not depend on test implementation files.',
      severity: 'error',
      from: { pathNot: '[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$' },
      to: { path: '[.](?:spec|test)[.](?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$' },
    },
    {
      name: 'packages-do-not-depend-on-apps',
      comment: 'Reusable packages must remain independent from application code.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'apps-do-not-depend-on-other-apps',
      comment: 'Applications must not import implementation from sibling applications.',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/([^/]+)/', pathNot: '^apps/$1/' },
    },
    {
      name: 'wasm-only-through-core-bridge',
      comment: 'Web code must access generated WASM bindings through coreBridge.ts.',
      severity: 'error',
      from: { path: '^apps/web/src/(?!core/coreBridge\\.ts$)' },
      to: { path: '(^|/)packages/core/pkg/index\\.js$|(^|/)gearhub-core-wasm($|/)' },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
      dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-bundled', 'npm-no-pkg'],
    },
    detectProcessBuiltinModuleCalls: true,
    exclude: '(^|/)(dist|node_modules|target|\\.turbo)(/|$)',
    tsConfig: { fileName: 'tsconfig.audit.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.tsx', '.ts', '.mjs', '.js', '.d.ts', '.cjs'],
      mainFields: ['main', 'types', 'typings'],
    },
    skipAnalysisNotInRules: true,
  },
};

/** @type {import('dependency-cruiser').IConfiguration} */
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
      name: 'packages-do-not-depend-on-apps',
      comment: 'Reusable packages must remain independent from application code.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
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
    doNotFollow: { dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer'] },
    exclude: '(^|/)(dist|node_modules|target|\\.turbo)(/|$)',
    tsConfig: { fileName: 'tsconfig.audit.json' },
    tsPreCompilationDeps: true,
  },
};

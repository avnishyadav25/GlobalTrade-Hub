// Vitest stub for the `server-only` package.
//
// `server-only`'s default export throws on import outside a React Server Component
// bundle, which meant every module guarded by it — router.ts, cache.ts, the provider
// layer — was untestable. The Next build still enforces the real guard; this alias
// exists only under vitest (see vitest.config.mts).
export {};

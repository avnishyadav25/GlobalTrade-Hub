import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Unit tests cover the pure domain modules only (paperEngine, backtestEngine,
// scanner, coach, auth, and the market-data resolution layer). No DOM environment
// is needed — anything that touches React or a Zustand store is exercised through
// the app, not here.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
            // `server-only` throws on import outside an RSC bundle, which made every
            // module that imports it untestable. The real guard still applies in the
            // Next build; this only relaxes it for vitest.
            'server-only': fileURLToPath(new URL('./src/test/server-only.ts', import.meta.url)),
        },
    },
});

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Unit tests cover the pure domain modules only (paperEngine, backtestEngine,
// scanner, coach, auth). No DOM environment is needed — anything that touches
// React or a Zustand store is exercised through the app, not here.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
});

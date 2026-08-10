import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    authConfigStatus,
    missingAuthVars,
    createSession,
    verifySession,
    checkAdminCredentials,
    safeNextPath,
} from './auth';

const AUTH_VARS = ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'AUTH_SECRET'] as const;
let saved: Record<string, string | undefined>;

beforeEach(() => {
    saved = Object.fromEntries(AUTH_VARS.map((k) => [k, process.env[k]]));
    for (const k of AUTH_VARS) delete process.env[k];
});

afterEach(() => {
    for (const k of AUTH_VARS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
    }
});

function configure() {
    process.env.ADMIN_EMAIL = 'boss@example.com';
    process.env.ADMIN_PASSWORD = 'correct-horse';
    process.env.AUTH_SECRET = 'a-long-random-secret-value';
}

describe('authConfigStatus', () => {
    it('is disabled when nothing is set', () => {
        expect(authConfigStatus()).toBe('disabled');
    });

    it('is ready when all three are set', () => {
        configure();
        expect(authConfigStatus()).toBe('ready');
    });

    it('is misconfigured when AUTH_SECRET is missing', () => {
        process.env.ADMIN_EMAIL = 'boss@example.com';
        process.env.ADMIN_PASSWORD = 'correct-horse';
        expect(authConfigStatus()).toBe('misconfigured');
        expect(missingAuthVars()).toEqual(['AUTH_SECRET']);
    });
});

describe('session signing', () => {
    it('round-trips a valid session', async () => {
        configure();
        const token = await createSession('boss@example.com');
        await expect(verifySession(token)).resolves.toMatchObject({ email: 'boss@example.com' });
    });

    it('rejects a tampered payload', async () => {
        configure();
        const token = await createSession('boss@example.com');
        const [, sig] = token.split('.');
        const forgedBody = Buffer.from(JSON.stringify({ email: 'attacker@evil.com', exp: Date.now() + 1e6 }))
            .toString('base64url');
        await expect(verifySession(`${forgedBody}.${sig}`)).resolves.toBeNull();
    });

    it('rejects an expired session', async () => {
        configure();
        const body = Buffer.from(JSON.stringify({ email: 'boss@example.com', exp: Date.now() - 1 })).toString(
            'base64url'
        );
        // Sign it properly so only expiry can be the reason for rejection.
        const token = await createSession('boss@example.com', -1);
        expect(token.split('.')).toHaveLength(2);
        await expect(verifySession(token)).resolves.toBeNull();
        await expect(verifySession(`${body}.not-a-real-signature`)).resolves.toBeNull();
    });

    it('rejects a session signed with the old hardcoded fallback secret', async () => {
        // Regression guard for the removed DEFAULT_SECRET. A cookie minted with the
        // previously-published constant must not authenticate once creds are set.
        configure();
        process.env.AUTH_SECRET = 'gth-dev-secret-change-me';
        const forged = await createSession('attacker@evil.com');
        configure(); // back to the real secret
        await expect(verifySession(forged)).resolves.toBeNull();
    });

    it('rejects every session while misconfigured', async () => {
        configure();
        const token = await createSession('boss@example.com');
        delete process.env.AUTH_SECRET;
        await expect(verifySession(token)).resolves.toBeNull();
    });
});

describe('checkAdminCredentials', () => {
    it('accepts anything in demo mode', async () => {
        await expect(checkAdminCredentials('', '')).resolves.toBe(true);
    });

    it('fails closed when misconfigured', async () => {
        process.env.ADMIN_EMAIL = 'boss@example.com';
        process.env.ADMIN_PASSWORD = 'correct-horse';
        await expect(checkAdminCredentials('boss@example.com', 'correct-horse')).resolves.toBe(false);
    });

    it('accepts only the exact credentials', async () => {
        configure();
        await expect(checkAdminCredentials('boss@example.com', 'correct-horse')).resolves.toBe(true);
        await expect(checkAdminCredentials('boss@example.com', 'wrong')).resolves.toBe(false);
        await expect(checkAdminCredentials('someone@else.com', 'correct-horse')).resolves.toBe(false);
    });
});

describe('safeNextPath', () => {
    it('keeps same-origin paths', () => {
        expect(safeNextPath('/portfolio')).toBe('/portfolio');
        expect(safeNextPath('/trade/BTC?a=1')).toBe('/trade/BTC?a=1');
    });

    it('rejects off-origin and protocol-relative targets', () => {
        for (const bad of [
            'https://evil.example',
            '//evil.example',
            '/\\evil.example',
            '/path\\..\\x',
            'javascript:alert(1)',
            '',
            null,
            undefined,
        ]) {
            expect(safeNextPath(bad)).toBe('/terminal');
        }
    });
});

// Edge-compatible signed-session helpers (HMAC-SHA256 via Web Crypto — no deps,
// works in middleware and route handlers). Single super-admin from env.
//
// Auth is all-or-nothing: either none of ADMIN_EMAIL / ADMIN_PASSWORD / AUTH_SECRET
// are set (open demo mode), or all three are. A partial configuration is treated as
// 'misconfigured' and fails CLOSED — previously a deployment with credentials but no
// AUTH_SECRET would gate the app while signing sessions with a hardcoded constant,
// so anyone could mint an admin cookie.

export const SESSION_COOKIE = 'gth_session';

function b64urlEncode(bytes: Uint8Array): string {
    let str = '';
    for (const b of bytes) str += String.fromCharCode(b);
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlEncodeStr(s: string): string {
    return b64urlEncode(new TextEncoder().encode(s));
}
function b64urlDecodeStr(s: string): string {
    const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

async function hmac(data: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
    return b64urlEncode(new Uint8Array(sig));
}

/**
 * Constant-time string comparison.
 *
 * Both sides are hashed first so the comparison runs over fixed-length digests —
 * that keeps the loop count independent of the inputs and avoids leaking the length
 * of the secret, which a plain byte-wise compare would.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
    const enc = new TextEncoder();
    const [da, db] = await Promise.all([
        crypto.subtle.digest('SHA-256', enc.encode(a)),
        crypto.subtle.digest('SHA-256', enc.encode(b)),
    ]);
    const x = new Uint8Array(da);
    const y = new Uint8Array(db);
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
    return diff === 0;
}

export type AuthConfigStatus = 'disabled' | 'ready' | 'misconfigured';

/**
 * 'disabled'      — no auth env at all; open demo mode.
 * 'ready'         — email + password + secret all present.
 * 'misconfigured' — some but not all; callers MUST fail closed.
 */
export function authConfigStatus(): AuthConfigStatus {
    const parts = [process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD, process.env.AUTH_SECRET];
    const set = parts.filter((p) => Boolean(p && p.length)).length;
    if (set === 0) return 'disabled';
    if (set === parts.length) return 'ready';
    return 'misconfigured';
}

/** Names of the auth env vars that are missing (for operator-facing error copy). */
export function missingAuthVars(): string[] {
    return (
        [
            ['ADMIN_EMAIL', process.env.ADMIN_EMAIL],
            ['ADMIN_PASSWORD', process.env.ADMIN_PASSWORD],
            ['AUTH_SECRET', process.env.AUTH_SECRET],
        ] as const
    )
        .filter(([, v]) => !v)
        .map(([k]) => k);
}

function secret(): string {
    const s = process.env.AUTH_SECRET;
    // No fallback constant. Reaching here without a secret is a bug in the caller —
    // every entry point checks authConfigStatus() first.
    if (!s) throw new Error('AUTH_SECRET is not set');
    return s;
}

export interface Session {
    email: string;
    exp: number;
}

export async function createSession(email: string, days = 7): Promise<string> {
    const payload: Session = { email, exp: Date.now() + days * 864e5 };
    const body = b64urlEncodeStr(JSON.stringify(payload));
    const sig = await hmac(body, secret());
    return `${body}.${sig}`;
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
    if (authConfigStatus() !== 'ready') return null;
    if (!token || !token.includes('.')) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = await hmac(body, secret());
    if (!(await timingSafeEqual(sig, expected))) return null;
    try {
        const payload = JSON.parse(b64urlDecodeStr(body)) as Session;
        if (!payload.exp || payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

export async function checkAdminCredentials(email: string, password: string): Promise<boolean> {
    const status = authConfigStatus();
    // Fail closed on a partial configuration rather than accepting anything.
    if (status === 'misconfigured') return false;
    // In demo mode (no admin configured) accept anything so the app stays usable.
    if (status === 'disabled') return true;
    const [emailOk, passwordOk] = await Promise.all([
        timingSafeEqual(email, process.env.ADMIN_EMAIL!),
        timingSafeEqual(password, process.env.ADMIN_PASSWORD!),
    ]);
    return emailOk && passwordOk;
}

export function isAuthConfigured(): boolean {
    return authConfigStatus() === 'ready';
}

/** Parse the session cookie from a raw Request (works in node + edge). */
export async function getSessionFromRequest(req: Request): Promise<Session | null> {
    const cookie = req.headers.get('cookie') || '';
    const match = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    const token = match?.slice(SESSION_COOKIE.length + 1);
    return verifySession(token);
}

/** True when the request is an authenticated admin (or auth is not configured). */
export async function requireAdmin(req: Request): Promise<boolean> {
    const status = authConfigStatus();
    if (status === 'misconfigured') return false;
    if (status === 'disabled') return true;
    return Boolean(await getSessionFromRequest(req));
}

/**
 * Only same-origin absolute paths are safe post-login redirect targets.
 * Rejects absolute URLs, protocol-relative `//evil.com`, and backslash variants
 * that some browsers normalise to `/`.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/terminal'): string {
    if (!next) return fallback;
    if (!next.startsWith('/')) return fallback;
    if (next.startsWith('//') || next.startsWith('/\\')) return fallback;
    if (next.includes('\\')) return fallback;
    return next;
}

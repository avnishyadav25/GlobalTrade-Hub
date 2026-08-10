// Edge-compatible signed-session helpers (HMAC-SHA256 via Web Crypto — no deps,
// works in middleware and route handlers). Single super-admin from env.

export const SESSION_COOKIE = 'gth_session';
const DEFAULT_SECRET = 'gth-dev-secret-change-me';

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

function secret(): string {
    return process.env.AUTH_SECRET || DEFAULT_SECRET;
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
    if (!token || !token.includes('.')) return null;
    const [body, sig] = token.split('.');
    const expected = await hmac(body, secret());
    if (sig !== expected) return null;
    try {
        const payload = JSON.parse(b64urlDecodeStr(body)) as Session;
        if (!payload.exp || payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

export function checkAdminCredentials(email: string, password: string): boolean {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    // In demo mode (no admin configured) accept anything so the app stays usable.
    if (!adminEmail || !adminPassword) return true;
    return email === adminEmail && password === adminPassword;
}

export function isAuthConfigured(): boolean {
    return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
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
    if (!isAuthConfigured()) return true;
    return Boolean(await getSessionFromRequest(req));
}

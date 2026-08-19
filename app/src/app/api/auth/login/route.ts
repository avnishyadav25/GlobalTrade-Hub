import { NextResponse } from 'next/server';
import { checkAdminCredentials, createSession, SESSION_COOKIE, authConfigStatus, missingAuthVars } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
    let body: { email?: string; password?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    const email = body.email?.trim() ?? '';
    const password = body.password ?? '';
    if (authConfigStatus() === 'misconfigured') {
        return NextResponse.json(
            { error: `Auth is misconfigured on the server: ${missingAuthVars().join(', ')} not set.` },
            { status: 503 }
        );
    }
    if (!(await checkAdminCredentials(email, password))) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    const token = await createSession(email || 'admin');
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
    });
    return res;
}

export async function DELETE() {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
}

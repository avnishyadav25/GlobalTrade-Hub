import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE, authConfigStatus, missingAuthVars, safeNextPath } from '@/lib/auth';

// Gate all page routes behind the super-admin session. API routes self-guard.
export async function proxy(req: NextRequest) {
    const status = authConfigStatus();

    // Partial auth config: fail CLOSED with an operator-facing message rather than
    // silently dropping into open demo mode.
    if (status === 'misconfigured') {
        return new NextResponse(
            `Auth is misconfigured: ${missingAuthVars().join(', ')} not set.\n` +
                'Set all of ADMIN_EMAIL, ADMIN_PASSWORD and AUTH_SECRET, or none of them.',
            { status: 503, headers: { 'content-type': 'text/plain' } }
        );
    }

    // When no admin is configured, run in open demo mode.
    if (status === 'disabled') return NextResponse.next();

    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (session) return NextResponse.next();

    const url = req.nextUrl.clone();
    url.pathname = '/auth/login';
    url.search = '';
    // Only ever hand a same-origin path to the login page.
    url.searchParams.set('next', safeNextPath(req.nextUrl.pathname));
    return NextResponse.redirect(url);
}

export const config = {
    // everything except: api, next internals, auth pages, static assets
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|auth).*)'],
};

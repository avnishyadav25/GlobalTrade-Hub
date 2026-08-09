import { NextResponse, type NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE, isAuthConfigured } from '@/lib/auth';

// Gate all page routes behind the super-admin session. API routes self-guard.
export async function middleware(req: NextRequest) {
    // When no admin is configured, run in open demo mode.
    if (!isAuthConfigured()) return NextResponse.next();

    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (session) return NextResponse.next();

    const url = req.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
}

export const config = {
    // everything except: api, next internals, auth pages, static assets
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|auth).*)'],
};

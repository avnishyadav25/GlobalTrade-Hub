import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="mono text-3xl font-bold text-faint">404</div>
            <p className="text-base text-foreground-muted">That screen doesn’t exist.</p>
            <Link href="/terminal" className="rounded-lg px-4 py-2 text-base font-bold" style={{ background: 'var(--accent)', color: 'var(--cp-text)' }}>
                Back to the terminal
            </Link>
        </div>
    );
}

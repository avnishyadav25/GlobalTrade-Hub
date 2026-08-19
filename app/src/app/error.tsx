'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error('[route error]', error);
    }, [error]);

    return (
        <div className="flex min-h-[60vh] items-center justify-center px-6">
            <div className="panel max-w-md p-6">
                <div className="mb-2 text-lg font-bold text-down">Something went wrong</div>
                <p className="mb-4 text-base text-foreground-muted">
                    This screen failed to render. Your paper account and settings are unaffected.
                </p>
                <pre className="mono mb-4 max-h-32 overflow-auto rounded-lg bg-background px-3 py-2 text-xs text-faint">
                    {error.message}
                    {error.digest ? `\ndigest: ${error.digest}` : ''}
                </pre>
                <button
                    onClick={reset}
                    className="rounded-lg px-4 py-2 text-base font-bold"
                    style={{ background: 'var(--accent)', color: 'var(--cp-text)' }}
                >
                    Try again
                </button>
            </div>
        </div>
    );
}

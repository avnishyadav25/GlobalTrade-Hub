'use client';

// Catches failures in the root layout itself, where app/error.tsx cannot help.
// Must render its own <html>/<body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <html lang="en">
            <body style={{ background: '#0a0c10', color: '#e6e9ef', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                    <div style={{ maxWidth: 420 }}>
                        <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>GlobalTrade Hub failed to start</h1>
                        <p style={{ fontSize: 13, color: '#7a8494', marginBottom: 16 }}>{error.message}</p>
                        <button onClick={reset} style={{ background: '#7c8cff', color: '#0a0c10', border: 0, borderRadius: 8, padding: '8px 16px', fontWeight: 700 }}>
                            Reload
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}

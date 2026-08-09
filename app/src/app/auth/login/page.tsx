'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

function LoginForm() {
    const router = useRouter();
    const params = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);

    const signIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error('Sign in failed', { description: data.error ?? 'Invalid credentials' });
                return;
            }
            router.push(params.get('next') || '/terminal');
            router.refresh();
        } catch {
            toast.error('Sign in failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <form onSubmit={signIn} className="flex flex-col gap-3">
            <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border border-border bg-background px-3.5 py-2.5 text-[13px] outline-none focus:border-accent" />
            <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-lg border border-border bg-background px-3.5 py-2.5 text-[13px] outline-none focus:border-accent" />
            <button disabled={busy} className="mt-1 rounded-lg bg-accent py-2.5 text-[14px] font-bold text-[color:var(--cp-text)] disabled:opacity-60">
                {busy ? 'Signing in…' : 'Sign in'}
            </button>
        </form>
    );
}

export default function LoginPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-[380px]">
                <div className="mb-8 flex items-center justify-center gap-2.5">
                    <div className="gradient-brand flex h-8 w-8 items-center justify-center rounded-lg text-lg font-extrabold text-white">G</div>
                    <span className="text-lg font-extrabold">GlobalTrade<span className="text-accent"> Hub</span></span>
                </div>
                <div className="panel p-6">
                    <h1 className="mb-1 text-xl font-extrabold">Sign in</h1>
                    <p className="mb-5 text-[13px] text-foreground-muted">Admin access to your trading terminal.</p>
                    <Suspense fallback={null}>
                        <LoginForm />
                    </Suspense>
                    <div className="mt-3 text-center text-[11.5px] text-faint">
                        Uses the admin credentials from your environment. If none are set, any login works (demo mode).
                    </div>
                </div>
            </div>
        </div>
    );
}

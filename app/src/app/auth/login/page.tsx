'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);

    const signIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        const supabase = getSupabaseClient();
        if (supabase) {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            setBusy(false);
            if (error) return toast.error('Sign in failed', { description: error.message });
            router.push('/terminal');
        } else {
            setTimeout(() => { setBusy(false); router.push('/terminal'); }, 500);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <div className="w-full max-w-[380px]">
                <div className="mb-8 flex items-center justify-center gap-2.5">
                    <div className="gradient-brand flex h-8 w-8 items-center justify-center rounded-lg text-lg font-extrabold text-white">G</div>
                    <span className="text-lg font-extrabold">GlobalTrade<span className="text-accent"> Hub</span></span>
                </div>
                <div className="panel p-6">
                    <h1 className="mb-1 text-xl font-extrabold">Welcome back</h1>
                    <p className="mb-5 text-[13px] text-foreground-muted">Sign in to your trading terminal.</p>
                    <form onSubmit={signIn} className="flex flex-col gap-3">
                        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border border-border bg-background px-3.5 py-2.5 text-[13px] outline-none focus:border-accent" />
                        <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-lg border border-border bg-background px-3.5 py-2.5 text-[13px] outline-none focus:border-accent" />
                        <button disabled={busy} className="mt-1 rounded-lg bg-accent py-2.5 text-[14px] font-bold text-[color:var(--cp-text)] disabled:opacity-60">
                            {busy ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>
                    {!isSupabaseConfigured() && (
                        <div className="mt-3 text-center text-[11.5px] text-faint">Demo mode — any credentials continue. Configure Supabase to enable real auth.</div>
                    )}
                    <div className="mt-4 text-center text-[13px] text-foreground-muted">
                        New here? <Link href="/auth/signup" className="font-semibold text-accent">Create an account</Link>
                    </div>
                    <div className="mt-2 text-center">
                        <Link href="/terminal" className="text-[12px] text-faint hover:text-foreground">Continue as guest →</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

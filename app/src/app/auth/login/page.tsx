'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    Zap,
    Mail,
    Lock,
    Eye,
    EyeOff,
    ArrowRight,
    Github,
    Chrome,
} from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate login
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Redirect to dashboard (in production, this would validate credentials)
        window.location.href = '/';
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Branding */}
            <div
                className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
                style={{
                    background: 'linear-gradient(135deg, #0a0e17 0%, #1a1f35 50%, #0f1629 100%)',
                }}
            >
                <div>
                    <div className="flex items-center gap-3">
                        <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                            }}
                        >
                            <Zap size={28} color="white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold gradient-text">GlobalTrade</h1>
                            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Hub</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h2 className="text-4xl font-bold leading-tight">
                            One Screen.<br />
                            <span className="gradient-text">All Markets.</span>
                        </h2>
                        <p className="text-lg mt-4" style={{ color: 'var(--foreground-muted)' }}>
                            Trade Indian Equities, US Stocks, and Crypto from a single dashboard.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="grid grid-cols-3 gap-4"
                    >
                        {[
                            { value: '9+', label: 'Markets' },
                            { value: '<200ms', label: 'Latency' },
                            { value: '$0', label: 'Platform Fee' },
                        ].map((stat) => (
                            <div
                                key={stat.label}
                                className="p-4 rounded-xl"
                                style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                            >
                                <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
                                    {stat.value}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                    {stat.label}
                                </p>
                            </div>
                        ))}
                    </motion.div>
                </div>

                <div>
                    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        © 2026 GlobalTrade Hub. This is a technology platform, not a registered investment advisor.
                    </p>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div
                className="w-full lg:w-1/2 flex items-center justify-center p-8"
                style={{ background: 'var(--background)' }}
            >
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="w-full max-w-md"
                >
                    {/* Mobile Logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-8">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                            }}
                        >
                            <Zap size={22} color="white" />
                        </div>
                        <h1 className="text-xl font-bold gradient-text">GlobalTrade Hub</h1>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-2xl font-bold">Welcome back</h2>
                        <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
                            Sign in to access your trading dashboard
                        </p>
                    </div>

                    {/* Social Login */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <button
                            className="flex items-center justify-center gap-2 py-3 rounded-xl transition-all border"
                            style={{
                                background: 'var(--background-secondary)',
                                borderColor: 'var(--border)',
                            }}
                        >
                            <Chrome size={18} />
                            <span className="text-sm font-medium">Google</span>
                        </button>
                        <button
                            className="flex items-center justify-center gap-2 py-3 rounded-xl transition-all border"
                            style={{
                                background: 'var(--background-secondary)',
                                borderColor: 'var(--border)',
                            }}
                        >
                            <Github size={18} />
                            <span className="text-sm font-medium">GitHub</span>
                        </button>
                    </div>

                    <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t" style={{ borderColor: 'var(--border)' }} />
                        </div>
                        <div className="relative flex justify-center text-xs">
                            <span className="px-4" style={{ background: 'var(--background)', color: 'var(--foreground-muted)' }}>
                                or continue with email
                            </span>
                        </div>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm mb-2 block" style={{ color: 'var(--foreground-muted)' }}>
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail
                                    size={18}
                                    className="absolute left-3 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--foreground-muted)' }}
                                />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="input pl-10"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm mb-2 block" style={{ color: 'var(--foreground-muted)' }}>
                                Password
                            </label>
                            <div className="relative">
                                <Lock
                                    size={18}
                                    className="absolute left-3 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--foreground-muted)' }}
                                />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="input pl-10 pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--foreground-muted)' }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-4 h-4 rounded"
                                />
                                <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                                    Remember me
                                </span>
                            </label>
                            <Link
                                href="/auth/forgot-password"
                                className="text-sm font-medium"
                                style={{ color: 'var(--primary)' }}
                            >
                                Forgot password?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-70"
                            style={{
                                background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                            }}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="text-center text-sm mt-6" style={{ color: 'var(--foreground-muted)' }}>
                        Don't have an account?{' '}
                        <Link
                            href="/auth/signup"
                            className="font-semibold"
                            style={{ color: 'var(--primary)' }}
                        >
                            Create account
                        </Link>
                    </p>

                    {/* Demo Access */}
                    <div
                        className="mt-8 p-4 rounded-xl border"
                        style={{
                            background: 'var(--profit-dim)',
                            borderColor: 'rgba(34, 197, 94, 0.3)',
                        }}
                    >
                        <p className="text-sm font-medium" style={{ color: 'var(--profit)' }}>
                            🎉 Try Demo Mode
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
                            Skip login and explore with paper trading. No account required.
                        </p>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1 text-sm font-medium mt-2"
                            style={{ color: 'var(--profit)' }}
                        >
                            Enter Demo <ArrowRight size={14} />
                        </Link>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

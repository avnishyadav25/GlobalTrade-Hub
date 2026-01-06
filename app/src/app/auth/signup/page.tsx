'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap,
    Mail,
    Lock,
    User,
    Eye,
    EyeOff,
    ArrowRight,
    ArrowLeft,
    Check,
    Phone,
    Shield,
} from 'lucide-react';

const STEPS = [
    { id: 1, title: 'Account Details', icon: User },
    { id: 2, title: 'Security Setup', icon: Shield },
    { id: 3, title: 'Verification', icon: Check },
];

export default function SignupPage() {
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Form data
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        agreeToTerms: false,
        enable2FA: true,
    });

    const [showPassword, setShowPassword] = useState(false);

    const updateFormData = (field: string, value: string | boolean) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleNext = () => {
        if (currentStep < 3) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate signup
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Redirect to dashboard
        window.location.href = '/';
    };

    const passwordStrength = () => {
        const { password } = formData;
        if (!password) return { score: 0, label: '', color: '' };

        let score = 0;
        if (password.length >= 8) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        const labels = ['Weak', 'Fair', 'Good', 'Strong'];
        const colors = ['var(--loss)', 'var(--accent)', 'var(--primary)', 'var(--profit)'];

        return { score, label: labels[score - 1] || '', color: colors[score - 1] || '' };
    };

    const strength = passwordStrength();

    return (
        <div className="min-h-screen flex">
            {/* Left Side - Form */}
            <div
                className="w-full lg:w-1/2 flex flex-col p-8"
                style={{ background: 'var(--background)' }}
            >
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
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
                    <Link
                        href="/auth/login"
                        className="text-sm font-medium"
                        style={{ color: 'var(--primary)' }}
                    >
                        Sign In
                    </Link>
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="w-full max-w-md"
                    >
                        {/* Progress Steps */}
                        <div className="flex items-center justify-between mb-8">
                            {STEPS.map((step, index) => (
                                <div key={step.id} className="flex items-center">
                                    <div className="flex flex-col items-center">
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${currentStep >= step.id ? 'text-white' : ''
                                                }`}
                                            style={{
                                                background:
                                                    currentStep >= step.id
                                                        ? 'linear-gradient(135deg, var(--primary), var(--accent))'
                                                        : 'var(--background-tertiary)',
                                                color:
                                                    currentStep >= step.id ? 'white' : 'var(--foreground-muted)',
                                            }}
                                        >
                                            {currentStep > step.id ? (
                                                <Check size={18} />
                                            ) : (
                                                <step.icon size={18} />
                                            )}
                                        </div>
                                        <span
                                            className="text-xs mt-2 hidden sm:block"
                                            style={{
                                                color:
                                                    currentStep >= step.id
                                                        ? 'var(--foreground)'
                                                        : 'var(--foreground-muted)',
                                            }}
                                        >
                                            {step.title}
                                        </span>
                                    </div>
                                    {index < STEPS.length - 1 && (
                                        <div
                                            className="w-12 sm:w-20 h-0.5 mx-2"
                                            style={{
                                                background:
                                                    currentStep > step.id
                                                        ? 'var(--primary)'
                                                        : 'var(--border)',
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        <form onSubmit={handleSubmit}>
                            <AnimatePresence mode="wait">
                                {/* Step 1: Account Details */}
                                {currentStep === 1 && (
                                    <motion.div
                                        key="step1"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-4"
                                    >
                                        <div className="mb-6">
                                            <h2 className="text-2xl font-bold">Create your account</h2>
                                            <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
                                                Start trading across all markets in minutes
                                            </p>
                                        </div>

                                        <div>
                                            <label className="text-sm mb-2 block" style={{ color: 'var(--foreground-muted)' }}>
                                                Full Name
                                            </label>
                                            <div className="relative">
                                                <User
                                                    size={18}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2"
                                                    style={{ color: 'var(--foreground-muted)' }}
                                                />
                                                <input
                                                    type="text"
                                                    value={formData.fullName}
                                                    onChange={(e) => updateFormData('fullName', e.target.value)}
                                                    placeholder="John Doe"
                                                    className="input pl-10"
                                                    required
                                                />
                                            </div>
                                        </div>

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
                                                    value={formData.email}
                                                    onChange={(e) => updateFormData('email', e.target.value)}
                                                    placeholder="you@example.com"
                                                    className="input pl-10"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-sm mb-2 block" style={{ color: 'var(--foreground-muted)' }}>
                                                Phone Number
                                            </label>
                                            <div className="relative">
                                                <Phone
                                                    size={18}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2"
                                                    style={{ color: 'var(--foreground-muted)' }}
                                                />
                                                <input
                                                    type="tel"
                                                    value={formData.phone}
                                                    onChange={(e) => updateFormData('phone', e.target.value)}
                                                    placeholder="+91 98765 43210"
                                                    className="input pl-10"
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 2: Security Setup */}
                                {currentStep === 2 && (
                                    <motion.div
                                        key="step2"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-4"
                                    >
                                        <div className="mb-6">
                                            <h2 className="text-2xl font-bold">Secure your account</h2>
                                            <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
                                                Create a strong password to protect your funds
                                            </p>
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
                                                    value={formData.password}
                                                    onChange={(e) => updateFormData('password', e.target.value)}
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
                                            {formData.password && (
                                                <div className="mt-2">
                                                    <div className="flex gap-1 mb-1">
                                                        {[1, 2, 3, 4].map((i) => (
                                                            <div
                                                                key={i}
                                                                className="h-1 flex-1 rounded-full transition-all"
                                                                style={{
                                                                    background:
                                                                        i <= strength.score
                                                                            ? strength.color
                                                                            : 'var(--background-tertiary)',
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                    <p className="text-xs" style={{ color: strength.color }}>
                                                        {strength.label}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="text-sm mb-2 block" style={{ color: 'var(--foreground-muted)' }}>
                                                Confirm Password
                                            </label>
                                            <div className="relative">
                                                <Lock
                                                    size={18}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2"
                                                    style={{ color: 'var(--foreground-muted)' }}
                                                />
                                                <input
                                                    type="password"
                                                    value={formData.confirmPassword}
                                                    onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                                                    placeholder="••••••••"
                                                    className="input pl-10"
                                                    required
                                                />
                                                {formData.confirmPassword && formData.password === formData.confirmPassword && (
                                                    <Check
                                                        size={18}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2"
                                                        style={{ color: 'var(--profit)' }}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        <div
                                            className="p-4 rounded-xl border"
                                            style={{
                                                background: 'var(--background-secondary)',
                                                borderColor: 'var(--border)',
                                            }}
                                        >
                                            <label className="flex items-start gap-3 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.enable2FA}
                                                    onChange={(e) => updateFormData('enable2FA', e.target.checked)}
                                                    className="w-5 h-5 mt-0.5 rounded"
                                                />
                                                <div>
                                                    <p className="font-medium text-sm flex items-center gap-2">
                                                        <Shield size={16} style={{ color: 'var(--primary)' }} />
                                                        Enable Two-Factor Authentication
                                                    </p>
                                                    <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
                                                        Recommended for enhanced security. Use Google Authenticator or similar apps.
                                                    </p>
                                                </div>
                                            </label>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Step 3: Verification */}
                                {currentStep === 3 && (
                                    <motion.div
                                        key="step3"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-4"
                                    >
                                        <div className="mb-6">
                                            <h2 className="text-2xl font-bold">Almost there!</h2>
                                            <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
                                                Review and confirm your details
                                            </p>
                                        </div>

                                        {/* Summary */}
                                        <div
                                            className="p-4 rounded-xl space-y-3"
                                            style={{ background: 'var(--background-secondary)' }}
                                        >
                                            <div className="flex justify-between text-sm">
                                                <span style={{ color: 'var(--foreground-muted)' }}>Name</span>
                                                <span className="font-medium">{formData.fullName || 'Not provided'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span style={{ color: 'var(--foreground-muted)' }}>Email</span>
                                                <span className="font-medium">{formData.email || 'Not provided'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span style={{ color: 'var(--foreground-muted)' }}>Phone</span>
                                                <span className="font-medium">{formData.phone || 'Not provided'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span style={{ color: 'var(--foreground-muted)' }}>2FA</span>
                                                <span
                                                    className="font-medium"
                                                    style={{ color: formData.enable2FA ? 'var(--profit)' : 'var(--foreground-muted)' }}
                                                >
                                                    {formData.enable2FA ? 'Enabled' : 'Disabled'}
                                                </span>
                                            </div>
                                        </div>

                                        <label className="flex items-start gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.agreeToTerms}
                                                onChange={(e) => updateFormData('agreeToTerms', e.target.checked)}
                                                className="w-5 h-5 mt-0.5 rounded"
                                                required
                                            />
                                            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                                                I agree to the{' '}
                                                <Link href="/terms" className="underline" style={{ color: 'var(--primary)' }}>
                                                    Terms of Service
                                                </Link>{' '}
                                                and{' '}
                                                <Link href="/privacy" className="underline" style={{ color: 'var(--primary)' }}>
                                                    Privacy Policy
                                                </Link>
                                            </p>
                                        </label>

                                        <div
                                            className="p-4 rounded-xl"
                                            style={{
                                                background: 'var(--primary-dim)',
                                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                            }}
                                        >
                                            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                                <strong style={{ color: 'var(--primary)' }}>Note:</strong> You'll start with
                                                $100,000 in paper trading balance. KYC verification is required for live trading.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Navigation Buttons */}
                            <div className="flex gap-3 mt-8">
                                {currentStep > 1 && (
                                    <button
                                        type="button"
                                        onClick={handleBack}
                                        className="flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                                        style={{
                                            background: 'var(--background-secondary)',
                                            border: '1px solid var(--border)',
                                        }}
                                    >
                                        <ArrowLeft size={18} />
                                        Back
                                    </button>
                                )}
                                {currentStep < 3 ? (
                                    <button
                                        type="button"
                                        onClick={handleNext}
                                        className="flex-1 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2"
                                        style={{
                                            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                                        }}
                                    >
                                        Continue
                                        <ArrowRight size={18} />
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={isLoading || !formData.agreeToTerms}
                                        className="flex-1 py-3 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-70"
                                        style={{
                                            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                                        }}
                                    >
                                        {isLoading ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                Create Account
                                                <Check size={18} />
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </form>
                    </motion.div>
                </div>
            </div>

            {/* Right Side - Illustration */}
            <div
                className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12"
                style={{
                    background: 'linear-gradient(135deg, #0a0e17 0%, #1a1f35 50%, #0f1629 100%)',
                }}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-center"
                >
                    <div
                        className="w-64 h-64 rounded-3xl mx-auto mb-8 flex items-center justify-center"
                        style={{
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                        }}
                    >
                        <div className="text-center">
                            <div className="text-6xl mb-4">📈</div>
                            <p className="text-lg font-semibold gradient-text">Trade Smarter</p>
                            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                                Not Harder
                            </p>
                        </div>
                    </div>

                    <h3 className="text-2xl font-bold mb-4">Join 50,000+ traders</h3>
                    <p style={{ color: 'var(--foreground-muted)' }}>
                        Access real-time data across 9+ markets<br />
                        with our unified trading platform.
                    </p>

                    <div className="flex items-center justify-center gap-4 mt-8">
                        {['⭐', '⭐', '⭐', '⭐', '⭐'].map((star, i) => (
                            <span key={i} className="text-2xl">
                                {star}
                            </span>
                        ))}
                    </div>
                    <p className="text-sm mt-2" style={{ color: 'var(--foreground-muted)' }}>
                        Rated 4.9/5 by traders
                    </p>
                </motion.div>
            </div>
        </div>
    );
}

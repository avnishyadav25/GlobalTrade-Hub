'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Search,
    Bell,
    User,
    Sun,
    Moon,
    Wallet,
    ChevronDown,
} from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';

export function TopBar() {
    const [searchQuery, setSearchQuery] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const { isPaperTrading, paperBalance, togglePaperTrading } = useTradingStore();

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode);
        document.documentElement.setAttribute('data-theme', isDarkMode ? 'light' : 'dark');
    };

    return (
        <header
            className="fixed top-0 right-0 h-16 z-40 flex items-center justify-between px-4 md:px-6 transition-all duration-200"
            style={{
                left: isMobile ? 0 : '240px',
                background: 'var(--background-secondary)',
                borderBottom: '1px solid var(--border)',
            }}
        >
            {/* Spacer for mobile menu button */}
            <div className="lg:hidden w-12" />

            {/* Search Bar */}
            <div className="relative flex-1 max-w-lg hidden md:block">
                <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--foreground-muted)' }}
                />
                <input
                    type="text"
                    placeholder="Search assets, orders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg text-sm transition-colors"
                    style={{
                        background: 'var(--background-tertiary)',
                        border: '1px solid var(--border)',
                        color: 'var(--foreground)',
                    }}
                />
                <kbd
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-xs hidden lg:inline"
                    style={{
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        color: 'var(--foreground-muted)',
                    }}
                >
                    ⌘K
                </kbd>
            </div>

            {/* Mobile Search Icon */}
            <button
                className="md:hidden p-2 rounded-lg"
                style={{ background: 'var(--background-tertiary)' }}
            >
                <Search size={20} style={{ color: 'var(--foreground-muted)' }} />
            </button>

            {/* Right Section */}
            <div className="flex items-center gap-2 md:gap-4">
                {/* Paper Trading Toggle */}
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={togglePaperTrading}
                    className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-lg font-medium text-xs md:text-sm transition-all"
                    style={{
                        background: isPaperTrading ? 'var(--profit-dim)' : 'var(--primary-dim)',
                        color: isPaperTrading ? 'var(--profit)' : 'var(--primary)',
                    }}
                >
                    <span className={`w-2 h-2 rounded-full ${isPaperTrading ? 'bg-green-500 pulse-live' : 'bg-indigo-500'}`} />
                    <span className="hidden sm:inline">{isPaperTrading ? 'Paper' : 'Live'}</span>
                    <span className="sm:hidden">{isPaperTrading ? 'P' : 'L'}</span>
                </motion.button>

                {/* Balance */}
                <div
                    className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg"
                    style={{ background: 'var(--background-tertiary)' }}
                >
                    <Wallet size={16} style={{ color: 'var(--foreground-muted)' }} />
                    <span className="font-semibold text-sm">
                        ${(isPaperTrading ? paperBalance : 0).toLocaleString()}
                    </span>
                    <ChevronDown size={14} style={{ color: 'var(--foreground-muted)' }} />
                </div>

                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg transition-colors hidden sm:block"
                    style={{ background: 'var(--background-tertiary)' }}
                >
                    {isDarkMode ? (
                        <Sun size={18} style={{ color: 'var(--foreground-muted)' }} />
                    ) : (
                        <Moon size={18} style={{ color: 'var(--foreground-muted)' }} />
                    )}
                </button>

                {/* Notifications */}
                <button
                    className="relative p-2 rounded-lg transition-colors"
                    style={{ background: 'var(--background-tertiary)' }}
                >
                    <Bell size={18} style={{ color: 'var(--foreground-muted)' }} />
                    <span
                        className="absolute top-1 right-1 w-2 h-2 rounded-full"
                        style={{ background: 'var(--loss)' }}
                    />
                </button>

                {/* User Menu */}
                <button
                    className="flex items-center gap-2 p-2 rounded-lg transition-colors"
                    style={{ background: 'var(--background-tertiary)' }}
                >
                    <div
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
                    >
                        <User size={14} color="white" />
                    </div>
                    <ChevronDown size={14} className="hidden md:block" style={{ color: 'var(--foreground-muted)' }} />
                </button>
            </div>
        </header>
    );
}

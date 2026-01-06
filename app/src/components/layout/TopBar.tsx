'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
    Search,
    Bell,
    User,
    Sun,
    Moon,
    Monitor,
    Wallet,
    ChevronDown,
} from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';

export function TopBar() {
    const [searchQuery, setSearchQuery] = useState('');
    const [isMobile, setIsMobile] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { theme, setTheme } = useTheme();
    const { isPaperTrading, paperBalance, togglePaperTrading } = useTradingStore();

    useEffect(() => {
        setMounted(true);
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const cycleTheme = () => {
        const themes = ['dark', 'light', 'system'];
        const currentIndex = themes.indexOf(theme || 'dark');
        const nextIndex = (currentIndex + 1) % themes.length;
        setTheme(themes[nextIndex]);
    };

    const ThemeIcon = () => {
        if (!mounted) return <Sun size={18} className="text-muted-foreground" />;

        switch (theme) {
            case 'light':
                return <Sun size={18} className="text-muted-foreground" />;
            case 'system':
                return <Monitor size={18} className="text-muted-foreground" />;
            default:
                return <Moon size={18} className="text-muted-foreground" />;
        }
    };

    return (
        <header
            className="fixed top-0 right-0 h-16 z-40 flex items-center justify-between px-4 md:px-6 transition-all duration-200 bg-card border-b border-border"
            style={{
                left: isMobile ? 0 : '240px',
            }}
        >
            {/* Spacer for mobile menu button */}
            <div className="lg:hidden w-12" />

            {/* Search Bar */}
            <div className="relative flex-1 max-w-lg hidden md:block">
                <Search
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                    type="text"
                    placeholder="Search assets, orders..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg text-sm transition-colors bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <kbd
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-xs hidden lg:inline bg-background border border-border text-muted-foreground"
                >
                    ⌘K
                </kbd>
            </div>

            {/* Mobile Search Icon */}
            <button
                className="md:hidden p-2 rounded-lg bg-secondary"
            >
                <Search size={20} className="text-muted-foreground" />
            </button>

            {/* Right Section */}
            <div className="flex items-center gap-2 md:gap-4">
                {/* Paper Trading Toggle */}
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={togglePaperTrading}
                    className={`flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-lg font-medium text-xs md:text-sm transition-all ${isPaperTrading ? 'bg-profit/20 text-profit' : 'bg-primary/20 text-primary'
                        }`}
                >
                    <span className={`w-2 h-2 rounded-full ${isPaperTrading ? 'bg-green-500 pulse-live' : 'bg-indigo-500'}`} />
                    <span className="hidden sm:inline">{isPaperTrading ? 'Paper' : 'Live'}</span>
                    <span className="sm:hidden">{isPaperTrading ? 'P' : 'L'}</span>
                </motion.button>

                {/* Balance */}
                <div
                    className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary"
                >
                    <Wallet size={16} className="text-muted-foreground" />
                    <span className="font-semibold text-sm">
                        ${(isPaperTrading ? paperBalance : 0).toLocaleString()}
                    </span>
                    <ChevronDown size={14} className="text-muted-foreground" />
                </div>

                {/* Theme Toggle */}
                <button
                    onClick={cycleTheme}
                    className="p-2 rounded-lg transition-colors hidden sm:flex items-center gap-1 bg-secondary hover:bg-secondary/80"
                    title={`Current: ${theme}`}
                >
                    <ThemeIcon />
                </button>

                {/* Notifications */}
                <button
                    className="relative p-2 rounded-lg transition-colors bg-secondary"
                >
                    <Bell size={18} className="text-muted-foreground" />
                    <span
                        className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive"
                    />
                </button>

                {/* User Menu */}
                <button
                    className="flex items-center gap-2 p-2 rounded-lg transition-colors bg-secondary"
                >
                    <div
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))' }}
                    >
                        <User size={14} color="white" />
                    </div>
                    <ChevronDown size={14} className="hidden md:block text-muted-foreground" />
                </button>
            </div>
        </header>
    );
}

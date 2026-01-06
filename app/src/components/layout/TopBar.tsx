'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Search,
    Bell,
    User,
    Sun,
    Moon,
    Monitor,
    Settings,
    HelpCircle,
    ChevronDown,
} from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';

const navItems = [
    { label: 'Dashboard', href: '/' },
    { label: 'Orders', href: '/orders' },
    { label: 'Holdings', href: '/portfolio' },
    { label: 'Positions', href: '/positions' },
    { label: 'Funds', href: '/funds' },
];

export function TopBar() {
    const pathname = usePathname();
    const [isMobile, setIsMobile] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { theme, setTheme } = useTheme();
    const { isPaperTrading, paperBalance } = useTradingStore();

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
        const themes = ['light', 'dark', 'system'];
        const currentIndex = themes.indexOf(theme || 'light');
        const nextIndex = (currentIndex + 1) % themes.length;
        setTheme(themes[nextIndex]);
    };

    const ThemeIcon = () => {
        if (!mounted) return <Sun size={16} className="text-muted-foreground" />;
        switch (theme) {
            case 'dark':
                return <Moon size={16} className="text-muted-foreground" />;
            case 'system':
                return <Monitor size={16} className="text-muted-foreground" />;
            default:
                return <Sun size={16} className="text-muted-foreground" />;
        }
    };

    return (
        <header
            className="fixed top-0 right-0 h-12 z-40 flex items-center justify-between px-4 bg-card border-b border-border"
            style={{ left: isMobile ? 0 : '280px' }}
        >
            {/* Logo - Mobile Only */}
            {isMobile && (
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
                        <span className="text-white font-bold text-sm">G</span>
                    </div>
                </Link>
            )}

            {/* Kite-style Navigation */}
            <nav className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`px-3 py-2 text-sm font-medium transition-colors rounded ${isActive
                                    ? 'text-primary'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Right Section */}
            <div className="flex items-center gap-3">
                {/* Paper Trading Indicator */}
                {isPaperTrading && (
                    <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-profit/10 text-profit">
                        <span className="w-1.5 h-1.5 rounded-full bg-profit pulse-live" />
                        <span>Paper</span>
                    </div>
                )}

                {/* Balance */}
                <div className="hidden md:flex items-center gap-1 text-sm">
                    <span className="text-muted-foreground">₹</span>
                    <span className="font-medium">
                        {(isPaperTrading ? paperBalance : 0).toLocaleString('en-IN')}
                    </span>
                </div>

                {/* Theme Toggle */}
                <button
                    onClick={cycleTheme}
                    className="p-2 rounded hover:bg-secondary transition-colors"
                    title={mounted ? `Theme: ${theme}` : undefined}
                >
                    <ThemeIcon />
                </button>

                {/* Help */}
                <button className="p-2 rounded hover:bg-secondary transition-colors hidden sm:block">
                    <HelpCircle size={16} className="text-muted-foreground" />
                </button>

                {/* Settings */}
                <Link
                    href="/settings"
                    className="p-2 rounded hover:bg-secondary transition-colors hidden sm:block"
                >
                    <Settings size={16} className="text-muted-foreground" />
                </Link>

                {/* Notifications */}
                <button className="relative p-2 rounded hover:bg-secondary transition-colors">
                    <Bell size={16} className="text-muted-foreground" />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
                </button>

                {/* User Menu */}
                <button className="flex items-center gap-1 p-1 rounded hover:bg-secondary transition-colors">
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                        <User size={14} className="text-muted-foreground" />
                    </div>
                    <ChevronDown size={12} className="text-muted-foreground hidden md:block" />
                </button>
            </div>
        </header>
    );
}

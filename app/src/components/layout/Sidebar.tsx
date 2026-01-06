'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    TrendingUp,
    Wallet,
    ScrollText,
    Shield,
    Settings,
    ChevronLeft,
    ChevronRight,
    Zap,
    Menu,
    X,
} from 'lucide-react';

const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
    { icon: TrendingUp, label: 'Markets', href: '/markets' },
    { icon: Wallet, label: 'Portfolio', href: '/portfolio' },
    { icon: ScrollText, label: 'Orders', href: '/orders' },
    { icon: Shield, label: 'Risk Manager', href: '/risk' },
    { icon: Settings, label: 'Settings', href: '/settings' },
];

export function Sidebar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
            if (window.innerWidth >= 1024) {
                setIsMobileOpen(false);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        setIsMobileOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (isMobileOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isMobileOpen]);

    const MobileMenuButton = () => (
        <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="lg:hidden fixed top-4 left-4 z-[60] p-2 rounded-lg bg-card border border-border"
            aria-label="Toggle menu"
        >
            <AnimatePresence mode="wait">
                {isMobileOpen ? (
                    <motion.div
                        key="close"
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <X size={22} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="menu"
                        initial={{ rotate: 90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: -90, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <Menu size={22} />
                    </motion.div>
                )}
            </AnimatePresence>
        </button>
    );

    const MobileOverlay = () => (
        <AnimatePresence>
            {isMobileOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsMobileOpen(false)}
                    className="lg:hidden fixed inset-0 z-40 bg-black/70"
                />
            )}
        </AnimatePresence>
    );

    const NavContent = ({ showLabels = true }: { showLabels?: boolean }) => (
        <>
            {/* Logo */}
            <div className="flex items-center gap-3 p-4 h-16">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                        background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                    }}
                >
                    <Zap size={22} color="white" />
                </div>
                <AnimatePresence>
                    {showLabels && (
                        <motion.div
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            className="overflow-hidden whitespace-nowrap"
                        >
                            <h1 className="font-bold text-lg gradient-text">GlobalTrade</h1>
                            <p className="text-xs text-muted-foreground">Hub</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4">
                <ul className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${isActive
                                            ? 'bg-primary/20 text-primary'
                                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                        }`}
                                >
                                    <item.icon
                                        size={20}
                                        className="flex-shrink-0 transition-colors group-hover:text-primary"
                                    />
                                    <AnimatePresence>
                                        {showLabels && (
                                            <motion.span
                                                initial={{ opacity: 0, width: 0 }}
                                                animate={{ opacity: 1, width: 'auto' }}
                                                exit={{ opacity: 0, width: 0 }}
                                                className="text-sm font-medium overflow-hidden whitespace-nowrap"
                                            >
                                                {item.label}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>
        </>
    );

    return (
        <>
            <MobileMenuButton />
            <MobileOverlay />

            {/* Mobile Sidebar */}
            <AnimatePresence>
                {isMobile && isMobileOpen && (
                    <motion.aside
                        initial={{ x: -280 }}
                        animate={{ x: 0 }}
                        exit={{ x: -280 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="lg:hidden fixed left-0 top-0 h-screen z-50 flex flex-col w-[280px] bg-card border-r border-border"
                    >
                        <NavContent showLabels={true} />
                        <div className="p-4">
                            <p className="text-xs text-center text-muted-foreground">
                                Tap outside to close
                            </p>
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Desktop Sidebar */}
            <motion.aside
                initial={false}
                animate={{ width: isCollapsed ? 72 : 240 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="hidden lg:flex fixed left-0 top-0 h-screen z-50 flex-col bg-card border-r border-border"
            >
                <NavContent showLabels={!isCollapsed} />

                {/* Collapse Toggle */}
                <div className="p-3">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors bg-secondary text-muted-foreground hover:text-foreground"
                    >
                        {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        <AnimatePresence>
                            {!isCollapsed && (
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-sm"
                                >
                                    Collapse
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </button>
                </div>
            </motion.aside>
        </>
    );
}

export const SIDEBAR_WIDTH = {
    expanded: 240,
    collapsed: 72,
    mobile: 0,
};

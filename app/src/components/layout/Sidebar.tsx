'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    Search,
    TrendingUp,
    TrendingDown,
    Plus,
    Settings,
    ChevronDown,
    X,
    Bell,
    Zap,
} from 'lucide-react';
import { WATCHLIST_ASSETS } from '@/lib/mockData';
import { useTradingStore } from '@/stores/tradingStore';
import { useWebSocketStore } from '@/stores/websocketStore';

// Kite-style watchlist tabs
const WATCHLIST_TABS = [
    { id: 1, name: 'Watchlist 1' },
    { id: 2, name: 'Watchlist 2' },
    { id: 3, name: 'Watchlist 3' },
    { id: 4, name: 'Watchlist 4' },
    { id: 5, name: 'Watchlist 5' },
];

export function Sidebar() {
    const pathname = usePathname();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState(1);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const { watchlist, addToWatchlist, removeFromWatchlist } = useTradingStore();
    const { prices } = useWebSocketStore();

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth >= 768) {
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

    // Get watchlist assets with live prices
    const watchlistAssets = WATCHLIST_ASSETS.filter(a => watchlist.includes(a.symbol)).map(asset => {
        const livePrice = prices[asset.symbol];
        return {
            ...asset,
            price: livePrice?.price ?? asset.price,
            change: livePrice?.change ?? asset.change,
            changePercent: livePrice?.changePercent ?? asset.changePercent,
        };
    });

    // Filter by search
    const filteredAssets = searchQuery
        ? WATCHLIST_ASSETS.filter(a =>
            a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.name.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 8)
        : watchlistAssets;

    const MobileMenuButton = () => (
        <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="md:hidden fixed top-3 left-3 z-[60] p-2 rounded bg-card border border-border"
            aria-label="Toggle watchlist"
        >
            <AnimatePresence mode="wait">
                {isMobileOpen ? (
                    <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                        <X size={18} />
                    </motion.div>
                ) : (
                    <motion.div key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                        <TrendingUp size={18} />
                    </motion.div>
                )}
            </AnimatePresence>
        </button>
    );

    const WatchlistContent = () => (
        <div className="flex flex-col h-full">
            {/* Header with Logo */}
            <div className="p-3 border-b border-border flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                        <Zap size={16} className="text-white" />
                    </div>
                    <span className="font-bold text-lg gradient-text">GlobalTrade</span>
                </Link>
            </div>

            {/* Market Indices Bar */}
            <div className="px-3 py-2 border-b border-border text-xs flex gap-4">
                <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">NIFTY 50</span>
                    <span className="text-profit">22,456.80</span>
                    <span className="text-profit">+0.45%</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">SENSEX</span>
                    <span className="text-profit">73,890.45</span>
                    <span className="text-profit">+0.38%</span>
                </div>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-border">
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search eg: infy bse, nifty fut"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-secondary border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Watchlist Tabs */}
            <div className="flex border-b border-border">
                {WATCHLIST_TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === tab.id
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {tab.id}
                    </button>
                ))}
                <button className="px-2 py-2 text-muted-foreground hover:text-foreground">
                    <Settings size={12} />
                </button>
            </div>

            {/* Stock List */}
            <div className="flex-1 overflow-y-auto">
                {filteredAssets.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                        {searchQuery ? 'No results found' : 'Add stocks to your watchlist'}
                    </div>
                ) : (
                    <div>
                        {filteredAssets.map((asset) => {
                            const isPositive = asset.change >= 0;
                            const isInWatchlist = watchlist.includes(asset.symbol);
                            const currency = asset.market === 'india' ? '' : '$';

                            return (
                                <Link
                                    key={asset.symbol}
                                    href={`/trade/${asset.symbol}`}
                                    className="group flex items-center justify-between px-3 py-2.5 hover:bg-secondary transition-colors border-b border-border/50"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-medium text-sm ${isPositive ? 'text-foreground' : 'text-foreground'}`}>
                                                {asset.symbol}
                                            </span>
                                            {asset.exchange && (
                                                <span className="text-[10px] text-muted-foreground">
                                                    {asset.exchange}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-sm font-medium ${isPositive ? 'text-profit' : 'text-loss'}`}>
                                            {isPositive ? <TrendingUp size={10} className="inline mr-1" /> : <TrendingDown size={10} className="inline mr-1" />}
                                            {asset.changePercent.toFixed(2)}%
                                        </div>
                                        <div className="text-xs text-muted-foreground price-text">
                                            {currency}{asset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                    {/* Quick actions on hover */}
                                    <div className="hidden group-hover:flex items-center gap-1 ml-2">
                                        <button
                                            className="px-2 py-0.5 text-[10px] font-medium bg-buy text-white rounded"
                                            onClick={(e) => { e.preventDefault(); }}
                                        >
                                            B
                                        </button>
                                        <button
                                            className="px-2 py-0.5 text-[10px] font-medium bg-sell text-white rounded"
                                            onClick={(e) => { e.preventDefault(); }}
                                        >
                                            S
                                        </button>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer with page count */}
            <div className="p-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                        <button
                            key={n}
                            onClick={() => setActiveTab(n)}
                            className={`w-6 h-6 rounded ${activeTab === n ? 'bg-primary text-white' : 'hover:bg-secondary'}`}
                        >
                            {n}
                        </button>
                    ))}
                </div>
                <button className="hover:text-foreground">
                    <Settings size={14} />
                </button>
            </div>
        </div>
    );

    return (
        <>
            <MobileMenuButton />

            {/* Mobile Overlay */}
            <AnimatePresence>
                {isMobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsMobileOpen(false)}
                        className="md:hidden fixed inset-0 z-40 bg-black/50"
                    />
                )}
            </AnimatePresence>

            {/* Mobile Sidebar */}
            <AnimatePresence>
                {isMobile && isMobileOpen && (
                    <motion.aside
                        initial={{ x: -280 }}
                        animate={{ x: 0 }}
                        exit={{ x: -280 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="md:hidden fixed left-0 top-0 h-screen z-50 w-[280px] bg-card border-r border-border"
                    >
                        <WatchlistContent />
                    </motion.aside>
                )}
            </AnimatePresence>

            {/* Desktop Sidebar - Kite Watchlist Style */}
            <aside className="hidden md:flex fixed left-0 top-0 h-screen z-50 w-[280px] bg-card border-r border-border flex-col">
                <WatchlistContent />
            </aside>
        </>
    );
}

export const SIDEBAR_WIDTH = {
    expanded: 280,
    collapsed: 280,
    mobile: 0,
};

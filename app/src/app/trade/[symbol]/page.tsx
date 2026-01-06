'use client';

import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Star,
    TrendingUp,
    TrendingDown,
    Share2,
    Bell,
} from 'lucide-react';
import Link from 'next/link';
import { WATCHLIST_ASSETS } from '@/lib/mockData';
import { CandlestickChart, OrderPanel, OrderBook } from '@/components/trading';
import { useTradingStore } from '@/stores/tradingStore';

export default function TradePage() {
    const params = useParams();
    const symbol = params.symbol as string;
    const { watchlist, addToWatchlist, removeFromWatchlist } = useTradingStore();

    const asset = WATCHLIST_ASSETS.find((a) => a.symbol === symbol);
    const isInWatchlist = watchlist.includes(symbol);

    if (!asset) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <h1 className="text-xl font-semibold mb-2">Asset Not Found</h1>
                <p className="text-sm mb-4" style={{ color: 'var(--foreground-muted)' }}>
                    The symbol "{symbol}" could not be found.
                </p>
                <Link href="/" className="btn btn-primary">
                    <ArrowLeft size={16} />
                    Back to Dashboard
                </Link>
            </div>
        );
    }

    const isPositive = asset.change >= 0;
    const currency = asset.market === 'india' ? '₹' : '$';

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-center gap-3 md:gap-4">
                    <Link
                        href="/"
                        className="p-2 rounded-lg transition-colors"
                        style={{ background: 'var(--background-secondary)' }}
                    >
                        <ArrowLeft size={20} style={{ color: 'var(--foreground-muted)' }} />
                    </Link>
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm md:text-base"
                            style={{
                                background:
                                    asset.market === 'crypto'
                                        ? 'linear-gradient(135deg, #f7931a, #ffb21a)'
                                        : asset.market === 'us'
                                            ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                                            : 'linear-gradient(135deg, #059669, #10b981)',
                            }}
                        >
                            {symbol.slice(0, 2)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg md:text-xl font-bold">{symbol}</h1>
                                <span
                                    className="badge badge-neutral text-xs"
                                >
                                    {asset.exchange}
                                </span>
                            </div>
                            <p className="text-xs md:text-sm" style={{ color: 'var(--foreground-muted)' }}>
                                {asset.name}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => isInWatchlist ? removeFromWatchlist(symbol) : addToWatchlist(symbol)}
                        className="p-2 rounded-lg transition-colors"
                        style={{
                            background: isInWatchlist ? 'var(--accent)' : 'var(--background-secondary)',
                        }}
                    >
                        <Star
                            size={20}
                            fill={isInWatchlist ? 'currentColor' : 'none'}
                            color={isInWatchlist ? 'white' : 'var(--foreground-muted)'}
                        />
                    </button>
                    <button
                        className="p-2 rounded-lg transition-colors"
                        style={{ background: 'var(--background-secondary)' }}
                    >
                        <Bell size={20} style={{ color: 'var(--foreground-muted)' }} />
                    </button>
                    <button
                        className="p-2 rounded-lg transition-colors hidden sm:block"
                        style={{ background: 'var(--background-secondary)' }}
                    >
                        <Share2 size={20} style={{ color: 'var(--foreground-muted)' }} />
                    </button>
                </div>
            </div>

            {/* Price Display */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-end gap-2 md:gap-4"
            >
                <span className="text-2xl md:text-4xl font-bold tracking-tight price-text">
                    {currency}
                    {asset.price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    })}
                </span>
                <div className="flex items-center gap-1 md:gap-2 pb-0.5 md:pb-1">
                    {isPositive ? (
                        <TrendingUp size={18} style={{ color: 'var(--profit)' }} />
                    ) : (
                        <TrendingDown size={18} style={{ color: 'var(--loss)' }} />
                    )}
                    <span
                        className="text-sm md:text-lg font-semibold"
                        style={{ color: isPositive ? 'var(--profit)' : 'var(--loss)' }}
                    >
                        {isPositive ? '+' : ''}{asset.changePercent.toFixed(2)}%
                    </span>
                </div>
                <span className="text-xs md:text-sm pb-0.5 md:pb-1" style={{ color: 'var(--foreground-muted)' }}>
                    24h
                </span>
            </motion.div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: '24h High', value: `${currency}${asset.high24h.toLocaleString()}` },
                    { label: '24h Low', value: `${currency}${asset.low24h.toLocaleString()}` },
                    { label: '24h Volume', value: `${currency}${(asset.volume / 1000000).toFixed(2)}M` },
                    { label: 'Market Cap', value: asset.marketCap ? `${currency}${(asset.marketCap / 1000000000).toFixed(2)}B` : 'N/A' },
                ].map((stat) => (
                    <div
                        key={stat.label}
                        className="p-4 rounded-xl"
                        style={{ background: 'var(--background-secondary)' }}
                    >
                        <p className="text-xs mb-1" style={{ color: 'var(--foreground-muted)' }}>
                            {stat.label}
                        </p>
                        <p className="font-semibold">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Main Trading Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart - Takes 2 columns */}
                <div className="lg:col-span-2 space-y-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="card"
                    >
                        <div className="card-body">
                            <CandlestickChart symbol={symbol} height={450} />
                        </div>
                    </motion.div>
                </div>

                {/* Order Panel & Order Book */}
                <div className="space-y-4">
                    <OrderPanel
                        symbol={symbol}
                        currentPrice={asset.price}
                        currency={currency}
                    />
                    <OrderBook currentPrice={asset.price} depth={6} />
                </div>
            </div>
        </div>
    );
}

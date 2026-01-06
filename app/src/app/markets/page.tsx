'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    Search,
    TrendingUp,
    TrendingDown,
    Filter,
    ArrowUpDown,
    Star,
} from 'lucide-react';
import { WATCHLIST_ASSETS } from '@/lib/mockData';
import { MARKETS, MARKET_LABELS } from '@/lib/constants';
import { useTradingStore } from '@/stores/tradingStore';

export default function MarketsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMarket, setSelectedMarket] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'change' | 'volume' | 'price'>('change');
    const { watchlist, addToWatchlist, removeFromWatchlist } = useTradingStore();

    const filteredAssets = useMemo(() => {
        let assets = [...WATCHLIST_ASSETS];

        // Filter by market
        if (selectedMarket !== 'all') {
            assets = assets.filter((a) => a.market === selectedMarket);
        }

        // Filter by search
        if (searchQuery) {
            assets = assets.filter(
                (a) =>
                    a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    a.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Sort
        assets.sort((a, b) => {
            switch (sortBy) {
                case 'change':
                    return b.changePercent - a.changePercent;
                case 'volume':
                    return b.volume - a.volume;
                case 'price':
                    return b.price - a.price;
                default:
                    return 0;
            }
        });

        return assets;
    }, [searchQuery, selectedMarket, sortBy]);

    const topGainers = useMemo(
        () => [...WATCHLIST_ASSETS].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3),
        []
    );

    const topLosers = useMemo(
        () => [...WATCHLIST_ASSETS].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3),
        []
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Markets</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
                    Explore and trade across Indian Equities, US Stocks, and Crypto
                </p>
            </div>

            {/* Top Movers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top Gainers */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card"
                >
                    <div className="card-header flex items-center gap-2">
                        <TrendingUp size={18} style={{ color: 'var(--profit)' }} />
                        <h3 className="font-semibold text-sm">Top Gainers</h3>
                    </div>
                    <div className="card-body py-2">
                        {topGainers.map((asset) => (
                            <Link
                                key={asset.symbol}
                                href={`/trade/${asset.symbol}`}
                                className="flex items-center justify-between py-2 hover:bg-[var(--background-tertiary)] px-2 -mx-2 rounded transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{asset.symbol}</span>
                                    <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                        {asset.exchange}
                                    </span>
                                </div>
                                <span className="font-semibold text-sm" style={{ color: 'var(--profit)' }}>
                                    +{asset.changePercent.toFixed(2)}%
                                </span>
                            </Link>
                        ))}
                    </div>
                </motion.div>

                {/* Top Losers */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="card"
                >
                    <div className="card-header flex items-center gap-2">
                        <TrendingDown size={18} style={{ color: 'var(--loss)' }} />
                        <h3 className="font-semibold text-sm">Top Losers</h3>
                    </div>
                    <div className="card-body py-2">
                        {topLosers.map((asset) => (
                            <Link
                                key={asset.symbol}
                                href={`/trade/${asset.symbol}`}
                                className="flex items-center justify-between py-2 hover:bg-[var(--background-tertiary)] px-2 -mx-2 rounded transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{asset.symbol}</span>
                                    <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                        {asset.exchange}
                                    </span>
                                </div>
                                <span className="font-semibold text-sm" style={{ color: 'var(--loss)' }}>
                                    {asset.changePercent.toFixed(2)}%
                                </span>
                            </Link>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--foreground-muted)' }}
                    />
                    <input
                        type="text"
                        placeholder="Search assets..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input pl-9"
                    />
                </div>

                {/* Market Filter */}
                <div className="flex items-center gap-2">
                    <Filter size={16} style={{ color: 'var(--foreground-muted)' }} />
                    <div className="flex gap-1">
                        <button
                            onClick={() => setSelectedMarket('all')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors`}
                            style={{
                                background: selectedMarket === 'all' ? 'var(--primary)' : 'var(--background-secondary)',
                                color: selectedMarket === 'all' ? 'white' : 'var(--foreground-muted)',
                            }}
                        >
                            All
                        </button>
                        {Object.entries(MARKETS).map(([key, value]) => (
                            <button
                                key={value}
                                onClick={() => setSelectedMarket(value)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors`}
                                style={{
                                    background: selectedMarket === value ? 'var(--primary)' : 'var(--background-secondary)',
                                    color: selectedMarket === value ? 'white' : 'var(--foreground-muted)',
                                }}
                            >
                                {MARKET_LABELS[value]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2">
                    <ArrowUpDown size={16} style={{ color: 'var(--foreground-muted)' }} />
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'change' | 'volume' | 'price')}
                        className="input py-1.5 text-sm w-auto"
                    >
                        <option value="change">% Change</option>
                        <option value="volume">Volume</option>
                        <option value="price">Price</option>
                    </select>
                </div>
            </div>

            {/* Assets Table */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="card"
            >
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr style={{ background: 'var(--background-tertiary)' }}>
                                <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    Asset
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    Price
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    24h Change
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-medium hidden md:table-cell" style={{ color: 'var(--foreground-muted)' }}>
                                    Volume
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-medium hidden lg:table-cell" style={{ color: 'var(--foreground-muted)' }}>
                                    Market
                                </th>
                                <th className="py-3 px-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAssets.map((asset, index) => {
                                const isPositive = asset.change >= 0;
                                const isInWatchlist = watchlist.includes(asset.symbol);
                                const currency = asset.market === 'india' ? '₹' : '$';

                                return (
                                    <motion.tr
                                        key={asset.symbol}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.02 }}
                                        className="border-b transition-colors hover:bg-[var(--background-tertiary)]"
                                        style={{ borderColor: 'var(--border)' }}
                                    >
                                        <td className="py-4 px-4">
                                            <Link href={`/trade/${asset.symbol}`} className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                                    style={{
                                                        background:
                                                            asset.market === 'crypto'
                                                                ? 'linear-gradient(135deg, #f7931a, #ffb21a)'
                                                                : asset.market === 'us'
                                                                    ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                                                                    : 'linear-gradient(135deg, #059669, #10b981)',
                                                    }}
                                                >
                                                    {asset.symbol.slice(0, 2)}
                                                </div>
                                                <div>
                                                    <p className="font-medium">{asset.symbol}</p>
                                                    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                                        {asset.name}
                                                    </p>
                                                </div>
                                            </Link>
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <p className="font-semibold price-text">
                                                {currency}{asset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </p>
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {isPositive ? (
                                                    <TrendingUp size={14} style={{ color: 'var(--profit)' }} />
                                                ) : (
                                                    <TrendingDown size={14} style={{ color: 'var(--loss)' }} />
                                                )}
                                                <span
                                                    className="font-medium"
                                                    style={{ color: isPositive ? 'var(--profit)' : 'var(--loss)' }}
                                                >
                                                    {isPositive ? '+' : ''}{asset.changePercent.toFixed(2)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4 text-right hidden md:table-cell">
                                            <span style={{ color: 'var(--foreground-muted)' }}>
                                                {currency}{(asset.volume / 1000000).toFixed(2)}M
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-right hidden lg:table-cell">
                                            <span className="badge badge-neutral text-xs">
                                                {MARKET_LABELS[asset.market]}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4">
                                            <button
                                                onClick={() => isInWatchlist ? removeFromWatchlist(asset.symbol) : addToWatchlist(asset.symbol)}
                                                className="p-1 rounded transition-colors"
                                            >
                                                <Star
                                                    size={16}
                                                    fill={isInWatchlist ? 'currentColor' : 'none'}
                                                    style={{ color: isInWatchlist ? 'var(--accent)' : 'var(--foreground-muted)' }}
                                                />
                                            </button>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredAssets.length === 0 && (
                    <div className="py-12 text-center" style={{ color: 'var(--foreground-muted)' }}>
                        <Search size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No assets found</p>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

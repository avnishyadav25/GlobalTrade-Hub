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
    LayoutGrid,
    List,
    BarChart3,
} from 'lucide-react';
import { WATCHLIST_ASSETS } from '@/lib/mockData';
import { MARKETS, MARKET_LABELS } from '@/lib/constants';
import { useTradingStore } from '@/stores/tradingStore';
import { MarketOverview, StockHeatmap, TickerTape } from '@/components/trading';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MarketsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMarket, setSelectedMarket] = useState<string>('all');
    const [sortBy, setSortBy] = useState<'change' | 'volume' | 'price'>('change');
    const [viewMode, setViewMode] = useState<'table' | 'heatmap' | 'overview'>('table');
    const { watchlist, addToWatchlist, removeFromWatchlist } = useTradingStore();

    const filteredAssets = useMemo(() => {
        let assets = [...WATCHLIST_ASSETS];

        if (selectedMarket !== 'all') {
            assets = assets.filter((a) => a.market === selectedMarket);
        }

        if (searchQuery) {
            assets = assets.filter(
                (a) =>
                    a.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    a.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

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
            {/* Ticker Tape */}
            <div className="rounded-lg overflow-hidden border border-border">
                <TickerTape colorTheme="dark" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Markets</h1>
                    <p className="text-sm mt-1 text-muted-foreground">
                        Explore and trade across Indian Equities, US Stocks, and Crypto
                    </p>
                </div>

                {/* View Mode Toggle */}
                <div className="flex gap-1 bg-secondary rounded-lg p-1">
                    <Button
                        variant={viewMode === 'table' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('table')}
                    >
                        <List size={16} />
                    </Button>
                    <Button
                        variant={viewMode === 'heatmap' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('heatmap')}
                    >
                        <LayoutGrid size={16} />
                    </Button>
                    <Button
                        variant={viewMode === 'overview' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('overview')}
                    >
                        <BarChart3 size={16} />
                    </Button>
                </div>
            </div>

            {/* View Content */}
            {viewMode === 'overview' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                >
                    <Card>
                        <CardHeader>
                            <h3 className="font-semibold">Market Overview</h3>
                        </CardHeader>
                        <CardContent className="p-0">
                            <MarketOverview height={400} colorTheme="dark" />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <h3 className="font-semibold">Sector Heatmap</h3>
                        </CardHeader>
                        <CardContent className="p-0">
                            <StockHeatmap height={400} colorTheme="dark" exchange="NSE" />
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {viewMode === 'heatmap' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                >
                    <Card>
                        <CardHeader>
                            <Tabs defaultValue="india" className="w-full">
                                <TabsList>
                                    <TabsTrigger value="india">🇮🇳 India</TabsTrigger>
                                    <TabsTrigger value="us">🇺🇸 US</TabsTrigger>
                                    <TabsTrigger value="crypto">₿ Crypto</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </CardHeader>
                        <CardContent className="p-0">
                            <StockHeatmap height={500} colorTheme="dark" exchange="NSE" />
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {viewMode === 'table' && (
                <>
                    {/* Top Movers */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center gap-2 py-3">
                                <TrendingUp size={18} className="text-profit" />
                                <h3 className="font-semibold text-sm">Top Gainers</h3>
                            </CardHeader>
                            <CardContent className="py-2">
                                {topGainers.map((asset) => (
                                    <Link
                                        key={asset.symbol}
                                        href={`/trade/${asset.symbol}`}
                                        className="flex items-center justify-between py-2 hover:bg-secondary px-2 -mx-2 rounded transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{asset.symbol}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {asset.exchange}
                                            </span>
                                        </div>
                                        <span className="font-semibold text-sm text-profit">
                                            +{asset.changePercent.toFixed(2)}%
                                        </span>
                                    </Link>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center gap-2 py-3">
                                <TrendingDown size={18} className="text-loss" />
                                <h3 className="font-semibold text-sm">Top Losers</h3>
                            </CardHeader>
                            <CardContent className="py-2">
                                {topLosers.map((asset) => (
                                    <Link
                                        key={asset.symbol}
                                        href={`/trade/${asset.symbol}`}
                                        className="flex items-center justify-between py-2 hover:bg-secondary px-2 -mx-2 rounded transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{asset.symbol}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {asset.exchange}
                                            </span>
                                        </div>
                                        <span className="font-semibold text-sm text-loss">
                                            {asset.changePercent.toFixed(2)}%
                                        </span>
                                    </Link>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="relative flex-1 min-w-[200px] max-w-md">
                            <Search
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                            />
                            <Input
                                type="text"
                                placeholder="Search assets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Filter size={16} className="text-muted-foreground" />
                            <div className="flex gap-1">
                                <Button
                                    variant={selectedMarket === 'all' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setSelectedMarket('all')}
                                >
                                    All
                                </Button>
                                {Object.entries(MARKETS).map(([key, value]) => (
                                    <Button
                                        key={value}
                                        variant={selectedMarket === value ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setSelectedMarket(value)}
                                    >
                                        {MARKET_LABELS[value]}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <ArrowUpDown size={16} className="text-muted-foreground" />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as 'change' | 'volume' | 'price')}
                                className="bg-secondary border border-border rounded-md px-3 py-1.5 text-sm"
                            >
                                <option value="change">% Change</option>
                                <option value="volume">Volume</option>
                                <option value="price">Price</option>
                            </select>
                        </div>
                    </div>

                    {/* Assets Table */}
                    <Card>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-secondary">
                                        <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">
                                            Asset
                                        </th>
                                        <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">
                                            Price
                                        </th>
                                        <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">
                                            24h Change
                                        </th>
                                        <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground hidden md:table-cell">
                                            Volume
                                        </th>
                                        <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground hidden lg:table-cell">
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
                                                className="border-b border-border transition-colors hover:bg-secondary"
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
                                                            <p className="text-xs text-muted-foreground">
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
                                                            <TrendingUp size={14} className="text-profit" />
                                                        ) : (
                                                            <TrendingDown size={14} className="text-loss" />
                                                        )}
                                                        <span className={isPositive ? 'text-profit' : 'text-loss'}>
                                                            {isPositive ? '+' : ''}{asset.changePercent.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right hidden md:table-cell text-muted-foreground">
                                                    {currency}{(asset.volume / 1000000).toFixed(2)}M
                                                </td>
                                                <td className="py-4 px-4 text-right hidden lg:table-cell">
                                                    <span className="text-xs px-2 py-1 rounded bg-secondary">
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
                                                            className={isInWatchlist ? 'text-accent' : 'text-muted-foreground'}
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
                            <div className="py-12 text-center text-muted-foreground">
                                <Search size={32} className="mx-auto mb-2 opacity-50" />
                                <p>No assets found</p>
                            </div>
                        )}
                    </Card>
                </>
            )}
        </div>
    );
}

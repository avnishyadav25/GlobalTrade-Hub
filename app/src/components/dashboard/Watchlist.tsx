'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Star, Search, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { WATCHLIST_ASSETS, type Asset } from '@/lib/mockData';
import { useTradingStore } from '@/stores/tradingStore';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function Watchlist() {
    const { watchlist, addToWatchlist, removeFromWatchlist } = useTradingStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'india' | 'us' | 'crypto'>('all');
    const [prices, setPrices] = useState<Record<string, { price: number; flash: 'up' | 'down' | null }>>({});

    // Initialize prices
    useEffect(() => {
        const initialPrices: Record<string, { price: number; flash: 'up' | 'down' | null }> = {};
        WATCHLIST_ASSETS.forEach((asset) => {
            initialPrices[asset.symbol] = { price: asset.price, flash: null };
        });
        setPrices(initialPrices);
    }, []);

    // Simulate real-time price updates
    useEffect(() => {
        const interval = setInterval(() => {
            setPrices((prev) => {
                const updated = { ...prev };
                const symbols = Object.keys(updated);
                const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];

                if (updated[randomSymbol]) {
                    const volatility = 0.002 + Math.random() * 0.008;
                    const direction = Math.random() > 0.48 ? 1 : -1;
                    const newPrice = updated[randomSymbol].price * (1 + direction * volatility);
                    updated[randomSymbol] = {
                        price: parseFloat(newPrice.toFixed(2)),
                        flash: direction > 0 ? 'up' : 'down',
                    };
                }

                return updated;
            });
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    // Clear flash after animation
    useEffect(() => {
        const timeout = setTimeout(() => {
            setPrices((prev) => {
                const updated = { ...prev };
                Object.keys(updated).forEach((symbol) => {
                    if (updated[symbol].flash) {
                        updated[symbol] = { ...updated[symbol], flash: null };
                    }
                });
                return updated;
            });
        }, 300);

        return () => clearTimeout(timeout);
    }, [prices]);

    const filteredAssets = WATCHLIST_ASSETS.filter((asset) => {
        const matchesSearch =
            asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
            asset.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filter === 'all' || asset.market === filter;
        return matchesSearch && matchesFilter;
    });

    const toggleWatchlist = useCallback((symbol: string) => {
        if (watchlist.includes(symbol)) {
            removeFromWatchlist(symbol);
        } else {
            addToWatchlist(symbol);
        }
    }, [watchlist, addToWatchlist, removeFromWatchlist]);

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold flex items-center gap-2">
                        <Star size={18} className="text-accent" />
                        Watchlist
                    </h2>
                    <Button variant="outline" size="sm">
                        <Plus size={14} />
                        Add
                    </Button>
                </div>

                {/* Search & Filter */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search
                            size={16}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        />
                        <Input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="flex gap-1">
                        {['all', 'india', 'us', 'crypto'].map((f) => (
                            <Button
                                key={f}
                                variant={filter === f ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setFilter(f as typeof filter)}
                                className="capitalize"
                            >
                                {f === 'all' ? 'All' : f === 'india' ? '🇮🇳' : f === 'us' ? '🇺🇸' : '₿'}
                            </Button>
                        ))}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-0">
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                    {filteredAssets.map((asset) => {
                        const currentPrice = prices[asset.symbol]?.price || asset.price;
                        const flash = prices[asset.symbol]?.flash;
                        const isInWatchlist = watchlist.includes(asset.symbol);
                        const isPositive = asset.changePercent >= 0;

                        return (
                            <Link
                                key={asset.symbol}
                                href={`/trade/${asset.symbol}`}
                                className={`flex items-center justify-between p-3 rounded-lg transition-all hover:bg-secondary ${flash === 'up' ? 'flash-profit' : flash === 'down' ? 'flash-loss' : ''
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            toggleWatchlist(asset.symbol);
                                        }}
                                        className="p-1"
                                    >
                                        <Star
                                            size={16}
                                            fill={isInWatchlist ? 'currentColor' : 'none'}
                                            className={isInWatchlist ? 'text-accent' : 'text-muted-foreground'}
                                        />
                                    </button>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm">{asset.symbol}</span>
                                            <Badge variant="secondary" className="text-xs">
                                                {asset.exchange}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{asset.name}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-sm price-text">
                                        {asset.market === 'india' ? '₹' : '$'}
                                        {currentPrice.toLocaleString()}
                                    </p>
                                    <div className={`flex items-center justify-end gap-1 text-xs ${isPositive ? 'text-profit' : 'text-loss'
                                        }`}>
                                        {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                        {isPositive ? '+' : ''}{asset.changePercent.toFixed(2)}%
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

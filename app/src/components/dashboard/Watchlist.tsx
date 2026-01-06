'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Star, Search, Plus, TrendingUp, TrendingDown, Bell, BellOff, X } from 'lucide-react';
import Link from 'next/link';
import { WATCHLIST_ASSETS, type Asset } from '@/lib/mockData';
import { useTradingStore } from '@/stores/tradingStore';
import { useWebSocketStore, startMockPriceUpdates, type PriceUpdate } from '@/stores/websocketStore';
import { useNotificationStore, notifyPriceAlert } from '@/stores/notificationStore';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PriceAlert {
    symbol: string;
    targetPrice: number;
    condition: 'above' | 'below';
    active: boolean;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
    if (data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * 60;
        const y = 20 - ((value - min) / range) * 18;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width="60" height="24" className="overflow-visible">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

export function Watchlist() {
    const { watchlist, addToWatchlist, removeFromWatchlist } = useTradingStore();
    const { prices, updatePrice } = useWebSocketStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'all' | 'india' | 'us' | 'crypto'>('all');
    const [priceHistory, setPriceHistory] = useState<Record<string, number[]>>({});
    const [flashState, setFlashState] = useState<Record<string, 'up' | 'down' | null>>({});
    const [alerts, setAlerts] = useState<PriceAlert[]>([]);
    const [showAlertModal, setShowAlertModal] = useState<string | null>(null);
    const [alertPrice, setAlertPrice] = useState('');
    const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');

    // Start mock price updates on mount
    useEffect(() => {
        const basePrices: Record<string, number> = {};
        WATCHLIST_ASSETS.forEach((asset) => {
            basePrices[asset.symbol] = asset.price;
            // Initialize with base price
            updatePrice({
                symbol: asset.symbol,
                price: asset.price,
                change: 0,
                changePercent: asset.changePercent,
                volume: 0,
                timestamp: Date.now(),
            });
        });

        const symbols = WATCHLIST_ASSETS.map(a => a.symbol);
        const cleanup = startMockPriceUpdates(symbols, basePrices);

        return cleanup;
    }, [updatePrice]);

    // Track price history for sparklines
    useEffect(() => {
        const newHistory: Record<string, number[]> = { ...priceHistory };
        let hasChange = false;

        Object.entries(prices).forEach(([symbol, data]) => {
            if (!newHistory[symbol]) {
                newHistory[symbol] = [];
            }

            const lastPrice = newHistory[symbol][newHistory[symbol].length - 1];
            if (lastPrice !== data.price) {
                hasChange = true;
                newHistory[symbol] = [...newHistory[symbol].slice(-19), data.price];

                // Flash effect
                if (lastPrice) {
                    setFlashState(prev => ({
                        ...prev,
                        [symbol]: data.price > lastPrice ? 'up' : 'down'
                    }));

                    // Clear flash after animation
                    setTimeout(() => {
                        setFlashState(prev => ({ ...prev, [symbol]: null }));
                    }, 300);
                }
            }
        });

        if (hasChange) {
            setPriceHistory(newHistory);
        }
    }, [prices]);

    // Check price alerts
    useEffect(() => {
        alerts.forEach(alert => {
            if (!alert.active) return;

            const currentPrice = prices[alert.symbol]?.price;
            if (!currentPrice) return;

            const triggered = alert.condition === 'above'
                ? currentPrice >= alert.targetPrice
                : currentPrice <= alert.targetPrice;

            if (triggered) {
                notifyPriceAlert(alert.symbol, currentPrice, alert.condition);
                // Deactivate the alert after triggering
                setAlerts(prev => prev.map(a =>
                    a === alert ? { ...a, active: false } : a
                ));
            }
        });
    }, [prices, alerts]);

    const filteredAssets = useMemo(() =>
        WATCHLIST_ASSETS.filter((asset) => {
            const matchesSearch =
                asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                asset.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = filter === 'all' || asset.market === filter;
            return matchesSearch && matchesFilter;
        }), [searchQuery, filter]
    );

    const toggleWatchlist = useCallback((symbol: string) => {
        if (watchlist.includes(symbol)) {
            removeFromWatchlist(symbol);
        } else {
            addToWatchlist(symbol);
        }
    }, [watchlist, addToWatchlist, removeFromWatchlist]);

    const addPriceAlert = useCallback((symbol: string) => {
        if (!alertPrice) return;

        setAlerts(prev => [...prev, {
            symbol,
            targetPrice: parseFloat(alertPrice),
            condition: alertCondition,
            active: true,
        }]);

        setShowAlertModal(null);
        setAlertPrice('');
    }, [alertPrice, alertCondition]);

    const getActiveAlertCount = (symbol: string) =>
        alerts.filter(a => a.symbol === symbol && a.active).length;

    return (
        <Card>
            <CardHeader className="pb-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold flex items-center gap-2">
                        <Star size={18} className="text-accent" />
                        Watchlist
                        <span className="text-xs px-2 py-0.5 rounded-full bg-profit/20 text-profit">
                            LIVE
                        </span>
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
                        const liveData = prices[asset.symbol];
                        const currentPrice = liveData?.price || asset.price;
                        const changePercent = liveData?.changePercent ?? asset.changePercent;
                        const flash = flashState[asset.symbol];
                        const isInWatchlist = watchlist.includes(asset.symbol);
                        const isPositive = changePercent >= 0;
                        const sparklineData = priceHistory[asset.symbol] || [];
                        const alertCount = getActiveAlertCount(asset.symbol);

                        return (
                            <div
                                key={asset.symbol}
                                className={`flex items-center justify-between p-3 rounded-lg transition-all hover:bg-secondary ${flash === 'up' ? 'flash-profit' : flash === 'down' ? 'flash-loss' : ''
                                    }`}
                            >
                                <Link
                                    href={`/trade/${asset.symbol}`}
                                    className="flex items-center gap-3 flex-1"
                                >
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
                                            {alertCount > 0 && (
                                                <Badge variant="outline" className="text-xs bg-primary/20">
                                                    <Bell size={10} className="mr-1" />
                                                    {alertCount}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{asset.name}</p>
                                    </div>
                                </Link>

                                {/* Sparkline */}
                                <div className="hidden sm:block mx-4">
                                    <Sparkline
                                        data={sparklineData}
                                        color={isPositive ? 'var(--profit)' : 'var(--loss)'}
                                    />
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <p className="font-medium text-sm price-text">
                                            {asset.market === 'india' ? '₹' : '$'}
                                            {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                        <div className={`flex items-center justify-end gap-1 text-xs ${isPositive ? 'text-profit' : 'text-loss'
                                            }`}>
                                            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                                        </div>
                                    </div>

                                    {/* Alert Button */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="p-2"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setShowAlertModal(asset.symbol);
                                            setAlertPrice(currentPrice.toString());
                                        }}
                                    >
                                        <Bell size={14} className="text-muted-foreground hover:text-foreground" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>

            {/* Price Alert Modal */}
            {showAlertModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-card border border-border rounded-xl p-6 w-full max-w-sm mx-4"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold">Price Alert: {showAlertModal}</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAlertModal(null)}
                            >
                                <X size={16} />
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-muted-foreground mb-1 block">
                                    Alert when price goes
                                </label>
                                <div className="flex gap-2">
                                    <Button
                                        variant={alertCondition === 'above' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setAlertCondition('above')}
                                        className="flex-1"
                                    >
                                        Above ↑
                                    </Button>
                                    <Button
                                        variant={alertCondition === 'below' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setAlertCondition('below')}
                                        className="flex-1"
                                    >
                                        Below ↓
                                    </Button>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm text-muted-foreground mb-1 block">
                                    Target Price
                                </label>
                                <Input
                                    type="number"
                                    value={alertPrice}
                                    onChange={(e) => setAlertPrice(e.target.value)}
                                    placeholder="Enter target price"
                                />
                            </div>

                            <Button
                                className="w-full"
                                onClick={() => addPriceAlert(showAlertModal)}
                            >
                                <Bell size={16} className="mr-2" />
                                Create Alert
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </Card>
    );
}

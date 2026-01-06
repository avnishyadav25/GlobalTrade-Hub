'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { generateOrderBook } from '@/lib/mockData';

interface OrderBookProps {
    currentPrice: number;
    depth?: number;
}

export function OrderBook({ currentPrice, depth = 8 }: OrderBookProps) {
    const { bids, asks } = useMemo(
        () => generateOrderBook(currentPrice, depth),
        [currentPrice, depth]
    );

    const maxBidTotal = Math.max(...bids.map((b) => b.total));
    const maxAskTotal = Math.max(...asks.map((a) => a.total));

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card"
        >
            <div className="card-header">
                <h3 className="font-semibold text-sm">Order Book</h3>
            </div>
            <div className="card-body p-0">
                {/* Header */}
                <div
                    className="grid grid-cols-3 gap-2 px-4 py-2 text-xs font-medium"
                    style={{
                        background: 'var(--background-tertiary)',
                        color: 'var(--foreground-muted)',
                    }}
                >
                    <span>Price</span>
                    <span className="text-center">Size</span>
                    <span className="text-right">Total</span>
                </div>

                {/* Asks (Sell Orders) - Reversed to show highest at top */}
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {[...asks].reverse().map((ask, index) => (
                        <div
                            key={`ask-${index}`}
                            className="grid grid-cols-3 gap-2 px-4 py-2 text-xs relative"
                        >
                            {/* Background bar */}
                            <div
                                className="absolute right-0 top-0 bottom-0 opacity-30"
                                style={{
                                    width: `${(ask.total / maxAskTotal) * 100}%`,
                                    background: 'var(--loss)',
                                }}
                            />
                            <span className="relative font-medium" style={{ color: 'var(--loss)' }}>
                                {ask.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span className="relative text-center" style={{ color: 'var(--foreground-muted)' }}>
                                {ask.quantity.toFixed(4)}
                            </span>
                            <span className="relative text-right" style={{ color: 'var(--foreground-muted)' }}>
                                {ask.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Spread / Current Price */}
                <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{
                        background: 'var(--background-tertiary)',
                        borderTop: '1px solid var(--border)',
                        borderBottom: '1px solid var(--border)',
                    }}
                >
                    <span className="text-sm font-semibold">
                        ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        Spread: ${((asks[0]?.price || 0) - (bids[0]?.price || 0)).toFixed(2)}
                    </span>
                </div>

                {/* Bids (Buy Orders) */}
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                    {bids.map((bid, index) => (
                        <div
                            key={`bid-${index}`}
                            className="grid grid-cols-3 gap-2 px-4 py-2 text-xs relative"
                        >
                            {/* Background bar */}
                            <div
                                className="absolute left-0 top-0 bottom-0 opacity-30"
                                style={{
                                    width: `${(bid.total / maxBidTotal) * 100}%`,
                                    background: 'var(--profit)',
                                }}
                            />
                            <span className="relative font-medium" style={{ color: 'var(--profit)' }}>
                                {bid.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            <span className="relative text-center" style={{ color: 'var(--foreground-muted)' }}>
                                {bid.quantity.toFixed(4)}
                            </span>
                            <span className="relative text-right" style={{ color: 'var(--foreground-muted)' }}>
                                {bid.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}

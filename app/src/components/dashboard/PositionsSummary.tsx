'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { MOCK_POSITIONS } from '@/lib/mockData';

export function PositionsSummary() {
    const totalValue = MOCK_POSITIONS.reduce(
        (acc, pos) => acc + pos.currentPrice * pos.quantity,
        0
    );
    const totalPnL = MOCK_POSITIONS.reduce((acc, pos) => acc + pos.pnl, 0);
    const isPositivePnL = totalPnL >= 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="card"
        >
            <div className="card-header flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Wallet size={18} style={{ color: 'var(--accent)' }} />
                    <h2 className="font-semibold">Open Positions</h2>
                    <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--background-tertiary)', color: 'var(--foreground-muted)' }}
                    >
                        {MOCK_POSITIONS.length}
                    </span>
                </div>
                <Link
                    href="/portfolio"
                    className="text-xs font-medium transition-colors"
                    style={{ color: 'var(--primary)' }}
                >
                    View All
                </Link>
            </div>
            <div className="card-body">
                {/* Summary Stats */}
                <div
                    className="flex items-center justify-between p-3 rounded-lg mb-4"
                    style={{ background: 'var(--background-tertiary)' }}
                >
                    <div>
                        <p className="text-xs mb-0.5" style={{ color: 'var(--foreground-muted)' }}>
                            Total Value
                        </p>
                        <p className="font-semibold">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs mb-0.5" style={{ color: 'var(--foreground-muted)' }}>
                            Unrealized P&L
                        </p>
                        <div className="flex items-center gap-1 justify-end">
                            {isPositivePnL ? (
                                <TrendingUp size={14} style={{ color: 'var(--profit)' }} />
                            ) : (
                                <TrendingDown size={14} style={{ color: 'var(--loss)' }} />
                            )}
                            <span
                                className="font-semibold"
                                style={{ color: isPositivePnL ? 'var(--profit)' : 'var(--loss)' }}
                            >
                                {isPositivePnL ? '+' : ''}${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Position List */}
                <div className="space-y-3">
                    {MOCK_POSITIONS.map((position, index) => {
                        const isPositive = position.pnl >= 0;
                        const value = position.currentPrice * position.quantity;

                        return (
                            <motion.div
                                key={position.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + index * 0.05 }}
                                className="flex items-center justify-between py-2"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                        style={{
                                            background:
                                                position.market === 'crypto'
                                                    ? 'linear-gradient(135deg, #f7931a, #ffb21a)'
                                                    : position.market === 'us'
                                                        ? 'linear-gradient(135deg, #4f46e5, #7c3aed)'
                                                        : 'linear-gradient(135deg, #059669, #10b981)',
                                        }}
                                    >
                                        {position.symbol.slice(0, 2)}
                                    </div>
                                    <div>
                                        <Link
                                            href={`/trade/${position.symbol}`}
                                            className="font-medium text-sm hover:text-[var(--primary)] transition-colors"
                                        >
                                            {position.symbol}
                                        </Link>
                                        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                            {position.quantity} units @ ${position.avgPrice.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-sm">
                                        ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </p>
                                    <div className="flex items-center gap-1 justify-end">
                                        {isPositive ? (
                                            <TrendingUp size={12} style={{ color: 'var(--profit)' }} />
                                        ) : (
                                            <TrendingDown size={12} style={{ color: 'var(--loss)' }} />
                                        )}
                                        <span
                                            className="text-xs"
                                            style={{ color: isPositive ? 'var(--profit)' : 'var(--loss)' }}
                                        >
                                            {isPositive ? '+' : ''}
                                            {position.pnlPercent.toFixed(2)}%
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </motion.div>
    );
}

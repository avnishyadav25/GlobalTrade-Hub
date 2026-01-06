'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    PieChart,
    MoreVertical,
} from 'lucide-react';
import { MOCK_POSITIONS } from '@/lib/mockData';
import { MARKET_LABELS } from '@/lib/constants';

export default function PortfolioPage() {
    const totalValue = MOCK_POSITIONS.reduce(
        (acc, pos) => acc + pos.currentPrice * pos.quantity,
        0
    );

    const totalPnL = MOCK_POSITIONS.reduce((acc, pos) => acc + pos.pnl, 0);
    const totalPnLPercent = (totalPnL / (totalValue - totalPnL)) * 100;
    const isPositivePnL = totalPnL >= 0;

    // Calculate allocation
    const allocation = MOCK_POSITIONS.reduce((acc, pos) => {
        const market = MARKET_LABELS[pos.market];
        const value = pos.currentPrice * pos.quantity;
        acc[market] = (acc[market] || 0) + value;
        return acc;
    }, {} as Record<string, number>);

    const allocationColors: Record<string, string> = {
        'NSE/BSE': '#10b981',
        'NASDAQ/NYSE': '#6366f1',
        'Crypto': '#f7931a',
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Portfolio</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
                    Track your holdings across all markets
                </p>
            </div>

            {/* Portfolio Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card col-span-2"
                >
                    <div className="card-body">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm mb-1" style={{ color: 'var(--foreground-muted)' }}>
                                    Total Portfolio Value
                                </p>
                                <p className="text-4xl font-bold">
                                    ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                    {isPositivePnL ? (
                                        <TrendingUp size={18} style={{ color: 'var(--profit)' }} />
                                    ) : (
                                        <TrendingDown size={18} style={{ color: 'var(--loss)' }} />
                                    )}
                                    <span
                                        className="font-semibold"
                                        style={{ color: isPositivePnL ? 'var(--profit)' : 'var(--loss)' }}
                                    >
                                        {isPositivePnL ? '+' : ''}${totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        {' '}({isPositivePnL ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
                                    </span>
                                    <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                                        all time
                                    </span>
                                </div>
                            </div>
                            <div
                                className="p-4 rounded-xl"
                                style={{ background: 'var(--primary-dim)' }}
                            >
                                <Wallet size={28} style={{ color: 'var(--primary)' }} />
                            </div>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="card"
                >
                    <div className="card-header flex items-center gap-2">
                        <PieChart size={18} style={{ color: 'var(--accent)' }} />
                        <h3 className="font-semibold text-sm">Allocation</h3>
                    </div>
                    <div className="card-body space-y-3">
                        {Object.entries(allocation).map(([market, value]) => (
                            <div key={market} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ background: allocationColors[market] || 'var(--foreground-muted)' }}
                                    />
                                    <span className="text-sm">{market}</span>
                                </div>
                                <span className="text-sm font-medium">
                                    {((value / totalValue) * 100).toFixed(1)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Holdings Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card"
            >
                <div className="card-header flex items-center justify-between">
                    <h3 className="font-semibold">Holdings</h3>
                    <span
                        className="text-xs px-2 py-1 rounded"
                        style={{ background: 'var(--background-tertiary)', color: 'var(--foreground-muted)' }}
                    >
                        {MOCK_POSITIONS.length} positions
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr style={{ background: 'var(--background-tertiary)' }}>
                                <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    Asset
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    Quantity
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    Avg Price
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    Current Price
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    Value
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    P&L
                                </th>
                                <th className="py-3 px-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {MOCK_POSITIONS.map((position, index) => {
                                const value = position.currentPrice * position.quantity;
                                const isPositive = position.pnl >= 0;

                                return (
                                    <motion.tr
                                        key={position.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="border-b"
                                        style={{ borderColor: 'var(--border)' }}
                                    >
                                        <td className="py-4 px-4">
                                            <Link href={`/trade/${position.symbol}`} className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
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
                                                    <p className="font-medium">{position.symbol}</p>
                                                    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                                        {position.name}
                                                    </p>
                                                </div>
                                            </Link>
                                        </td>
                                        <td className="py-4 px-4 text-right font-medium">
                                            {position.quantity}
                                        </td>
                                        <td className="py-4 px-4 text-right" style={{ color: 'var(--foreground-muted)' }}>
                                            ${position.avgPrice.toLocaleString()}
                                        </td>
                                        <td className="py-4 px-4 text-right font-medium">
                                            ${position.currentPrice.toLocaleString()}
                                        </td>
                                        <td className="py-4 px-4 text-right font-semibold">
                                            ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {isPositive ? (
                                                    <TrendingUp size={14} style={{ color: 'var(--profit)' }} />
                                                ) : (
                                                    <TrendingDown size={14} style={{ color: 'var(--loss)' }} />
                                                )}
                                                <div>
                                                    <p
                                                        className="font-medium"
                                                        style={{ color: isPositive ? 'var(--profit)' : 'var(--loss)' }}
                                                    >
                                                        {isPositive ? '+' : ''}${position.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </p>
                                                    <p
                                                        className="text-xs"
                                                        style={{ color: isPositive ? 'var(--profit)' : 'var(--loss)' }}
                                                    >
                                                        {isPositive ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-4">
                                            <button
                                                className="p-2 rounded transition-colors"
                                                style={{ color: 'var(--foreground-muted)' }}
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}

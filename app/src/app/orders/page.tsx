'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    ScrollText,
    Filter,
    Clock,
    CheckCircle,
    XCircle,
    ArrowUpRight,
    ArrowDownRight,
    Search,
} from 'lucide-react';
import { MOCK_ORDERS, type Order } from '@/lib/mockData';
import { useTradingStore } from '@/stores/tradingStore';

export default function OrdersPage() {
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [sideFilter, setSideFilter] = useState<string>('all');
    const { orders } = useTradingStore();

    // Combine mock orders with store orders
    const allOrders = [...orders, ...MOCK_ORDERS];

    const filteredOrders = allOrders.filter((order) => {
        if (statusFilter !== 'all' && order.status !== statusFilter) return false;
        if (sideFilter !== 'all' && order.side !== sideFilter) return false;
        return true;
    });

    const statusIcons: Record<string, React.ReactNode> = {
        pending: <Clock size={14} style={{ color: 'var(--accent)' }} />,
        filled: <CheckCircle size={14} style={{ color: 'var(--profit)' }} />,
        cancelled: <XCircle size={14} style={{ color: 'var(--foreground-muted)' }} />,
        rejected: <XCircle size={14} style={{ color: 'var(--loss)' }} />,
    };

    const statusColors: Record<string, string> = {
        pending: 'var(--accent)',
        filled: 'var(--profit)',
        cancelled: 'var(--foreground-muted)',
        rejected: 'var(--loss)',
    };

    const orderCounts = allOrders.reduce(
        (acc, order) => {
            acc[order.status] = (acc[order.status] || 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Orders</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
                    View and manage your trade orders
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Orders', value: allOrders.length, color: 'var(--primary)' },
                    { label: 'Pending', value: orderCounts.pending || 0, color: 'var(--accent)' },
                    { label: 'Filled', value: orderCounts.filled || 0, color: 'var(--profit)' },
                    { label: 'Cancelled', value: orderCounts.cancelled || 0, color: 'var(--foreground-muted)' },
                ].map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="card"
                    >
                        <div className="card-body py-4">
                            <p className="text-xs mb-1" style={{ color: 'var(--foreground-muted)' }}>
                                {stat.label}
                            </p>
                            <p className="text-2xl font-bold" style={{ color: stat.color }}>
                                {stat.value}
                            </p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <Filter size={16} style={{ color: 'var(--foreground-muted)' }} />
                    <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                        Status:
                    </span>
                    <div className="flex gap-1">
                        {['all', 'pending', 'filled', 'cancelled'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize"
                                style={{
                                    background: statusFilter === status ? 'var(--primary)' : 'var(--background-secondary)',
                                    color: statusFilter === status ? 'white' : 'var(--foreground-muted)',
                                }}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                        Side:
                    </span>
                    <div className="flex gap-1">
                        {['all', 'buy', 'sell'].map((side) => (
                            <button
                                key={side}
                                onClick={() => setSideFilter(side)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize"
                                style={{
                                    background: sideFilter === side ? 'var(--primary)' : 'var(--background-secondary)',
                                    color: sideFilter === side ? 'white' : 'var(--foreground-muted)',
                                }}
                            >
                                {side}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Orders Table */}
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
                                    Order
                                </th>
                                <th className="text-left py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    Symbol
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    Side
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    Type
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    Quantity
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    Price
                                </th>
                                <th className="text-center py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    Status
                                </th>
                                <th className="text-right py-3 px-4 text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                                    Time
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map((order, index) => {
                                const isBuy = order.side === 'buy';

                                return (
                                    <motion.tr
                                        key={order.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.02 }}
                                        className="border-b"
                                        style={{ borderColor: 'var(--border)' }}
                                    >
                                        <td className="py-4 px-4">
                                            <span className="text-xs font-mono" style={{ color: 'var(--foreground-muted)' }}>
                                                {order.id}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 font-medium">
                                            {order.symbol}
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium uppercase"
                                                style={{
                                                    background: isBuy ? 'var(--profit-dim)' : 'var(--loss-dim)',
                                                    color: isBuy ? 'var(--profit)' : 'var(--loss)',
                                                }}
                                            >
                                                {isBuy ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                                {order.side}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span className="text-xs capitalize" style={{ color: 'var(--foreground-muted)' }}>
                                                {order.type.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-right font-medium">
                                            {order.quantity}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            {order.price ? `$${order.price.toLocaleString()}` : 'Market'}
                                        </td>
                                        <td className="py-4 px-4 text-center">
                                            <span
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium capitalize"
                                                style={{
                                                    background: `${statusColors[order.status]}20`,
                                                    color: statusColors[order.status],
                                                }}
                                            >
                                                {statusIcons[order.status]}
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-4 text-right text-sm" style={{ color: 'var(--foreground-muted)' }}>
                                            {formatDate(order.createdAt)}
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {filteredOrders.length === 0 && (
                    <div className="py-12 text-center" style={{ color: 'var(--foreground-muted)' }}>
                        <ScrollText size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No orders found</p>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

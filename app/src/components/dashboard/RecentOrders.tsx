'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    CheckCircle,
    XCircle,
    Info,
} from 'lucide-react';
import { MOCK_ORDERS, type Order } from '@/lib/mockData';

interface OrderRowProps {
    order: Order;
    index: number;
}

function OrderRow({ order, index }: OrderRowProps) {
    const isBuy = order.side === 'buy';
    const statusIcons = {
        pending: <Clock size={14} style={{ color: 'var(--accent)' }} />,
        filled: <CheckCircle size={14} style={{ color: 'var(--profit)' }} />,
        cancelled: <XCircle size={14} style={{ color: 'var(--foreground-muted)' }} />,
        rejected: <XCircle size={14} style={{ color: 'var(--loss)' }} />,
    };

    const statusColors = {
        pending: 'var(--accent)',
        filled: 'var(--profit)',
        cancelled: 'var(--foreground-muted)',
        rejected: 'var(--loss)',
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center justify-between py-3 border-b"
            style={{ borderColor: 'var(--border)' }}
        >
            <div className="flex items-center gap-3">
                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                        background: isBuy ? 'var(--profit-dim)' : 'var(--loss-dim)',
                    }}
                >
                    {isBuy ? (
                        <ArrowUpRight size={16} style={{ color: 'var(--profit)' }} />
                    ) : (
                        <ArrowDownRight size={16} style={{ color: 'var(--loss)' }} />
                    )}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{order.symbol}</span>
                        <span
                            className="text-xs px-1.5 py-0.5 rounded uppercase"
                            style={{
                                background: isBuy ? 'var(--profit-dim)' : 'var(--loss-dim)',
                                color: isBuy ? 'var(--profit)' : 'var(--loss)',
                            }}
                        >
                            {order.side}
                        </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                        {order.quantity} @ {order.type === 'market' ? 'Market' : `$${order.price?.toLocaleString()}`}
                    </p>
                </div>
            </div>
            <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                    {statusIcons[order.status]}
                    <span
                        className="text-xs font-medium capitalize"
                        style={{ color: statusColors[order.status] }}
                    >
                        {order.status}
                    </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    {formatTime(order.createdAt)}
                </p>
            </div>
        </motion.div>
    );
}

export function RecentOrders() {
    const recentOrders = MOCK_ORDERS.slice(0, 5);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card"
        >
            <div className="card-header flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock size={18} style={{ color: 'var(--primary)' }} />
                    <h2 className="font-semibold">Recent Orders</h2>
                </div>
                <Link
                    href="/orders"
                    className="text-xs font-medium transition-colors"
                    style={{ color: 'var(--primary)' }}
                >
                    View All
                </Link>
            </div>
            <div className="card-body py-2">
                {recentOrders.length > 0 ? (
                    recentOrders.map((order, index) => (
                        <OrderRow key={order.id} order={order} index={index} />
                    ))
                ) : (
                    <div className="py-6 text-center" style={{ color: 'var(--foreground-muted)' }}>
                        <Info size={24} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No recent orders</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

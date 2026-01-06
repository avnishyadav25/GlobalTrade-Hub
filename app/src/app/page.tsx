'use client';

import { motion } from 'framer-motion';
import { useTradingStore } from '@/stores/tradingStore';
import {
  PortfolioSummary,
  Watchlist,
  RecentOrders,
  PositionsSummary,
} from '@/components/dashboard';
import { AlertTriangle, Zap } from 'lucide-react';

export default function Dashboard() {
  const { isPaperTrading } = useTradingStore();

  return (
    <div className="space-y-6">
      {/* Paper Trading Banner */}
      {isPaperTrading && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(139, 92, 246, 0.1))',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-500/20">
            <Zap size={20} className="text-green-500" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">Paper Trading Mode Active</p>
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              You're trading with virtual funds. Switch to live mode when ready.
            </p>
          </div>
          <span className="badge badge-profit">$100,000 Virtual Balance</span>
        </motion.div>
      )}

      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-2xl font-bold"
          >
            Good Evening 👋
          </motion.h1>
          <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
            Markets are open. Here's your portfolio overview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm" style={{ background: 'var(--profit-dim)' }}>
            <span className="w-2 h-2 rounded-full bg-green-500 pulse-live" />
            <span style={{ color: 'var(--profit)' }}>Markets Open</span>
          </span>
        </div>
      </div>

      {/* Portfolio Summary Cards */}
      <PortfolioSummary />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Watchlist - Takes 2 columns */}
        <div className="lg:col-span-2">
          <Watchlist />
        </div>

        {/* Positions Summary */}
        <div>
          <PositionsSummary />
        </div>
      </div>

      {/* Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentOrders />

        {/* Market Alerts / Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <div className="card-header flex items-center gap-2">
            <AlertTriangle size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="font-semibold">Market Alerts</h2>
          </div>
          <div className="card-body space-y-3">
            <div
              className="p-3 rounded-lg flex items-start gap-3"
              style={{ background: 'var(--profit-dim)' }}
            >
              <div className="w-2 h-2 rounded-full mt-1.5" style={{ background: 'var(--profit)' }} />
              <div>
                <p className="text-sm font-medium">BTC breaks $43,000</p>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  Bitcoin surged past key resistance level • 5m ago
                </p>
              </div>
            </div>
            <div
              className="p-3 rounded-lg flex items-start gap-3"
              style={{ background: 'var(--loss-dim)' }}
            >
              <div className="w-2 h-2 rounded-full mt-1.5" style={{ background: 'var(--loss)' }} />
              <div>
                <p className="text-sm font-medium">TSLA down 3.4%</p>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  Approaching your stop-loss target • 15m ago
                </p>
              </div>
            </div>
            <div
              className="p-3 rounded-lg flex items-start gap-3"
              style={{ background: 'var(--background-tertiary)' }}
            >
              <div className="w-2 h-2 rounded-full mt-1.5" style={{ background: 'var(--primary)' }} />
              <div>
                <p className="text-sm font-medium">NVDA earnings tomorrow</p>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  Expected volatility increase • 1h ago
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

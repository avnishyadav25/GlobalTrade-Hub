'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  BarChart3,
  PieChart,
  Activity,
} from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';
import { WATCHLIST_ASSETS } from '@/lib/mockData';

export default function DashboardPage() {
  const { isPaperTrading, paperBalance } = useTradingStore();

  // Calculate portfolio stats
  const totalInvestment = 125000;
  const currentValue = 176000;
  const overallPnL = currentValue - totalInvestment;
  const overallPnLPercent = ((overallPnL / totalInvestment) * 100).toFixed(2);
  const todayPnL = 2340;

  // Holdings breakdown
  const holdings = [
    { name: 'RELIANCE', value: 45000, color: '#e53935', percent: 25 },
    { name: 'TCS', value: 32000, color: '#ff9800', percent: 18 },
    { name: 'HDFC', value: 28000, color: '#4caf50', percent: 16 },
    { name: 'INFY', value: 24000, color: '#2196f3', percent: 14 },
    { name: 'ICICI', value: 20000, color: '#9c27b0', percent: 11 },
    { name: 'Others', value: 27000, color: '#607d8b', percent: 16 },
  ];

  return (
    <div className="space-y-6">
      {/* Kite-style Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-foreground">Hi, Trader</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {isPaperTrading && (
          <div className="px-3 py-1 rounded bg-profit/10 text-profit text-sm font-medium">
            Paper Trading Mode
          </div>
        )}
      </div>

      {/* Funds Section - Kite Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Equity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="kite-card p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Equity</span>
          </div>
          <div className="flex items-baseline gap-6">
            <div>
              <div className="text-2xl font-semibold text-profit">
                ₹{isPaperTrading ? paperBalance.toLocaleString('en-IN') : '50,000'}
              </div>
              <div className="text-xs text-muted-foreground">Available balance</div>
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground">Margins used</div>
              <div className="font-medium">₹5,000</div>
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground">Account value</div>
              <div className="font-medium">₹55,000</div>
            </div>
          </div>
        </motion.div>

        {/* Commodity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="kite-card p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Commodity</span>
          </div>
          <div className="flex items-baseline gap-6">
            <div>
              <div className="text-2xl font-semibold">
                ₹28,000
              </div>
              <div className="text-xs text-muted-foreground">Available balance</div>
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground">Margins used</div>
              <div className="font-medium">₹2,000</div>
            </div>
            <div className="text-sm">
              <div className="text-muted-foreground">Account value</div>
              <div className="font-medium">₹30,000</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Holdings Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="kite-card p-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <PieChart size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium">Holdings ({holdings.length})</span>
        </div>

        <div className="flex flex-wrap items-start gap-8">
          {/* P&L Display */}
          <div>
            <div className={`text-3xl font-semibold ${overallPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
              ₹{Math.abs(overallPnL / 1000).toFixed(2)}L
              <span className="text-lg ml-2">{overallPnLPercent}%</span>
            </div>
            <div className="text-xs text-muted-foreground">P&L</div>
          </div>

          {/* Stats */}
          <div className="flex gap-6 text-sm">
            <div>
              <div className="text-muted-foreground">Current value</div>
              <div className="font-medium">₹{(currentValue / 100000).toFixed(2)}L</div>
            </div>
            <div>
              <div className="text-muted-foreground">Investment</div>
              <div className="font-medium">₹{(totalInvestment / 100000).toFixed(2)}L</div>
            </div>
          </div>
        </div>

        {/* Holdings Progress Bar */}
        <div className="mt-4 h-6 rounded overflow-hidden flex">
          {holdings.map((holding, i) => (
            <div
              key={holding.name}
              className="h-full transition-all hover:opacity-80"
              style={{
                width: `${holding.percent}%`,
                backgroundColor: holding.color,
              }}
              title={`${holding.name}: ₹${holding.value.toLocaleString('en-IN')}`}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          {holdings.map((holding) => (
            <div key={holding.name} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: holding.color }} />
              <span className="text-muted-foreground">{holding.name}</span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span>Current Value</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full border border-muted-foreground" />
            <span>Investment Value</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-profit" />
            <span>P&L</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Market Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="kite-card p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium">Market overview</span>
          </div>

          <div className="space-y-3">
            {[
              { name: 'NIFTY 50', value: 22456.80, change: 0.45 },
              { name: 'SENSEX', value: 73890.45, change: 0.38 },
              { name: 'BANKNIFTY', value: 48234.50, change: -0.22 },
              { name: 'NIFTY IT', value: 35678.90, change: 1.12 },
            ].map((index) => (
              <div key={index.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm">{index.name}</span>
                <div className="text-right">
                  <span className="text-sm font-medium">{index.value.toLocaleString('en-IN')}</span>
                  <span className={`ml-2 text-xs ${index.change >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {index.change >= 0 ? '+' : ''}{index.change}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Positions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="kite-card p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium">Positions (3)</span>
            </div>
            <Link href="/positions" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>

          <div className="space-y-2">
            {[
              { symbol: 'EURUSD18MAR', qty: 1, pnl: 1250, pnlPercent: 2.5, type: 'FUT' },
              { symbol: 'INFY (CNC)', qty: 50, pnl: -340, pnlPercent: -0.8, type: 'EQ' },
              { symbol: 'EURUSD18APRFUT', qty: 2, pnl: 890, pnlPercent: 1.2, type: 'FUT' },
            ].map((position) => (
              <div key={position.symbol} className="flex items-center justify-between py-2">
                <div>
                  <span className="text-sm font-medium">{position.symbol}</span>
                  <span className="text-xs text-muted-foreground ml-2">x{position.qty}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-16 h-2 rounded-full overflow-hidden ${position.pnl >= 0 ? 'bg-profit/20' : 'bg-loss/20'}`}>
                    <div
                      className={`h-full ${position.pnl >= 0 ? 'bg-profit' : 'bg-loss'}`}
                      style={{ width: `${Math.min(Math.abs(position.pnlPercent) * 20, 100)}%` }}
                    />
                  </div>
                  <span className={`text-sm font-medium ${position.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {position.pnl >= 0 ? '+' : ''}₹{position.pnl.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

'use client';

import { motion } from 'framer-motion';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    BarChart3,
    Activity,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
    title: string;
    value: string;
    change?: number;
    changeLabel?: string;
    icon: React.ReactNode;
    delay?: number;
}

function StatCard({ title, value, change, changeLabel, icon, delay = 0 }: StatCardProps) {
    const isPositive = change && change > 0;
    const isNegative = change && change < 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.3 }}
        >
            <Card className="bg-card border-border hover:border-border-hover transition-colors">
                <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm mb-1 text-muted-foreground">
                                {title}
                            </p>
                            <p className="text-2xl font-bold">{value}</p>
                            {change !== undefined && (
                                <div className="flex items-center gap-1 mt-2">
                                    {isPositive ? (
                                        <TrendingUp size={14} className="text-profit" />
                                    ) : isNegative ? (
                                        <TrendingDown size={14} className="text-loss" />
                                    ) : null}
                                    <span
                                        className={`text-sm font-medium ${isPositive
                                                ? 'text-profit'
                                                : isNegative
                                                    ? 'text-loss'
                                                    : 'text-muted-foreground'
                                            }`}
                                    >
                                        {isPositive ? '+' : ''}
                                        {change.toFixed(2)}%
                                    </span>
                                    {changeLabel && (
                                        <span className="text-xs text-muted-foreground">
                                            {changeLabel}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-3 rounded-xl bg-primary/20">
                            {icon}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

export function PortfolioSummary() {
    const portfolioData = {
        netWorth: 145230.50,
        todayPnL: 1250.80,
        todayPnLPercent: 0.87,
        totalPnL: 15230.50,
        totalPnLPercent: 11.72,
        openPositions: 8,
        dayVolume: 45678.90,
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
                title="Total Net Worth"
                value={`$${portfolioData.netWorth.toLocaleString()}`}
                change={portfolioData.totalPnLPercent}
                changeLabel="all time"
                icon={<DollarSign size={20} className="text-primary" />}
                delay={0}
            />
            <StatCard
                title="Today's P&L"
                value={`${portfolioData.todayPnL >= 0 ? '+' : ''}$${portfolioData.todayPnL.toLocaleString()}`}
                change={portfolioData.todayPnLPercent}
                changeLabel="today"
                icon={<BarChart3 size={20} className="text-primary" />}
                delay={0.1}
            />
            <StatCard
                title="Open Positions"
                value={portfolioData.openPositions.toString()}
                icon={<Activity size={20} className="text-primary" />}
                delay={0.2}
            />
            <StatCard
                title="Day Volume"
                value={`$${portfolioData.dayVolume.toLocaleString()}`}
                icon={<TrendingUp size={20} className="text-primary" />}
                delay={0.3}
            />
        </div>
    );
}

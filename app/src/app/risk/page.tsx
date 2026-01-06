'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Shield,
    AlertTriangle,
    Zap,
    Calculator,
    TrendingDown,
    Power,
    DollarSign,
    Percent,
    Info,
} from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';

export default function RiskPage() {
    const { riskSettings, updateRiskSettings, isPaperTrading } = useTradingStore();
    const [tempMaxLoss, setTempMaxLoss] = useState(riskSettings.maxDailyLoss.toString());
    const [tempRiskPercent, setTempRiskPercent] = useState(riskSettings.riskPerTrade.toString());

    const handleSaveRiskSettings = () => {
        updateRiskSettings({
            maxDailyLoss: parseFloat(tempMaxLoss),
            riskPerTrade: parseFloat(tempRiskPercent),
        });
    };

    const toggleKillSwitch = () => {
        updateRiskSettings({ killSwitchActive: !riskSettings.killSwitchActive });
    };

    const triggerKillSwitch = () => {
        updateRiskSettings({ killSwitchTriggered: true });
    };

    const resetKillSwitch = () => {
        updateRiskSettings({
            killSwitchTriggered: false,
            currentDailyLoss: 0,
        });
    };

    // Position sizing calculator
    const [capital, setCapital] = useState('100000');
    const [entryPrice, setEntryPrice] = useState('100');
    const [stopLoss, setStopLoss] = useState('95');
    const [riskPercent, setRiskPercent] = useState('1');

    const calculatePositionSize = () => {
        const cap = parseFloat(capital) || 0;
        const entry = parseFloat(entryPrice) || 0;
        const stop = parseFloat(stopLoss) || 0;
        const risk = parseFloat(riskPercent) || 0;

        const riskAmount = cap * (risk / 100);
        const stopDistance = Math.abs(entry - stop);
        const positionSize = stopDistance > 0 ? Math.floor(riskAmount / stopDistance) : 0;
        const positionValue = positionSize * entry;

        return { riskAmount, stopDistance, positionSize, positionValue };
    };

    const posCalc = calculatePositionSize();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Shield size={28} style={{ color: 'var(--accent)' }} />
                    Risk Manager
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
                    Protect your capital with automated risk controls
                </p>
            </div>

            {/* Kill Switch Status */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-6 rounded-xl border ${riskSettings.killSwitchTriggered
                        ? 'bg-red-500/10 border-red-500/30'
                        : riskSettings.killSwitchActive
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'border-[var(--border)]'
                    }`}
                style={!riskSettings.killSwitchActive && !riskSettings.killSwitchTriggered ? { background: 'var(--background-secondary)' } : {}}
            >
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <div
                            className={`p-3 rounded-xl ${riskSettings.killSwitchTriggered
                                    ? 'bg-red-500/20'
                                    : riskSettings.killSwitchActive
                                        ? 'bg-green-500/20'
                                        : ''
                                }`}
                            style={!riskSettings.killSwitchActive && !riskSettings.killSwitchTriggered ? { background: 'var(--background-tertiary)' } : {}}
                        >
                            <Power
                                size={28}
                                style={{
                                    color: riskSettings.killSwitchTriggered
                                        ? 'var(--loss)'
                                        : riskSettings.killSwitchActive
                                            ? 'var(--profit)'
                                            : 'var(--foreground-muted)',
                                }}
                            />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Kill Switch</h2>
                            <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
                                {riskSettings.killSwitchTriggered
                                    ? 'TRIGGERED - All buy orders are disabled for 24 hours'
                                    : riskSettings.killSwitchActive
                                        ? 'Armed and monitoring your daily P&L'
                                        : 'Disabled - No automatic protection active'}
                            </p>
                            <div className="flex items-center gap-4 mt-4">
                                <div>
                                    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                        Max Daily Loss
                                    </p>
                                    <p className="font-bold text-lg">${riskSettings.maxDailyLoss.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                        Current Loss
                                    </p>
                                    <p
                                        className="font-bold text-lg"
                                        style={{
                                            color:
                                                riskSettings.currentDailyLoss > riskSettings.maxDailyLoss * 0.8
                                                    ? 'var(--loss)'
                                                    : 'var(--foreground)',
                                        }}
                                    >
                                        ${riskSettings.currentDailyLoss.toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                        Remaining
                                    </p>
                                    <p className="font-bold text-lg" style={{ color: 'var(--profit)' }}>
                                        ${(riskSettings.maxDailyLoss - riskSettings.currentDailyLoss).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={toggleKillSwitch}
                            className="px-4 py-2 rounded-lg font-medium text-sm"
                            style={{
                                background: riskSettings.killSwitchActive ? 'var(--loss)' : 'var(--profit)',
                                color: 'white',
                            }}
                        >
                            {riskSettings.killSwitchActive ? 'Disable' : 'Enable'}
                        </button>
                        {riskSettings.killSwitchTriggered && (
                            <button
                                onClick={resetKillSwitch}
                                className="px-4 py-2 rounded-lg font-medium text-sm"
                                style={{ background: 'var(--background-tertiary)', color: 'var(--foreground)' }}
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress Bar */}
                {riskSettings.killSwitchActive && (
                    <div className="mt-4">
                        <div
                            className="h-2 rounded-full overflow-hidden"
                            style={{ background: 'var(--background-tertiary)' }}
                        >
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                    width: `${(riskSettings.currentDailyLoss / riskSettings.maxDailyLoss) * 100}%`,
                                }}
                                className="h-full rounded-full"
                                style={{
                                    background:
                                        riskSettings.currentDailyLoss > riskSettings.maxDailyLoss * 0.8
                                            ? 'var(--loss)'
                                            : riskSettings.currentDailyLoss > riskSettings.maxDailyLoss * 0.5
                                                ? 'var(--accent)'
                                                : 'var(--profit)',
                                }}
                            />
                        </div>
                    </div>
                )}
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Risk Settings */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="card"
                >
                    <div className="card-header flex items-center gap-2">
                        <AlertTriangle size={18} style={{ color: 'var(--accent)' }} />
                        <h3 className="font-semibold">Risk Settings</h3>
                    </div>
                    <div className="card-body space-y-4">
                        <div>
                            <label className="text-sm mb-2 block" style={{ color: 'var(--foreground-muted)' }}>
                                Max Daily Loss ($)
                            </label>
                            <div className="relative">
                                <DollarSign
                                    size={16}
                                    className="absolute left-3 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--foreground-muted)' }}
                                />
                                <input
                                    type="number"
                                    value={tempMaxLoss}
                                    onChange={(e) => setTempMaxLoss(e.target.value)}
                                    className="input pl-8"
                                    placeholder="500"
                                />
                            </div>
                            <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
                                Trading will stop when this loss is reached
                            </p>
                        </div>

                        <div>
                            <label className="text-sm mb-2 block" style={{ color: 'var(--foreground-muted)' }}>
                                Risk Per Trade (%)
                            </label>
                            <div className="relative">
                                <Percent
                                    size={16}
                                    className="absolute left-3 top-1/2 -translate-y-1/2"
                                    style={{ color: 'var(--foreground-muted)' }}
                                />
                                <input
                                    type="number"
                                    value={tempRiskPercent}
                                    onChange={(e) => setTempRiskPercent(e.target.value)}
                                    className="input pl-8"
                                    placeholder="1"
                                    step="0.5"
                                    min="0.1"
                                    max="10"
                                />
                            </div>
                            <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
                                Maximum capital at risk per single trade
                            </p>
                        </div>

                        <button
                            onClick={handleSaveRiskSettings}
                            className="w-full btn btn-primary"
                        >
                            Save Settings
                        </button>
                    </div>
                </motion.div>

                {/* Position Size Calculator */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="card"
                >
                    <div className="card-header flex items-center gap-2">
                        <Calculator size={18} style={{ color: 'var(--primary)' }} />
                        <h3 className="font-semibold">Position Size Calculator</h3>
                    </div>
                    <div className="card-body space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs mb-1 block" style={{ color: 'var(--foreground-muted)' }}>
                                    Total Capital ($)
                                </label>
                                <input
                                    type="number"
                                    value={capital}
                                    onChange={(e) => setCapital(e.target.value)}
                                    className="input"
                                    placeholder="100000"
                                />
                            </div>
                            <div>
                                <label className="text-xs mb-1 block" style={{ color: 'var(--foreground-muted)' }}>
                                    Risk (%)
                                </label>
                                <input
                                    type="number"
                                    value={riskPercent}
                                    onChange={(e) => setRiskPercent(e.target.value)}
                                    className="input"
                                    placeholder="1"
                                    step="0.5"
                                />
                            </div>
                            <div>
                                <label className="text-xs mb-1 block" style={{ color: 'var(--foreground-muted)' }}>
                                    Entry Price ($)
                                </label>
                                <input
                                    type="number"
                                    value={entryPrice}
                                    onChange={(e) => setEntryPrice(e.target.value)}
                                    className="input"
                                    placeholder="100"
                                />
                            </div>
                            <div>
                                <label className="text-xs mb-1 block" style={{ color: 'var(--foreground-muted)' }}>
                                    Stop Loss ($)
                                </label>
                                <input
                                    type="number"
                                    value={stopLoss}
                                    onChange={(e) => setStopLoss(e.target.value)}
                                    className="input"
                                    placeholder="95"
                                />
                            </div>
                        </div>

                        <div
                            className="p-4 rounded-lg space-y-2"
                            style={{ background: 'var(--background-tertiary)' }}
                        >
                            <div className="flex items-center justify-between text-sm">
                                <span style={{ color: 'var(--foreground-muted)' }}>Risk Amount</span>
                                <span className="font-semibold">${posCalc.riskAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span style={{ color: 'var(--foreground-muted)' }}>Stop Distance</span>
                                <span className="font-semibold">${posCalc.stopDistance.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span style={{ color: 'var(--foreground-muted)' }}>Position Size</span>
                                <span className="font-bold text-lg" style={{ color: 'var(--primary)' }}>
                                    {posCalc.positionSize.toLocaleString()} units
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span style={{ color: 'var(--foreground-muted)' }}>Position Value</span>
                                <span className="font-semibold">${posCalc.positionValue.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Paper Trading Info */}
            {isPaperTrading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 p-4 rounded-xl"
                    style={{
                        background: 'var(--profit-dim)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                    }}
                >
                    <Info size={20} style={{ color: 'var(--profit)' }} />
                    <div>
                        <p className="text-sm font-medium">Paper Trading Mode Active</p>
                        <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                            Risk settings will apply to your virtual trades. Test your strategy safely.
                        </p>
                    </div>
                </motion.div>
            )}
        </div>
    );
}

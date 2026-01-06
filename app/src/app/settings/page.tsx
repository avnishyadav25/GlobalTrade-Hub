'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Settings,
    User,
    Bell,
    Shield,
    Palette,
    Globe,
    Link2,
    ChevronRight,
    Check,
} from 'lucide-react';

export default function SettingsPage() {
    const [notifications, setNotifications] = useState({
        priceAlerts: true,
        orderFills: true,
        newsAlerts: false,
        marketOpen: true,
    });

    const [theme, setTheme] = useState('dark');
    const [currency, setCurrency] = useState('USD');

    const settingsSections = [
        {
            title: 'Account',
            icon: User,
            items: [
                { label: 'Profile', description: 'Manage your account details', href: '#' },
                { label: 'Security', description: '2FA and password settings', href: '#' },
                { label: 'KYC Verification', description: 'Complete identity verification', href: '#' },
            ],
        },
        {
            title: 'Connected Brokers',
            icon: Link2,
            items: [
                { label: 'Dhan', description: 'Indian Equities', status: 'connected' },
                { label: 'Alpaca', description: 'US Stocks', status: 'not_connected' },
                { label: 'Binance', description: 'Cryptocurrency', status: 'connected' },
            ],
        },
    ];

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Settings size={28} style={{ color: 'var(--primary)' }} />
                    Settings
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>
                    Customize your trading experience
                </p>
            </div>

            {/* Appearance */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
            >
                <div className="card-header flex items-center gap-2">
                    <Palette size={18} style={{ color: 'var(--accent)' }} />
                    <h3 className="font-semibold">Appearance</h3>
                </div>
                <div className="card-body space-y-4">
                    <div>
                        <label className="text-sm mb-3 block" style={{ color: 'var(--foreground-muted)' }}>
                            Theme
                        </label>
                        <div className="flex gap-3">
                            {[
                                { value: 'dark', label: 'Dark', icon: '🌙' },
                                { value: 'light', label: 'Light', icon: '☀️' },
                                { value: 'system', label: 'System', icon: '💻' },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setTheme(option.value)}
                                    className={`flex-1 p-4 rounded-xl border-2 transition-all ${theme === option.value ? 'border-[var(--primary)]' : 'border-transparent'
                                        }`}
                                    style={{
                                        background:
                                            theme === option.value ? 'var(--primary-dim)' : 'var(--background-tertiary)',
                                    }}
                                >
                                    <div className="text-2xl mb-2">{option.icon}</div>
                                    <div className="text-sm font-medium">{option.label}</div>
                                    {theme === option.value && (
                                        <Check
                                            size={14}
                                            className="mt-1 mx-auto"
                                            style={{ color: 'var(--primary)' }}
                                        />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm mb-3 block" style={{ color: 'var(--foreground-muted)' }}>
                            Display Currency
                        </label>
                        <div className="flex gap-2">
                            {['USD', 'INR', 'EUR', 'GBP'].map((curr) => (
                                <button
                                    key={curr}
                                    onClick={() => setCurrency(curr)}
                                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                    style={{
                                        background: currency === curr ? 'var(--primary)' : 'var(--background-tertiary)',
                                        color: currency === curr ? 'white' : 'var(--foreground-muted)',
                                    }}
                                >
                                    {curr}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Notifications */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card"
            >
                <div className="card-header flex items-center gap-2">
                    <Bell size={18} style={{ color: 'var(--primary)' }} />
                    <h3 className="font-semibold">Notifications</h3>
                </div>
                <div className="card-body space-y-4">
                    {Object.entries({
                        priceAlerts: { label: 'Price Alerts', description: 'Get notified when prices hit your targets' },
                        orderFills: { label: 'Order Fills', description: 'Notifications when your orders are executed' },
                        newsAlerts: { label: 'News Alerts', description: 'Breaking news about your holdings' },
                        marketOpen: { label: 'Market Open/Close', description: 'Daily market session reminders' },
                    }).map(([key, { label, description }]) => (
                        <div
                            key={key}
                            className="flex items-center justify-between py-2"
                        >
                            <div>
                                <p className="font-medium text-sm">{label}</p>
                                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                    {description}
                                </p>
                            </div>
                            <button
                                onClick={() => setNotifications(prev => ({ ...prev, [key]: !prev[key as keyof typeof notifications] }))}
                                className="relative w-12 h-6 rounded-full transition-colors"
                                style={{
                                    background: notifications[key as keyof typeof notifications]
                                        ? 'var(--primary)'
                                        : 'var(--background-tertiary)',
                                }}
                            >
                                <motion.div
                                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                                    animate={{
                                        left: notifications[key as keyof typeof notifications] ? 28 : 4,
                                    }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                />
                            </button>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* Settings Sections */}
            {settingsSections.map((section, sectionIndex) => (
                <motion.div
                    key={section.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + sectionIndex * 0.1 }}
                    className="card"
                >
                    <div className="card-header flex items-center gap-2">
                        <section.icon size={18} style={{ color: 'var(--accent)' }} />
                        <h3 className="font-semibold">{section.title}</h3>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                        {section.items.map((item, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between px-5 py-4 hover:bg-[var(--background-tertiary)] cursor-pointer transition-colors"
                            >
                                <div>
                                    <p className="font-medium text-sm">{item.label}</p>
                                    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                        {item.description}
                                    </p>
                                </div>
                                {'status' in item ? (
                                    <span
                                        className="text-xs px-2 py-1 rounded font-medium"
                                        style={{
                                            background:
                                                item.status === 'connected' ? 'var(--profit-dim)' : 'var(--background-tertiary)',
                                            color:
                                                item.status === 'connected' ? 'var(--profit)' : 'var(--foreground-muted)',
                                        }}
                                    >
                                        {item.status === 'connected' ? 'Connected' : 'Connect'}
                                    </span>
                                ) : (
                                    <ChevronRight size={18} style={{ color: 'var(--foreground-muted)' }} />
                                )}
                            </div>
                        ))}
                    </div>
                </motion.div>
            ))}

            {/* Danger Zone */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="card border-red-500/30"
                style={{ background: 'rgba(239, 68, 68, 0.05)' }}
            >
                <div className="card-header flex items-center gap-2">
                    <Shield size={18} style={{ color: 'var(--loss)' }} />
                    <h3 className="font-semibold" style={{ color: 'var(--loss)' }}>
                        Danger Zone
                    </h3>
                </div>
                <div className="card-body">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-sm">Reset Paper Trading Balance</p>
                            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                                Reset your virtual balance to $100,000
                            </p>
                        </div>
                        <button
                            className="px-4 py-2 rounded-lg text-sm font-medium border"
                            style={{
                                borderColor: 'var(--loss)',
                                color: 'var(--loss)',
                                background: 'transparent',
                            }}
                        >
                            Reset Balance
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
    Settings,
    User,
    Bell,
    Shield,
    Palette,
    Link2,
    ChevronRight,
    Check,
    Moon,
    Sun,
    Monitor,
} from 'lucide-react';

export default function SettingsPage() {
    const { theme, setTheme } = useTheme();
    const [notifications, setNotifications] = useState({
        priceAlerts: true,
        orderFills: true,
        newsAlerts: false,
        marketOpen: true,
    });

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

    const themeOptions = [
        { value: 'dark', label: 'Dark', icon: Moon },
        { value: 'light', label: 'Light', icon: Sun },
        { value: 'system', label: 'System', icon: Monitor },
    ];

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Settings size={28} className="text-primary" />
                    Settings
                </h1>
                <p className="text-sm mt-1 text-muted-foreground">
                    Customize your trading experience
                </p>
            </div>

            {/* Appearance */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border bg-card"
            >
                <div className="p-4 border-b border-border flex items-center gap-2">
                    <Palette size={18} className="text-accent" />
                    <h3 className="font-semibold">Appearance</h3>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="text-sm mb-3 block text-muted-foreground">
                            Theme
                        </label>
                        <div className="flex gap-3">
                            {themeOptions.map((option) => {
                                const Icon = option.icon;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => setTheme(option.value)}
                                        className={`flex-1 p-4 rounded-xl border-2 transition-all ${theme === option.value ? 'border-primary bg-primary/10' : 'border-transparent bg-secondary'
                                            }`}
                                    >
                                        <Icon size={24} className={`mb-2 mx-auto ${theme === option.value ? 'text-primary' : 'text-muted-foreground'}`} />
                                        <div className="text-sm font-medium">{option.label}</div>
                                        {theme === option.value && (
                                            <Check
                                                size={14}
                                                className="mt-1 mx-auto text-primary"
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="text-sm mb-3 block text-muted-foreground">
                            Display Currency
                        </label>
                        <div className="flex gap-2">
                            {['USD', 'INR', 'EUR', 'GBP'].map((curr) => (
                                <button
                                    key={curr}
                                    onClick={() => setCurrency(curr)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currency === curr
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                                        }`}
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
                className="rounded-xl border border-border bg-card"
            >
                <div className="p-4 border-b border-border flex items-center gap-2">
                    <Bell size={18} className="text-primary" />
                    <h3 className="font-semibold">Notifications</h3>
                </div>
                <div className="p-4 space-y-4">
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
                                <p className="text-xs text-muted-foreground">
                                    {description}
                                </p>
                            </div>
                            <button
                                onClick={() => setNotifications(prev => ({ ...prev, [key]: !prev[key as keyof typeof notifications] }))}
                                className={`relative w-12 h-6 rounded-full transition-colors ${notifications[key as keyof typeof notifications]
                                    ? 'bg-primary'
                                    : 'bg-secondary'
                                    }`}
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
                    className="rounded-xl border border-border bg-card"
                >
                    <div className="p-4 border-b border-border flex items-center gap-2">
                        <section.icon size={18} className="text-accent" />
                        <h3 className="font-semibold">{section.title}</h3>
                    </div>
                    <div className="divide-y divide-border">
                        {section.items.map((item, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between px-4 py-4 hover:bg-secondary/50 cursor-pointer transition-colors"
                            >
                                <div>
                                    <p className="font-medium text-sm">{item.label}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.description}
                                    </p>
                                </div>
                                {'status' in item ? (
                                    <span
                                        className={`text-xs px-2 py-1 rounded font-medium ${item.status === 'connected'
                                            ? 'bg-profit/20 text-profit'
                                            : 'bg-secondary text-muted-foreground'
                                            }`}
                                    >
                                        {item.status === 'connected' ? 'Connected' : 'Connect'}
                                    </span>
                                ) : (
                                    <ChevronRight size={18} className="text-muted-foreground" />
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
                className="rounded-xl border border-destructive/30 bg-destructive/5"
            >
                <div className="p-4 border-b border-destructive/30 flex items-center gap-2">
                    <Shield size={18} className="text-destructive" />
                    <h3 className="font-semibold text-destructive">
                        Danger Zone
                    </h3>
                </div>
                <div className="p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-sm">Reset Paper Trading Balance</p>
                            <p className="text-xs text-muted-foreground">
                                Reset your virtual balance to $100,000
                            </p>
                        </div>
                        <button
                            className="px-4 py-2 rounded-lg text-sm font-medium border border-destructive text-destructive hover:bg-destructive/10 transition-colors"
                        >
                            Reset Balance
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

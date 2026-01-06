// Zustand store for trading state management

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MOCK_POSITIONS, MOCK_ORDERS, type Position, type Order } from '@/lib/mockData';

interface RiskSettings {
    maxDailyLoss: number;
    currentDailyLoss: number;
    killSwitchActive: boolean;
    killSwitchTriggered: boolean;
    riskPerTrade: number; // Percentage
}

interface TradingState {
    // Paper Trading
    isPaperTrading: boolean;
    paperBalance: number;
    initialPaperBalance: number;

    // Positions & Orders
    positions: Position[];
    orders: Order[];

    // Risk Management
    riskSettings: RiskSettings;

    // UI State
    selectedSymbol: string | null;
    watchlist: string[];

    // Actions
    togglePaperTrading: () => void;
    resetPaperBalance: () => void;
    setSelectedSymbol: (symbol: string | null) => void;
    addToWatchlist: (symbol: string) => void;
    removeFromWatchlist: (symbol: string) => void;
    updateRiskSettings: (settings: Partial<RiskSettings>) => void;
    placeOrder: (order: Omit<Order, 'id' | 'status' | 'createdAt'>) => void;
    cancelOrder: (orderId: string) => void;
}

export const useTradingStore = create<TradingState>()(
    persist(
        (set, get) => ({
            // Initial State
            isPaperTrading: true,
            paperBalance: 100000,
            initialPaperBalance: 100000,

            positions: MOCK_POSITIONS,
            orders: MOCK_ORDERS,

            riskSettings: {
                maxDailyLoss: 500,
                currentDailyLoss: 0,
                killSwitchActive: true,
                killSwitchTriggered: false,
                riskPerTrade: 1, // 1% of capital
            },

            selectedSymbol: null,
            watchlist: ['BTCUSDT', 'ETHUSDT', 'AAPL', 'TSLA', 'TATASTEEL', 'RELIANCE'],

            // Actions
            togglePaperTrading: () => set((state) => ({
                isPaperTrading: !state.isPaperTrading
            })),

            resetPaperBalance: () => set((state) => ({
                paperBalance: state.initialPaperBalance
            })),

            setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),

            addToWatchlist: (symbol) => set((state) => ({
                watchlist: state.watchlist.includes(symbol)
                    ? state.watchlist
                    : [...state.watchlist, symbol]
            })),

            removeFromWatchlist: (symbol) => set((state) => ({
                watchlist: state.watchlist.filter((s) => s !== symbol)
            })),

            updateRiskSettings: (settings) => set((state) => ({
                riskSettings: { ...state.riskSettings, ...settings }
            })),

            placeOrder: (orderData) => {
                const state = get();

                // Check kill switch
                if (state.riskSettings.killSwitchTriggered && orderData.side === 'buy') {
                    console.warn('Kill switch triggered - buy orders disabled');
                    return;
                }

                const newOrder: Order = {
                    ...orderData,
                    id: `ord-${Date.now()}`,
                    status: orderData.type === 'market' ? 'filled' : 'pending',
                    createdAt: new Date().toISOString(),
                    ...(orderData.type === 'market' && { filledAt: new Date().toISOString() }),
                };

                set((state) => ({
                    orders: [newOrder, ...state.orders]
                }));
            },

            cancelOrder: (orderId) => set((state) => ({
                orders: state.orders.map((order) =>
                    order.id === orderId ? { ...order, status: 'cancelled' } : order
                )
            })),
        }),
        {
            name: 'globaltrade-storage',
            partialize: (state) => ({
                isPaperTrading: state.isPaperTrading,
                paperBalance: state.paperBalance,
                watchlist: state.watchlist,
                riskSettings: state.riskSettings,
            }),
        }
    )
);

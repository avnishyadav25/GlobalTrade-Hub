import { create } from 'zustand';

export interface PriceUpdate {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    timestamp: number;
    bid?: number;
    ask?: number;
}

export interface OrderUpdate {
    orderId: string;
    symbol: string;
    status: 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';
    filledQuantity: number;
    filledPrice: number;
    timestamp: number;
}

export interface WebSocketState {
    // Connection state
    isConnected: boolean;
    connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
    lastHeartbeat: number | null;

    // Price data
    prices: Record<string, PriceUpdate>;
    subscribedSymbols: string[];

    // Order updates
    orderUpdates: OrderUpdate[];

    // Actions
    setConnectionStatus: (status: WebSocketState['connectionStatus']) => void;
    updatePrice: (update: PriceUpdate) => void;
    updatePrices: (updates: PriceUpdate[]) => void;
    subscribe: (symbols: string[]) => void;
    unsubscribe: (symbols: string[]) => void;
    addOrderUpdate: (update: OrderUpdate) => void;
    clearOrderUpdates: () => void;
    setHeartbeat: () => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
    // Initial state
    isConnected: false,
    connectionStatus: 'disconnected',
    lastHeartbeat: null,
    prices: {},
    subscribedSymbols: [],
    orderUpdates: [],

    // Actions
    setConnectionStatus: (status) =>
        set({
            connectionStatus: status,
            isConnected: status === 'connected',
        }),

    updatePrice: (update) =>
        set((state) => ({
            prices: {
                ...state.prices,
                [update.symbol]: update,
            },
        })),

    updatePrices: (updates) =>
        set((state) => {
            const newPrices = { ...state.prices };
            updates.forEach((update) => {
                newPrices[update.symbol] = update;
            });
            return { prices: newPrices };
        }),

    subscribe: (symbols) =>
        set((state) => ({
            subscribedSymbols: [...new Set([...state.subscribedSymbols, ...symbols])],
        })),

    unsubscribe: (symbols) =>
        set((state) => ({
            subscribedSymbols: state.subscribedSymbols.filter(
                (s) => !symbols.includes(s)
            ),
        })),

    addOrderUpdate: (update) =>
        set((state) => ({
            orderUpdates: [update, ...state.orderUpdates.slice(0, 99)], // Keep last 100
        })),

    clearOrderUpdates: () => set({ orderUpdates: [] }),

    setHeartbeat: () => set({ lastHeartbeat: Date.now() }),
}));

// Simulated market data generator (for development/demo)
export function startMockPriceUpdates(
    symbols: string[],
    basePrices: Record<string, number>
) {
    const interval = setInterval(() => {
        const store = useWebSocketStore.getState();

        // Pick a random symbol to update
        const symbol = symbols[Math.floor(Math.random() * symbols.length)];
        const basePrice = basePrices[symbol] || 100;
        const currentPrice = store.prices[symbol]?.price || basePrice;

        // Random price movement (±0.5%)
        const volatility = 0.005;
        const change = currentPrice * volatility * (Math.random() * 2 - 1);
        const newPrice = Math.max(0.01, currentPrice + change);

        const update: PriceUpdate = {
            symbol,
            price: parseFloat(newPrice.toFixed(2)),
            change: parseFloat((newPrice - basePrice).toFixed(2)),
            changePercent: parseFloat((((newPrice - basePrice) / basePrice) * 100).toFixed(2)),
            volume: Math.floor(Math.random() * 10000) + 1000,
            timestamp: Date.now(),
            bid: parseFloat((newPrice - 0.01).toFixed(2)),
            ask: parseFloat((newPrice + 0.01).toFixed(2)),
        };

        store.updatePrice(update);
    }, 500); // Update every 500ms

    return () => clearInterval(interval);
}

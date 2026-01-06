/**
 * Unified Broker API Interface
 * Abstract interface for all broker integrations (Dhan, Alpaca, CCXT)
 */

export interface Quote {
    symbol: string;
    price: number;
    bid: number;
    ask: number;
    bidSize: number;
    askSize: number;
    volume: number;
    change: number;
    changePercent: number;
    high: number;
    low: number;
    open: number;
    previousClose: number;
    timestamp: number;
}

export interface OrderRequest {
    symbol: string;
    side: 'buy' | 'sell';
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    quantity: number;
    price?: number;
    stopPrice?: number;
    timeInForce?: 'day' | 'gtc' | 'ioc' | 'fok';
}

export interface OrderResponse {
    orderId: string;
    symbol: string;
    side: 'buy' | 'sell';
    type: string;
    status: 'pending' | 'open' | 'filled' | 'partial' | 'cancelled' | 'rejected';
    quantity: number;
    filledQuantity: number;
    price: number | null;
    filledPrice: number | null;
    createdAt: number;
    updatedAt: number;
}

export interface Position {
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    side: 'long' | 'short';
}

export interface AccountInfo {
    balance: number;
    buyingPower: number;
    equity: number;
    marginUsed: number;
    marginAvailable: number;
    currency: string;
}

export interface BrokerAPI {
    name: string;
    market: 'india' | 'us' | 'crypto';

    // Authentication
    isAuthenticated(): boolean;
    authenticate(credentials: Record<string, string>): Promise<boolean>;
    disconnect(): Promise<void>;

    // Market Data
    getQuote(symbol: string): Promise<Quote>;
    getQuotes(symbols: string[]): Promise<Quote[]>;

    // Trading
    placeOrder(order: OrderRequest): Promise<OrderResponse>;
    cancelOrder(orderId: string): Promise<boolean>;
    getOrder(orderId: string): Promise<OrderResponse>;
    getOpenOrders(): Promise<OrderResponse[]>;
    getOrderHistory(limit?: number): Promise<OrderResponse[]>;

    // Portfolio
    getPositions(): Promise<Position[]>;
    getAccountInfo(): Promise<AccountInfo>;
}

// Simulated delay for mock responses
const mockDelay = (min = 100, max = 500) =>
    new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min)));

/**
 * Mock Broker Implementation
 * Used for paper trading and development
 */
export class MockBroker implements BrokerAPI {
    name = 'MockBroker';
    market: 'india' | 'us' | 'crypto' = 'us';

    private authenticated = false;
    private orders: OrderResponse[] = [];
    private positions: Position[] = [];
    private balance = 100000;

    constructor(market: 'india' | 'us' | 'crypto' = 'us') {
        this.market = market;
        this.name = `Mock${market.toUpperCase()}Broker`;
    }

    isAuthenticated(): boolean {
        return this.authenticated;
    }

    async authenticate(): Promise<boolean> {
        await mockDelay();
        this.authenticated = true;
        return true;
    }

    async disconnect(): Promise<void> {
        await mockDelay(50, 100);
        this.authenticated = false;
    }

    async getQuote(symbol: string): Promise<Quote> {
        await mockDelay(50, 150);

        const basePrice = this.getBasePrice(symbol);
        const change = basePrice * (Math.random() * 0.02 - 0.01);

        return {
            symbol,
            price: basePrice + change,
            bid: basePrice + change - 0.01,
            ask: basePrice + change + 0.01,
            bidSize: Math.floor(Math.random() * 1000) + 100,
            askSize: Math.floor(Math.random() * 1000) + 100,
            volume: Math.floor(Math.random() * 1000000) + 100000,
            change,
            changePercent: (change / basePrice) * 100,
            high: basePrice * 1.02,
            low: basePrice * 0.98,
            open: basePrice,
            previousClose: basePrice,
            timestamp: Date.now(),
        };
    }

    async getQuotes(symbols: string[]): Promise<Quote[]> {
        return Promise.all(symbols.map(s => this.getQuote(s)));
    }

    async placeOrder(order: OrderRequest): Promise<OrderResponse> {
        await mockDelay(200, 400);

        const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const quote = await this.getQuote(order.symbol);
        const fillPrice = order.type === 'market' ? quote.price : (order.price || quote.price);

        const response: OrderResponse = {
            orderId,
            symbol: order.symbol,
            side: order.side,
            type: order.type,
            status: 'filled', // Mock always fills immediately
            quantity: order.quantity,
            filledQuantity: order.quantity,
            price: order.price || null,
            filledPrice: fillPrice,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        this.orders.unshift(response);

        // Update position
        this.updatePosition(order.symbol, order.side, order.quantity, fillPrice);

        return response;
    }

    async cancelOrder(orderId: string): Promise<boolean> {
        await mockDelay(100, 200);

        const order = this.orders.find(o => o.orderId === orderId);
        if (order && order.status === 'open') {
            order.status = 'cancelled';
            order.updatedAt = Date.now();
            return true;
        }
        return false;
    }

    async getOrder(orderId: string): Promise<OrderResponse> {
        await mockDelay(50, 100);

        const order = this.orders.find(o => o.orderId === orderId);
        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }
        return order;
    }

    async getOpenOrders(): Promise<OrderResponse[]> {
        await mockDelay(50, 100);
        return this.orders.filter(o => o.status === 'open' || o.status === 'pending');
    }

    async getOrderHistory(limit = 50): Promise<OrderResponse[]> {
        await mockDelay(100, 200);
        return this.orders.slice(0, limit);
    }

    async getPositions(): Promise<Position[]> {
        await mockDelay(100, 200);
        return this.positions;
    }

    async getAccountInfo(): Promise<AccountInfo> {
        await mockDelay(50, 100);

        const equity = this.balance + this.positions.reduce((sum, p) => sum + p.marketValue, 0);

        return {
            balance: this.balance,
            buyingPower: this.balance * 2, // 2x margin
            equity,
            marginUsed: equity - this.balance,
            marginAvailable: this.balance,
            currency: this.market === 'india' ? 'INR' : 'USD',
        };
    }

    private getBasePrice(symbol: string): number {
        // Mock base prices
        const prices: Record<string, number> = {
            'RELIANCE': 2450,
            'TCS': 3890,
            'INFY': 1650,
            'AAPL': 178.50,
            'GOOGL': 141.20,
            'TSLA': 248.30,
            'BTCUSDT': 43500,
            'ETHUSDT': 2280,
        };
        return prices[symbol] || 100;
    }

    private updatePosition(symbol: string, side: 'buy' | 'sell', quantity: number, price: number): void {
        const existingIndex = this.positions.findIndex(p => p.symbol === symbol);

        if (existingIndex >= 0) {
            const existing = this.positions[existingIndex];
            const multiplier = side === 'buy' ? 1 : -1;
            const newQuantity = existing.quantity + (quantity * multiplier);

            if (Math.abs(newQuantity) < 0.0001) {
                // Position closed
                this.positions.splice(existingIndex, 1);
                this.balance += existing.marketValue;
            } else {
                existing.quantity = Math.abs(newQuantity);
                existing.side = newQuantity > 0 ? 'long' : 'short';
                existing.averagePrice = (existing.averagePrice * existing.quantity + price * quantity) / (existing.quantity + quantity);
                existing.currentPrice = price;
                existing.marketValue = existing.quantity * existing.currentPrice;
                existing.unrealizedPnL = (existing.currentPrice - existing.averagePrice) * existing.quantity;
                existing.unrealizedPnLPercent = (existing.unrealizedPnL / (existing.averagePrice * existing.quantity)) * 100;
            }
        } else if (side === 'buy') {
            // New position
            this.positions.push({
                symbol,
                quantity,
                averagePrice: price,
                currentPrice: price,
                marketValue: quantity * price,
                unrealizedPnL: 0,
                unrealizedPnLPercent: 0,
                side: 'long',
            });
            this.balance -= quantity * price;
        }
    }
}

// Singleton instances for each market
export const mockBrokers = {
    india: new MockBroker('india'),
    us: new MockBroker('us'),
    crypto: new MockBroker('crypto'),
};

// Helper to get broker by market
export function getBroker(market: 'india' | 'us' | 'crypto'): BrokerAPI {
    return mockBrokers[market];
}

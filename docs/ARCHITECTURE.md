# GlobalTrade Hub - Architecture Documentation

## Overview

GlobalTrade Hub is a unified trading platform built with modern web technologies, designed for high performance and maintainability. This document describes the system architecture, design decisions, and component interactions.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Technology Stack](#technology-stack)
3. [Frontend Architecture](#frontend-architecture)
4. [State Management](#state-management)
5. [Component Architecture](#component-architecture)
6. [Data Flow](#data-flow)
7. [Real-Time Updates](#real-time-updates)
8. [API Integration Strategy](#api-integration-strategy)
9. [Security Considerations](#security-considerations)
10. [Performance Optimizations](#performance-optimizations)
11. [Future Backend Architecture](#future-backend-architecture)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Next.js Frontend                          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │   │
│  │  │Dashboard │ │ Markets  │ │ Trading  │ │Risk Manager  │   │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │   │
│  │                                                              │   │
│  │  ┌────────────────────────────────────────────────────┐    │   │
│  │  │              Zustand State Store                    │    │   │
│  │  │  (Positions, Orders, Watchlist, Settings)          │    │   │
│  │  └────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DATA SIMULATION LAYER                           │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐  │
│  │  Mock Assets  │  │  Price Sim.   │  │  Order Book Gen.     │  │
│  │  (9 symbols)  │  │  (intervals)  │  │  (bid/ask levels)    │  │
│  └───────────────┘  └───────────────┘  └───────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                        (Future Integration)
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BROKER INTEGRATION LAYER                        │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                    │
│  │   Dhan   │     │  Alpaca  │     │ Binance  │                    │
│  │ (India)  │     │  (US)    │     │ (Crypto) │                    │
│  └──────────┘     └──────────┘     └──────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| **Next.js** | React framework with App Router | 14.x |
| **TypeScript** | Type safety and developer experience | 5.x |
| **Tailwind CSS** | Utility-first styling | 3.x |
| **Zustand** | Lightweight state management | 4.x |
| **Framer Motion** | Animations and transitions | 10.x |
| **Lightweight Charts** | TradingView charting library | 5.x |
| **Lucide React** | Icon library | Latest |

### Future Backend (Planned)

| Technology | Purpose |
|------------|---------|
| **Go** | Order matching engine, WebSocket handling |
| **Python** | Data analytics, Celery workers |
| **PostgreSQL** | User data, ledgers, transactions |
| **TimescaleDB** | Time-series market data (OHLCV) |
| **Redis** | Caching LTP, session management |

---

## Frontend Architecture

### App Router Structure

The application uses Next.js 14 App Router for file-based routing:

```
src/app/
├── layout.tsx          # Root layout (Sidebar, TopBar)
├── page.tsx            # Dashboard (/)
├── globals.css         # Global styles and CSS variables
│
├── markets/
│   └── page.tsx        # Markets browser (/markets)
│
├── portfolio/
│   └── page.tsx        # Portfolio (/portfolio)
│
├── orders/
│   └── page.tsx        # Order history (/orders)
│
├── risk/
│   └── page.tsx        # Risk Manager (/risk)
│
├── settings/
│   └── page.tsx        # Settings (/settings)
│
└── trade/
    └── [symbol]/
        └── page.tsx    # Dynamic trading page (/trade/BTCUSDT)
```

### Layout System

```
┌─────────────────────────────────────────────────────┐
│                      TopBar                          │
│  [Search] [Paper Trading] [Balance] [Theme] [User]  │
├─────────┬───────────────────────────────────────────┤
│         │                                           │
│         │                                           │
│ Sidebar │              Main Content                 │
│         │              (Page Component)             │
│         │                                           │
│         │                                           │
└─────────┴───────────────────────────────────────────┘
```

---

## State Management

### Zustand Store Architecture

```typescript
// src/stores/tradingStore.ts

interface TradingState {
  // Paper Trading
  isPaperTrading: boolean;
  paperBalance: number;
  
  // Portfolio Data
  positions: Position[];
  orders: Order[];
  
  // Risk Settings
  riskSettings: RiskSettings;
  
  // UI State
  selectedSymbol: string | null;
  watchlist: string[];
  
  // Actions
  togglePaperTrading: () => void;
  placeOrder: (order: Order) => void;
  updateRiskSettings: (settings: Partial<RiskSettings>) => void;
  // ... more actions
}
```

### State Persistence

```typescript
create<TradingState>()(
  persist(
    (set, get) => ({ /* ... */ }),
    {
      name: 'globaltrade-storage',
      partialize: (state) => ({
        isPaperTrading: state.isPaperTrading,
        watchlist: state.watchlist,
        riskSettings: state.riskSettings,
      }),
    }
  )
);
```

---

## Component Architecture

### Component Categories

```
components/
├── layout/             # Structural components
│   ├── Sidebar.tsx     # Navigation sidebar
│   ├── TopBar.tsx      # Top navigation bar
│   └── index.ts        # Barrel exports
│
├── dashboard/          # Dashboard widgets
│   ├── PortfolioSummary.tsx
│   ├── Watchlist.tsx
│   ├── PositionsSummary.tsx
│   ├── RecentOrders.tsx
│   └── index.ts
│
└── trading/            # Trading interface
    ├── CandlestickChart.tsx
    ├── OrderPanel.tsx
    ├── OrderBook.tsx
    └── index.ts
```

### Component Design Principles

1. **Single Responsibility**: Each component handles one concern
2. **Composition**: Build complex UIs from simple components
3. **Prop Drilling Minimized**: Use Zustand for cross-cutting state
4. **Barrel Exports**: Clean imports via index.ts files

---

## Data Flow

### Unidirectional Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │────▶│   Action    │────▶│   Store     │
│   Action    │     │   Handler   │     │   Update    │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   UI        │◀────│   React     │◀────│   Zustand   │
│   Render    │     │   Re-render │     │   State     │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Order Placement Flow

```
1. User fills OrderPanel form
2. User clicks "Buy/Sell" button
3. OrderPanel calls store.placeOrder(orderData)
4. Store validates order:
   - Check kill switch status
   - Validate quantity > 0
   - Apply paper trading logic
5. Store updates orders array
6. UI re-renders with new order
7. Success toast displayed
```

---

## Real-Time Updates

### Price Simulation (MVP)

```typescript
// Mock real-time price updates
useEffect(() => {
  const interval = setInterval(() => {
    // Random price walk
    const volatility = 0.002 + Math.random() * 0.008;
    const direction = Math.random() > 0.48 ? 1 : -1;
    const newPrice = currentPrice * (1 + direction * volatility);
    
    updatePrice(newPrice);
  }, 2000);
  
  return () => clearInterval(interval);
}, []);
```

### Future WebSocket Architecture

```
┌────────────────┐     ┌────────────────┐     ┌────────────────┐
│    Browser     │◀───▶│   API Gateway  │◀───▶│   Broker WS    │
│   WebSocket    │     │   (Go Server)  │     │   Connections  │
└────────────────┘     └────────────────┘     └────────────────┘
                              │
                              ▼
                       ┌────────────────┐
                       │     Redis      │
                       │  (Pub/Sub)     │
                       └────────────────┘
```

---

## API Integration Strategy

### Broker Abstraction Layer

```typescript
// Conceptual interface for broker adapters
interface BrokerAdapter {
  name: string;
  market: 'india' | 'us' | 'crypto';
  
  // Authentication
  authenticate(credentials: Credentials): Promise<Session>;
  
  // Market Data
  getQuote(symbol: string): Promise<Quote>;
  subscribeToTicks(symbols: string[]): Observable<Tick>;
  
  // Trading
  placeOrder(order: OrderRequest): Promise<OrderResponse>;
  cancelOrder(orderId: string): Promise<void>;
  getPositions(): Promise<Position[]>;
}

// Implementations
class DhanAdapter implements BrokerAdapter { /* India */ }
class AlpacaAdapter implements BrokerAdapter { /* US */ }
class BinanceAdapter implements BrokerAdapter { /* Crypto */ }
```

### Smart Order Routing

```typescript
function routeOrder(order: OrderRequest): BrokerAdapter {
  const symbol = order.symbol;
  
  if (isIndianStock(symbol)) return dhanAdapter;
  if (isUSStock(symbol)) return alpacaAdapter;
  if (isCrypto(symbol)) return binanceAdapter;
  
  throw new Error(`Unknown market for symbol: ${symbol}`);
}
```

---

## Security Considerations

### Current (MVP)

- No real authentication (mock users)
- No real financial transactions
- All data stored locally in browser

### Production Requirements

| Area | Implementation |
|------|----------------|
| **Authentication** | OAuth2 + JWT tokens |
| **2FA** | TOTP (Google Authenticator) |
| **Data Encryption** | AES-256 at rest, TLS 1.3 in transit |
| **API Security** | Rate limiting, IP whitelisting |
| **Session Management** | Secure cookies, token refresh |
| **Input Validation** | Server-side validation, sanitization |

---

## Performance Optimizations

### Implemented

1. **Component Code Splitting**: Dynamic imports for heavy components
2. **React Memoization**: useMemo/useCallback for expensive operations
3. **Optimistic Updates**: Immediate UI feedback on actions
4. **CSS Variables**: Efficient theming without re-renders
5. **Lightweight Charts**: GPU-accelerated canvas rendering

### Future Optimizations

1. **Virtual Lists**: For large order books and watchlists
2. **Web Workers**: Off-thread price calculations
3. **Service Workers**: Offline support and caching
4. **CDN**: Static asset distribution

---

## Future Backend Architecture

### Microservices Design

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway (Go)                          │
│                    - Authentication                              │
│                    - Rate Limiting                               │
│                    - Request Routing                             │
└──────────────┬────────────────────────────────────┬─────────────┘
               │                                    │
       ┌───────▼───────┐                   ┌───────▼───────┐
       │  Order Service│                   │  Market Data  │
       │     (Go)      │                   │    Service    │
       │               │                   │    (Go)       │
       └───────┬───────┘                   └───────┬───────┘
               │                                   │
       ┌───────▼───────┐                   ┌───────▼───────┐
       │   PostgreSQL  │                   │  TimescaleDB  │
       │  (Orders/     │                   │  (OHLCV Data) │
       │   Users)      │                   │               │
       └───────────────┘                   └───────────────┘
               
       ┌───────────────┐
       │ Analytics Svc │
       │   (Python)    │
       │   - Celery    │
       │   - ML Models │
       └───────────────┘
```

### Data Models

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10) NOT NULL,
  type VARCHAR(20) NOT NULL,
  quantity DECIMAL NOT NULL,
  price DECIMAL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Market Data (TimescaleDB)
CREATE TABLE candles (
  time TIMESTAMPTZ NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  open DECIMAL,
  high DECIMAL,
  low DECIMAL,
  close DECIMAL,
  volume DECIMAL
);
SELECT create_hypertable('candles', 'time');
```

---

## Architecture Decision Records (ADRs)

### ADR-001: Next.js App Router

**Decision**: Use Next.js 14 with App Router instead of Pages Router

**Rationale**:
- Better React Server Components support
- Improved layouts and nested routing
- Future-proof for React 19
- Better performance with streaming

### ADR-002: Zustand over Redux

**Decision**: Use Zustand for state management

**Rationale**:
- Smaller bundle size (~3KB vs ~20KB)
- Simpler API with less boilerplate
- Built-in persistence middleware
- Sufficient for MVP scope

### ADR-003: TradingView Lightweight Charts

**Decision**: Use Lightweight Charts over custom canvas

**Rationale**:
- Industry-standard charting
- GPU-accelerated rendering
- Rich feature set (crosshair, timeframes)
- Well-documented API

---

## Conclusion

This architecture provides a solid foundation for the GlobalTrade Hub MVP while being extensible for future production features. The modular component structure and clear separation of concerns enable rapid development and easy testing.

For implementation details, see [GETTING_STARTED.md](./GETTING_STARTED.md).
For testing setup, see [E2E_TESTING.md](./E2E_TESTING.md).

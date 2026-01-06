# GlobalTrade Hub 🚀

> **One Screen, All Markets** - A unified trading platform for Indian Equities, US Stocks, and Crypto/Commodities.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![TradingView](https://img.shields.io/badge/TradingView-Charts-orange)](https://www.tradingview.com/lightweight-charts/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 🎯 Overview

GlobalTrade Hub consolidates execution, charting, and risk management across multiple markets into a single, low-latency dashboard. Stop toggling between 3-4 trading apps – trade everything from one screen.

### Key Features

- **📊 Unified Watchlist** - Track TATASTEEL (NSE), TESLA (NASDAQ), and BTCUSDT (Binance) in one list
- **📈 TradingView Charts** - Professional candlestick charts with multiple timeframes
- **⚡ One-Click Trading** - Bypass confirmation screens for scalping
- **🛡️ Kill Switch** - Automatic daily loss limits to protect capital
- **📱 Paper Trading** - Test strategies with $100,000 virtual balance
- **🎨 Dark Mode** - Professional dark theme optimized for trading

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/GlobalTrade-Hub.git
cd GlobalTrade-Hub/app

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

---

## 📸 Screenshots

### Dashboard
- Portfolio summary with real-time P&L
- Unified watchlist across all markets
- Price flash animations on updates

### Trading Interface
- TradingView candlestick charts
- Order panel with multiple order types
- Live order book depth

### Risk Manager
- Kill switch with daily loss limits
- Position sizing calculator
- Risk settings configuration

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                 Next.js Frontend                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────┐ │
│  │Dashboard│ │ Trading │ │ Markets │ │ Risk  │ │
│  └────┬────┘ └────┬────┘ └────┬────┘ └───┬───┘ │
│       └───────────┴───────────┴──────────┘     │
│                      │                          │
│              ┌───────┴───────┐                 │
│              │ Zustand Store │                 │
│              └───────────────┘                 │
└─────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **State** | Zustand |
| **Charts** | TradingView Lightweight Charts |
| **Animations** | Framer Motion |
| **Icons** | Lucide React |

---

## 📁 Project Structure

```
GlobalTrade-Hub/
├── app/                    # Next.js application
│   ├── src/
│   │   ├── app/            # Pages (App Router)
│   │   ├── components/     # React components
│   │   ├── lib/            # Utilities & constants
│   │   └── stores/         # Zustand stores
│   └── package.json
│
├── docs/                   # Documentation
│   ├── GETTING_STARTED.md  # Setup guide
│   ├── ARCHITECTURE.md     # System design
│   └── E2E_TESTING.md      # Testing guide
│
└── README.md               # This file
```

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/GETTING_STARTED.md) | Development setup and project structure |
| [Architecture](docs/ARCHITECTURE.md) | System design and technical decisions |
| [E2E Testing](docs/E2E_TESTING.md) | Testing strategy and test cases |

---

## 🧪 Testing

```bash
# Run unit tests
npm run test:unit

# Run E2E tests (requires dev server)
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run all tests
npm run test
```

---

## 🛣️ Roadmap

### Phase 1: MVP ✅
- [x] Dashboard with portfolio overview
- [x] Unified watchlist
- [x] TradingView charts
- [x] Order placement (Market, Limit, Stop)
- [x] Risk Manager with Kill Switch
- [x] Paper trading mode

### Phase 2: Intelligence 🔄
- [ ] Authentication (Login/Signup/2FA)
- [ ] Automated chart patterns
- [ ] News feed integration
- [ ] Mobile responsive design

### Phase 3: Automation
- [ ] Broker API integrations (Dhan, Alpaca, Binance)
- [ ] Real-time WebSocket feeds
- [ ] Copy trading
- [ ] Algo marketplace

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## ⚠️ Disclaimer

> **This is a technology platform, not a registered investment advisor.**
> 
> Trading involves substantial risk of loss. Past performance is not indicative of future results. Paper trading results may differ from live trading.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [TradingView Lightweight Charts](https://www.tradingview.com/lightweight-charts/)
- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Zustand](https://zustand-demo.pmnd.rs/)

---

<p align="center">
  Made with ❤️ for traders, by traders
</p>

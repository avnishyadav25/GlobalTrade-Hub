# GlobalTrade Hub - Getting Started Guide

Welcome to **GlobalTrade Hub** - a unified trading platform for Indian Equities, US Stocks, and Crypto/Commodities. This guide will help you set up the development environment and understand the project structure.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Project Structure](#project-structure)
4. [Development Workflow](#development-workflow)
5. [Configuration](#configuration)
6. [Available Scripts](#available-scripts)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed:

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Node.js | >= 18.x | `node --version` |
| npm | >= 9.x | `npm --version` |
| Git | >= 2.x | `git --version` |

### Recommended Tools

- **VS Code** with extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - TypeScript and JavaScript Language Features

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/GlobalTrade-Hub.git
cd GlobalTrade-Hub/app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

### 4. Open the Application

Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

You should see the GlobalTrade Hub dashboard with:
- Portfolio summary cards
- Watchlist with real-time price updates
- Navigation sidebar

---

## Project Structure

```
GlobalTrade-Hub/
├── app/                          # Next.js application
│   ├── src/
│   │   ├── app/                  # App Router pages
│   │   │   ├── page.tsx          # Dashboard (/)
│   │   │   ├── layout.tsx        # Root layout with sidebar
│   │   │   ├── markets/          # Markets browser
│   │   │   ├── portfolio/        # Portfolio page
│   │   │   ├── orders/           # Order history
│   │   │   ├── risk/             # Risk Manager
│   │   │   ├── settings/         # Settings page
│   │   │   └── trade/[symbol]/   # Dynamic trading page
│   │   │
│   │   ├── components/           # React components
│   │   │   ├── layout/           # Sidebar, TopBar
│   │   │   ├── dashboard/        # Dashboard widgets
│   │   │   └── trading/          # Trading components
│   │   │
│   │   ├── lib/                  # Utilities
│   │   │   ├── constants.ts      # Application constants
│   │   │   └── mockData.ts       # Mock data generators
│   │   │
│   │   └── stores/               # State management
│   │       └── tradingStore.ts   # Zustand store
│   │
│   ├── public/                   # Static assets
│   ├── package.json              # Dependencies
│   ├── tailwind.config.js        # Tailwind configuration
│   └── tsconfig.json             # TypeScript config
│
├── docs/                         # Documentation
│   ├── GETTING_STARTED.md        # This file
│   ├── ARCHITECTURE.md           # System architecture
│   └── E2E_TESTING.md            # Testing guide
│
└── README.md                     # Project overview
```

---

## Development Workflow

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Start the dev server**
   ```bash
   npm run dev
   ```

3. **Make your changes** - The app will hot-reload automatically

4. **Run linting**
   ```bash
   npm run lint
   ```

5. **Build to verify**
   ```bash
   npm run build
   ```

### Adding New Pages

1. Create a new directory in `src/app/`
2. Add a `page.tsx` file with your component
3. The route will automatically be available at the folder name

```typescript
// src/app/new-feature/page.tsx
export default function NewFeaturePage() {
  return <div>New Feature Content</div>;
}
// Available at: http://localhost:3000/new-feature
```

### Adding New Components

1. Create component in appropriate folder under `src/components/`
2. Export from the folder's `index.ts`
3. Import using the alias: `import { Component } from '@/components/folder'`

---

## Configuration

### Environment Variables

Create a `.env.local` file in the `app/` directory:

```env
# API Configuration (for future use)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Feature Flags
NEXT_PUBLIC_ENABLE_PAPER_TRADING=true
NEXT_PUBLIC_ENABLE_REAL_TRADING=false

# Analytics (optional)
NEXT_PUBLIC_GA_ID=
```

### Tailwind CSS

Custom theme colors are defined in `src/app/globals.css`:

```css
:root {
  --profit: #22c55e;      /* Green for gains */
  --loss: #ef4444;        /* Red for losses */
  --primary: #6366f1;     /* Indigo accent */
  --background: #0a0e17;  /* Dark background */
}
```

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint checks |
| `npm run type-check` | Run TypeScript type checking |

---

## Troubleshooting

### Common Issues

#### Port 3000 Already in Use

```bash
# Find the process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>
```

#### Module Not Found Errors

```bash
# Clear next cache and reinstall
rm -rf .next node_modules
npm install
```

#### TypeScript Errors

```bash
# Regenerate types
npm run type-check
```

#### Chart Not Rendering

The TradingView Lightweight Charts library requires a container with explicit dimensions. Ensure the parent element has a defined height.

---

## Next Steps

1. **Explore the Dashboard**: Navigate through different pages using the sidebar
2. **Try Paper Trading**: Toggle paper trading mode and place mock orders
3. **Customize Watchlist**: Add/remove assets from your watchlist
4. **Test Risk Manager**: Configure kill switch and position sizing

For architecture details, see [ARCHITECTURE.md](./ARCHITECTURE.md).
For testing setup, see [E2E_TESTING.md](./E2E_TESTING.md).

---

## Getting Help

- **Issues**: Create an issue in the GitHub repository
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check the `/docs` folder for detailed guides

Happy Trading! 🚀

# GlobalTrade Hub - End-to-End Testing Guide

## Overview

This document provides comprehensive guidance for testing the GlobalTrade Hub application, including unit tests, integration tests, and end-to-end (E2E) tests using Playwright.

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Setup](#test-setup)
3. [Unit Testing](#unit-testing)
4. [Component Testing](#component-testing)
5. [E2E Testing with Playwright](#e2e-testing-with-playwright)
6. [Test Scenarios](#test-scenarios)
7. [Manual Testing Checklist](#manual-testing-checklist)
8. [CI/CD Integration](#cicd-integration)
9. [Performance Testing](#performance-testing)

---

## Testing Philosophy

### Testing Pyramid

```
        ┌─────────────┐
        │     E2E     │  ← Few, slow, high confidence
        │   Tests     │
        ├─────────────┤
        │ Integration │  ← Some, medium speed
        │   Tests     │
        ├─────────────┤
        │    Unit     │  ← Many, fast, isolated
        │   Tests     │
        └─────────────┘
```

### Key Principles

1. **Test Behavior, Not Implementation**: Focus on what the component does, not how
2. **User-Centric**: Write tests that simulate real user interactions
3. **Isolated**: Each test should be independent and repeatable
4. **Fast Feedback**: Optimize test speed for developer productivity

---

## Test Setup

### Install Testing Dependencies

```bash
cd app

# Install Playwright for E2E testing
npm install -D @playwright/test

# Install testing utilities
npm install -D @testing-library/react @testing-library/jest-dom vitest

# Install Playwright browsers
npx playwright install
```

### Configure Playwright

Create `playwright.config.ts` in the `app/` directory:

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### Configure Vitest for Unit Tests

Create `vitest.config.ts`:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/unit/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### Test Setup File

Create `tests/setup.ts`:

```typescript
// tests/setup.ts
import '@testing-library/jest-dom';
import { beforeAll, afterEach, afterAll } from 'vitest';

// Mock matchMedia for components using media queries
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
});

afterEach(() => {
  // Clean up after each test
});
```

---

## Unit Testing

### Testing the Trading Store

```typescript
// tests/unit/stores/tradingStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useTradingStore } from '@/stores/tradingStore';

describe('Trading Store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useTradingStore.setState({
      isPaperTrading: true,
      paperBalance: 100000,
      watchlist: ['BTCUSDT'],
      orders: [],
    });
  });

  describe('Paper Trading Toggle', () => {
    it('should toggle paper trading mode', () => {
      const store = useTradingStore.getState();
      expect(store.isPaperTrading).toBe(true);
      
      store.togglePaperTrading();
      
      expect(useTradingStore.getState().isPaperTrading).toBe(false);
    });
  });

  describe('Watchlist Management', () => {
    it('should add a symbol to watchlist', () => {
      const store = useTradingStore.getState();
      store.addToWatchlist('AAPL');
      
      expect(useTradingStore.getState().watchlist).toContain('AAPL');
    });

    it('should not add duplicate symbols', () => {
      const store = useTradingStore.getState();
      store.addToWatchlist('BTCUSDT');
      
      expect(useTradingStore.getState().watchlist.filter(s => s === 'BTCUSDT')).toHaveLength(1);
    });

    it('should remove a symbol from watchlist', () => {
      const store = useTradingStore.getState();
      store.removeFromWatchlist('BTCUSDT');
      
      expect(useTradingStore.getState().watchlist).not.toContain('BTCUSDT');
    });
  });

  describe('Order Placement', () => {
    it('should place a market order', () => {
      const store = useTradingStore.getState();
      store.placeOrder({
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
      });
      
      const orders = useTradingStore.getState().orders;
      expect(orders).toHaveLength(1);
      expect(orders[0].symbol).toBe('BTCUSDT');
      expect(orders[0].status).toBe('filled');
    });

    it('should place a limit order as pending', () => {
      const store = useTradingStore.getState();
      store.placeOrder({
        symbol: 'AAPL',
        side: 'buy',
        type: 'limit',
        quantity: 10,
        price: 180,
      });
      
      const orders = useTradingStore.getState().orders;
      expect(orders[0].status).toBe('pending');
    });

    it('should block buy orders when kill switch is triggered', () => {
      const store = useTradingStore.getState();
      store.updateRiskSettings({ killSwitchTriggered: true });
      
      const ordersBefore = useTradingStore.getState().orders.length;
      
      store.placeOrder({
        symbol: 'BTCUSDT',
        side: 'buy',
        type: 'market',
        quantity: 0.1,
      });
      
      expect(useTradingStore.getState().orders.length).toBe(ordersBefore);
    });
  });
});
```

### Testing Utilities

```typescript
// tests/unit/lib/mockData.test.ts
import { describe, it, expect } from 'vitest';
import { generateCandleData, generateOrderBook, WATCHLIST_ASSETS } from '@/lib/mockData';

describe('Mock Data Generators', () => {
  describe('generateCandleData', () => {
    it('should generate the specified number of candles', () => {
      const candles = generateCandleData('BTCUSDT', 50);
      expect(candles).toHaveLength(51); // 50 historical + 1 current
    });

    it('should generate valid OHLC data', () => {
      const candles = generateCandleData('BTCUSDT', 10);
      
      candles.forEach(candle => {
        expect(candle.high).toBeGreaterThanOrEqual(candle.open);
        expect(candle.high).toBeGreaterThanOrEqual(candle.close);
        expect(candle.low).toBeLessThanOrEqual(candle.open);
        expect(candle.low).toBeLessThanOrEqual(candle.close);
      });
    });

    it('should use correct base price for symbol', () => {
      const btcCandles = generateCandleData('BTCUSDT', 5);
      const btcAsset = WATCHLIST_ASSETS.find(a => a.symbol === 'BTCUSDT');
      
      // Last candle should be close to base price
      const lastCandle = btcCandles[btcCandles.length - 1];
      expect(lastCandle.close).toBeGreaterThan(btcAsset!.price * 0.9);
      expect(lastCandle.close).toBeLessThan(btcAsset!.price * 1.1);
    });
  });

  describe('generateOrderBook', () => {
    it('should generate correct number of levels', () => {
      const { bids, asks } = generateOrderBook(100, 10);
      
      expect(bids).toHaveLength(10);
      expect(asks).toHaveLength(10);
    });

    it('should have bids below current price', () => {
      const { bids } = generateOrderBook(100, 5);
      
      bids.forEach(bid => {
        expect(bid.price).toBeLessThan(100);
      });
    });

    it('should have asks above current price', () => {
      const { asks } = generateOrderBook(100, 5);
      
      asks.forEach(ask => {
        expect(ask.price).toBeGreaterThan(100);
      });
    });
  });
});
```

---

## E2E Testing with Playwright

### Test Structure

```
tests/
├── e2e/
│   ├── dashboard.spec.ts
│   ├── trading.spec.ts
│   ├── markets.spec.ts
│   ├── risk-manager.spec.ts
│   └── settings.spec.ts
├── unit/
│   ├── stores/
│   └── lib/
└── setup.ts
```

### Dashboard Tests

```typescript
// tests/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display portfolio summary cards', async ({ page }) => {
    await expect(page.getByText('Total Net Worth')).toBeVisible();
    await expect(page.getByText("Today's P&L")).toBeVisible();
    await expect(page.getByText('Open Positions')).toBeVisible();
    await expect(page.getByText('Day Volume')).toBeVisible();
  });

  test('should display watchlist', async ({ page }) => {
    await expect(page.getByText('Watchlist')).toBeVisible();
    
    // Check for at least one asset
    await expect(page.getByText('BTCUSDT')).toBeVisible();
  });

  test('should show paper trading banner when in paper mode', async ({ page }) => {
    await expect(page.getByText('Paper Trading Mode Active')).toBeVisible();
    await expect(page.getByText('$100,000 Virtual Balance')).toBeVisible();
  });

  test('should toggle paper trading mode', async ({ page }) => {
    // Find and click the paper trading toggle
    const toggle = page.getByRole('button', { name: /Paper Trading/i });
    await toggle.click();
    
    // Should now show Live Trading
    await expect(page.getByText(/Live Trading/i)).toBeVisible();
  });

  test('should navigate to trade page from watchlist', async ({ page }) => {
    await page.getByText('BTCUSDT').click();
    
    await expect(page).toHaveURL(/\/trade\/BTCUSDT/);
    await expect(page.getByText('Bitcoin')).toBeVisible();
  });

  test('should display market alerts', async ({ page }) => {
    await expect(page.getByText('Market Alerts')).toBeVisible();
  });
});
```

### Trading Page Tests

```typescript
// tests/e2e/trading.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Trading Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/trade/BTCUSDT');
  });

  test('should display asset information', async ({ page }) => {
    await expect(page.getByText('BTCUSDT')).toBeVisible();
    await expect(page.getByText('Bitcoin')).toBeVisible();
    await expect(page.getByText('Binance')).toBeVisible();
  });

  test('should display candlestick chart', async ({ page }) => {
    // Wait for chart to render
    await page.waitForSelector('canvas', { timeout: 10000 });
    
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('should change timeframe', async ({ page }) => {
    // Wait for chart to load
    await page.waitForSelector('canvas');
    
    // Click 1H timeframe
    await page.getByRole('button', { name: '1H' }).click();
    
    // Verify button is selected
    const button = page.getByRole('button', { name: '1H' });
    await expect(button).toHaveCSS('background-color', /rgb\(99, 102, 241\)/);
  });

  test('should toggle between Buy and Sell', async ({ page }) => {
    const buyButton = page.getByRole('button', { name: /Buy \/ Long/i });
    const sellButton = page.getByRole('button', { name: /Sell \/ Short/i });
    
    // Initially Buy should be selected
    await expect(buyButton).toHaveCSS('background-color', /rgb\(34, 197, 94\)/);
    
    // Click Sell
    await sellButton.click();
    
    // Sell should now be selected
    await expect(sellButton).toHaveCSS('background-color', /rgb\(239, 68, 68\)/);
  });

  test('should show order types dropdown', async ({ page }) => {
    const orderTypeSelect = page.locator('select');
    await orderTypeSelect.click();
    
    await expect(page.getByRole('option', { name: 'Market Order' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Limit Order' })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Stop Loss' })).toBeVisible();
  });

  test('should calculate order value', async ({ page }) => {
    // Enter quantity
    await page.locator('input[placeholder="0"]').first().fill('1');
    
    // Order value should be calculated
    const orderValue = page.getByText('Order Value').locator('..').getByText('$');
    await expect(orderValue).toBeVisible();
  });

  test('should place a paper trade', async ({ page }) => {
    // Enter quantity
    await page.locator('input[placeholder="0"]').first().fill('0.1');
    
    // Click Buy button
    await page.getByRole('button', { name: /Buy BTCUSDT/i }).click();
    
    // Navigate to orders to verify
    await page.goto('/orders');
    
    // Should see the new order
    await expect(page.getByText('BTCUSDT')).toBeVisible();
  });

  test('should toggle one-click trading', async ({ page }) => {
    const toggle = page.locator('button').filter({ hasText: '' }).first();
    // One-click toggle exists
    await expect(page.getByText('One-Click')).toBeVisible();
  });

  test('should add/remove from watchlist', async ({ page }) => {
    const starButton = page.locator('button').filter({ has: page.locator('svg[class*="lucide-star"]') }).first();
    
    // Click to toggle
    await starButton.click();
    
    // Star state should change (filled vs outline)
    // Navigate to dashboard to verify
    await page.goto('/');
    
    // Watchlist should be updated
  });
});
```

### Risk Manager Tests

```typescript
// tests/e2e/risk-manager.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Risk Manager', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/risk');
  });

  test('should display kill switch', async ({ page }) => {
    await expect(page.getByText('Kill Switch')).toBeVisible();
    await expect(page.getByText('Max Daily Loss')).toBeVisible();
  });

  test('should toggle kill switch', async ({ page }) => {
    const toggleButton = page.getByRole('button', { name: /Enable|Disable/i }).first();
    
    await toggleButton.click();
    
    // Should toggle between Enable/Disable
  });

  test('should update risk settings', async ({ page }) => {
    // Find max daily loss input
    const maxLossInput = page.locator('input[placeholder="500"]');
    await maxLossInput.fill('1000');
    
    // Save
    await page.getByRole('button', { name: 'Save Settings' }).click();
    
    // Value should persist
    await expect(maxLossInput).toHaveValue('1000');
  });

  test('should calculate position size', async ({ page }) => {
    // Fill calculator inputs
    await page.locator('input[placeholder="100000"]').fill('50000');
    await page.locator('input[placeholder="1"]').first().fill('2');
    await page.locator('input[placeholder="100"]').fill('150');
    await page.locator('input[placeholder="95"]').fill('145');
    
    // Position size should be calculated
    await expect(page.getByText(/\d+ units/)).toBeVisible();
  });
});
```

### Markets Page Tests

```typescript
// tests/e2e/markets.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Markets Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/markets');
  });

  test('should display top gainers and losers', async ({ page }) => {
    await expect(page.getByText('Top Gainers')).toBeVisible();
    await expect(page.getByText('Top Losers')).toBeVisible();
  });

  test('should filter by market', async ({ page }) => {
    // Click Crypto filter
    await page.getByRole('button', { name: 'Crypto' }).click();
    
    // Should only show crypto assets
    await expect(page.getByText('BTCUSDT')).toBeVisible();
    await expect(page.getByText('Binance')).toBeVisible();
  });

  test('should search for assets', async ({ page }) => {
    await page.locator('input[placeholder="Search assets..."]').fill('tesla');
    
    // Should show Tesla
    await expect(page.getByText('TSLA')).toBeVisible();
    
    // Should not show unrelated assets
    await expect(page.getByText('BTCUSDT')).not.toBeVisible();
  });

  test('should sort by criteria', async ({ page }) => {
    const sortSelect = page.locator('select').first();
    await sortSelect.selectOption('volume');
    
    // Table should be sorted by volume
  });

  test('should navigate to trade page', async ({ page }) => {
    await page.getByText('AAPL').click();
    
    await expect(page).toHaveURL(/\/trade\/AAPL/);
  });
});
```

---

## Manual Testing Checklist

### Dashboard
- [ ] Portfolio cards display correct values
- [ ] Watchlist shows real-time price updates
- [ ] Price flash animations work (green/red)
- [ ] Paper trading banner visible
- [ ] Toggle paper trading mode works
- [ ] Click asset navigates to trade page
- [ ] Recent orders show correctly
- [ ] Market alerts display

### Trading Interface
- [ ] Chart loads and renders candles
- [ ] Timeframe buttons work (1m, 5m, 15m, 1H, 4H, 1D)
- [ ] Buy/Sell toggle works
- [ ] Order type dropdown works
- [ ] Limit price field shows for limit orders
- [ ] Quantity input works
- [ ] Quick quantity buttons (25%, 50%, etc.) work
- [ ] Order value calculates correctly
- [ ] Place order button works
- [ ] One-click trading toggle works
- [ ] Order book displays bid/ask levels
- [ ] Star button adds/removes from watchlist

### Risk Manager
- [ ] Kill switch toggle works
- [ ] Max daily loss setting saves
- [ ] Risk per trade setting saves
- [ ] Position calculator computes correctly
- [ ] Progress bar updates based on daily loss

### Settings
- [ ] Theme selection works (dark/light)
- [ ] Notification toggles work
- [ ] Currency selector works
- [ ] Broker connection status shows

### Cross-Browser
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

### Responsive Design
- [ ] Desktop (1920x1080)
- [ ] Laptop (1440x900)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x812)

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: app/package-lock.json
      
      - name: Install dependencies
        run: npm ci
        working-directory: ./app
      
      - name: Run unit tests
        run: npm run test:unit
        working-directory: ./app

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: app/package-lock.json
      
      - name: Install dependencies
        run: npm ci
        working-directory: ./app
      
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps
        working-directory: ./app
      
      - name: Run E2E tests
        run: npm run test:e2e
        working-directory: ./app
      
      - name: Upload test artifacts
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: app/playwright-report/
          retention-days: 7
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test": "npm run test:unit && npm run test:e2e"
  }
}
```

---

## Performance Testing

### Lighthouse CI

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse

on:
  push:
    branches: [main]

jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install and Build
        run: |
          cd app
          npm ci
          npm run build
      
      - name: Run Lighthouse
        uses: treosh/lighthouse-ci-action@v10
        with:
          configPath: './lighthouserc.json'
          uploadArtifacts: true
```

### Lighthouse Configuration

```json
// lighthouserc.json
{
  "ci": {
    "collect": {
      "startServerCommand": "cd app && npm start",
      "url": ["http://localhost:3000"]
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "first-contentful-paint": ["warn", {"maxNumericValue": 2000}],
        "interactive": ["warn", {"maxNumericValue": 5000}],
        "speed-index": ["warn", {"maxNumericValue": 3000}]
      }
    }
  }
}
```

---

## Best Practices

1. **Keep Tests Independent**: Each test should be able to run in isolation
2. **Use Data-Testid**: For complex selectors, add `data-testid` attributes
3. **Wait for Elements**: Use `await expect(locator).toBeVisible()` not arbitrary waits
4. **Clean Up State**: Reset state between tests
5. **Test User Flows**: Focus on complete user journeys, not just clicks
6. **Mock External APIs**: Use MSW or Playwright network interception
7. **Visual Regression**: Consider adding screenshot comparisons

---

## Running Tests

```bash
# Unit tests
npm run test:unit

# E2E tests (headless)
npm run test:e2e

# E2E tests (UI mode)
npm run test:e2e:ui

# All tests
npm run test

# Generate coverage report
npm run test:unit -- --coverage
```

For more details, see:
- [GETTING_STARTED.md](./GETTING_STARTED.md) - Development setup
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design

'use client';

import { useEffect, useRef, memo } from 'react';

interface TradingViewChartProps {
    symbol: string;
    exchange?: string;
    interval?: string;
    theme?: 'light' | 'dark';
    autosize?: boolean;
    height?: number;
    width?: string | number;
    allowSymbolChange?: boolean;
    showToolbar?: boolean;
    showDrawingTools?: boolean;
    showWatchlist?: boolean;
    showDetails?: boolean;
    showHotlist?: boolean;
    showCalendar?: boolean;
}

function TradingViewChartComponent({
    symbol,
    exchange = 'NSE',
    interval = 'D',
    theme = 'dark',
    autosize = true,
    height = 500,
    width = '100%',
    allowSymbolChange = true,
    showToolbar = true,
    showDrawingTools = true,
    showWatchlist = false,
    showDetails = true,
    showHotlist = false,
    showCalendar = false,
}: TradingViewChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const scriptRef = useRef<HTMLScriptElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Clear previous widget
        containerRef.current.innerHTML = '';

        // Create widget container
        const widgetContainer = document.createElement('div');
        widgetContainer.className = 'tradingview-widget-container';
        widgetContainer.style.height = '100%';
        widgetContainer.style.width = '100%';

        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'tradingview-widget-container__widget';
        widgetDiv.style.height = autosize ? '100%' : `${height}px`;
        widgetDiv.style.width = typeof width === 'number' ? `${width}px` : width;
        widgetContainer.appendChild(widgetDiv);

        containerRef.current.appendChild(widgetContainer);

        // Format symbol for TradingView
        const tvSymbol = formatSymbolForTV(symbol, exchange);

        // Create and load script
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
        script.type = 'text/javascript';
        script.async = true;
        script.innerHTML = JSON.stringify({
            autosize,
            height: autosize ? '100%' : height,
            width: typeof width === 'number' ? width : '100%',
            symbol: tvSymbol,
            interval,
            timezone: 'Asia/Kolkata',
            theme,
            style: '1', // Candlestick
            locale: 'en',
            allow_symbol_change: allowSymbolChange,
            calendar: showCalendar,
            hide_side_toolbar: !showDrawingTools,
            support_host: 'https://www.tradingview.com',
            details: showDetails,
            hotlist: showHotlist,
            watchlist: showWatchlist,
            hide_top_toolbar: !showToolbar,
        });

        widgetContainer.appendChild(script);
        scriptRef.current = script;

        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [symbol, exchange, interval, theme, autosize, height, width, allowSymbolChange, showToolbar, showDrawingTools, showWatchlist, showDetails, showHotlist, showCalendar]);

    return (
        <div
            ref={containerRef}
            className="tradingview-chart-container rounded-lg overflow-hidden"
            style={{
                height: autosize ? '100%' : height,
                minHeight: 400,
                background: 'var(--card)',
            }}
        />
    );
}

// Helper to format symbols for TradingView
function formatSymbolForTV(symbol: string, exchange: string): string {
    // Handle crypto
    if (symbol.includes('USDT') || symbol.includes('USD')) {
        if (symbol === 'BTCUSDT' || symbol === 'BTCUSD') return 'BINANCE:BTCUSDT';
        if (symbol === 'ETHUSDT' || symbol === 'ETHUSD') return 'BINANCE:ETHUSDT';
        if (symbol === 'SOLUSDT' || symbol === 'SOLUSD') return 'BINANCE:SOLUSDT';
        return `BINANCE:${symbol}`;
    }

    // Handle US stocks
    const usSymbols = ['AAPL', 'GOOGL', 'TSLA', 'MSFT', 'NVDA', 'AMZN', 'META'];
    if (usSymbols.includes(symbol) || exchange === 'NASDAQ' || exchange === 'NYSE') {
        return `NASDAQ:${symbol}`;
    }

    // Handle Indian stocks
    return `NSE:${symbol}`;
}

export const TradingViewChart = memo(TradingViewChartComponent);

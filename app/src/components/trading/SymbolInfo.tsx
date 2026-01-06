'use client';

import { useEffect, useRef, memo } from 'react';

interface SymbolInfoProps {
    symbol: string;
    exchange?: string;
    colorTheme?: 'light' | 'dark';
    width?: string | number;
    isTransparent?: boolean;
}

function SymbolInfoComponent({
    symbol,
    exchange = 'NSE',
    colorTheme = 'dark',
    width = '100%',
    isTransparent = true,
}: SymbolInfoProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        containerRef.current.innerHTML = '';

        const widgetContainer = document.createElement('div');
        widgetContainer.className = 'tradingview-widget-container';

        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'tradingview-widget-container__widget';
        widgetContainer.appendChild(widgetDiv);

        // Format symbol for TradingView
        let tvSymbol = `${exchange}:${symbol}`;
        if (symbol.includes('USDT')) {
            tvSymbol = `BINANCE:${symbol}`;
        } else if (['AAPL', 'GOOGL', 'TSLA', 'MSFT', 'NVDA'].includes(symbol)) {
            tvSymbol = `NASDAQ:${symbol}`;
        }

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js';
        script.type = 'text/javascript';
        script.async = true;
        script.innerHTML = JSON.stringify({
            symbol: tvSymbol,
            width: typeof width === 'number' ? width : '100%',
            locale: 'en',
            colorTheme,
            isTransparent,
        });

        widgetContainer.appendChild(script);
        containerRef.current.appendChild(widgetContainer);

        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [symbol, exchange, colorTheme, width, isTransparent]);

    return <div ref={containerRef} className="symbol-info-container" />;
}

export const SymbolInfo = memo(SymbolInfoComponent);

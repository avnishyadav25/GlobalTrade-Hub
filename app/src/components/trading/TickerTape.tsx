'use client';

import { useEffect, useRef, memo } from 'react';

interface TickerTapeProps {
    symbols?: Array<{ proName: string; title: string }>;
    showSymbolLogo?: boolean;
    colorTheme?: 'light' | 'dark';
    isTransparent?: boolean;
    displayMode?: 'adaptive' | 'regular' | 'compact';
}

function TickerTapeComponent({
    symbols,
    showSymbolLogo = true,
    colorTheme = 'dark',
    isTransparent = true,
    displayMode = 'adaptive',
}: TickerTapeProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const defaultSymbols = [
        { proName: 'NSE:RELIANCE', title: 'Reliance' },
        { proName: 'NSE:TCS', title: 'TCS' },
        { proName: 'NSE:INFY', title: 'Infosys' },
        { proName: 'NASDAQ:AAPL', title: 'Apple' },
        { proName: 'NASDAQ:GOOGL', title: 'Google' },
        { proName: 'NASDAQ:TSLA', title: 'Tesla' },
        { proName: 'BINANCE:BTCUSDT', title: 'Bitcoin' },
        { proName: 'BINANCE:ETHUSDT', title: 'Ethereum' },
    ];

    useEffect(() => {
        if (!containerRef.current) return;

        containerRef.current.innerHTML = '';

        const widgetContainer = document.createElement('div');
        widgetContainer.className = 'tradingview-widget-container';

        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'tradingview-widget-container__widget';
        widgetContainer.appendChild(widgetDiv);

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
        script.type = 'text/javascript';
        script.async = true;
        script.innerHTML = JSON.stringify({
            symbols: symbols || defaultSymbols,
            showSymbolLogo,
            colorTheme,
            isTransparent,
            displayMode,
            locale: 'en',
        });

        widgetContainer.appendChild(script);
        containerRef.current.appendChild(widgetContainer);

        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [symbols, showSymbolLogo, colorTheme, isTransparent, displayMode]);

    return <div ref={containerRef} className="ticker-tape-container w-full" />;
}

export const TickerTape = memo(TickerTapeComponent);

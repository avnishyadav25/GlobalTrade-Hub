'use client';

import { useEffect, useRef, memo } from 'react';

interface MarketOverviewProps {
    colorTheme?: 'light' | 'dark';
    height?: number;
    width?: string | number;
    showFloatingTooltip?: boolean;
}

function MarketOverviewComponent({
    colorTheme = 'dark',
    height = 400,
    width = '100%',
    showFloatingTooltip = true,
}: MarketOverviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        containerRef.current.innerHTML = '';

        const widgetContainer = document.createElement('div');
        widgetContainer.className = 'tradingview-widget-container';

        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'tradingview-widget-container__widget';
        widgetContainer.appendChild(widgetDiv);

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js';
        script.type = 'text/javascript';
        script.async = true;
        script.innerHTML = JSON.stringify({
            colorTheme,
            dateRange: '12M',
            showChart: true,
            locale: 'en',
            width: typeof width === 'number' ? width : '100%',
            height,
            largeChartUrl: '',
            isTransparent: true,
            showSymbolLogo: true,
            showFloatingTooltip,
            tabs: [
                {
                    title: 'Indian Stocks',
                    symbols: [
                        { s: 'NSE:NIFTY', d: 'Nifty 50' },
                        { s: 'NSE:BANKNIFTY', d: 'Bank Nifty' },
                        { s: 'NSE:RELIANCE', d: 'Reliance' },
                        { s: 'NSE:TCS', d: 'TCS' },
                        { s: 'NSE:INFY', d: 'Infosys' },
                    ],
                    originalTitle: 'Indian Stocks',
                },
                {
                    title: 'US Stocks',
                    symbols: [
                        { s: 'NASDAQ:AAPL', d: 'Apple' },
                        { s: 'NASDAQ:GOOGL', d: 'Google' },
                        { s: 'NASDAQ:TSLA', d: 'Tesla' },
                        { s: 'NASDAQ:MSFT', d: 'Microsoft' },
                        { s: 'NASDAQ:NVDA', d: 'Nvidia' },
                    ],
                    originalTitle: 'US Stocks',
                },
                {
                    title: 'Crypto',
                    symbols: [
                        { s: 'BINANCE:BTCUSDT', d: 'Bitcoin' },
                        { s: 'BINANCE:ETHUSDT', d: 'Ethereum' },
                        { s: 'BINANCE:SOLUSDT', d: 'Solana' },
                        { s: 'BINANCE:BNBUSDT', d: 'BNB' },
                    ],
                    originalTitle: 'Crypto',
                },
            ],
        });

        widgetContainer.appendChild(script);
        containerRef.current.appendChild(widgetContainer);

        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [colorTheme, height, width, showFloatingTooltip]);

    return (
        <div
            ref={containerRef}
            className="market-overview-container rounded-lg overflow-hidden"
            style={{ height, background: 'var(--card)' }}
        />
    );
}

export const MarketOverview = memo(MarketOverviewComponent);

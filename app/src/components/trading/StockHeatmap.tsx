'use client';

import { useEffect, useRef, memo } from 'react';

interface StockHeatmapProps {
    exchange?: string;
    colorTheme?: 'light' | 'dark';
    height?: number;
    width?: string | number;
    hasTopBar?: boolean;
}

function StockHeatmapComponent({
    exchange = 'NSE',
    colorTheme = 'dark',
    height = 500,
    width = '100%',
    hasTopBar = true,
}: StockHeatmapProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        containerRef.current.innerHTML = '';

        const widgetContainer = document.createElement('div');
        widgetContainer.className = 'tradingview-widget-container';
        widgetContainer.style.height = '100%';
        widgetContainer.style.width = '100%';

        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'tradingview-widget-container__widget';
        widgetDiv.style.height = `calc(100% - 32px)`;
        widgetDiv.style.width = '100%';
        widgetContainer.appendChild(widgetDiv);

        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
        script.type = 'text/javascript';
        script.async = true;

        // Configure based on exchange
        let dataSource = 'SENSEX';
        let blockSize = 'market_cap_basic';

        if (exchange === 'NASDAQ' || exchange === 'NYSE') {
            dataSource = 'SPX500';
        } else if (exchange === 'CRYPTO') {
            dataSource = 'Crypto';
            blockSize = 'market_cap_calc';
        }

        script.innerHTML = JSON.stringify({
            exchanges: [],
            dataSource,
            grouping: 'sector',
            blockSize,
            blockColor: 'change',
            locale: 'en',
            symbolUrl: '',
            colorTheme,
            hasTopBar,
            isDataSet498Enabled: false,
            width: typeof width === 'number' ? width : '100%',
            height,
        });

        widgetContainer.appendChild(script);
        containerRef.current.appendChild(widgetContainer);

        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
        };
    }, [exchange, colorTheme, height, width, hasTopBar]);

    return (
        <div
            ref={containerRef}
            className="stock-heatmap-container rounded-lg overflow-hidden"
            style={{ height, background: 'var(--card)' }}
        />
    );
}

export const StockHeatmap = memo(StockHeatmapComponent);

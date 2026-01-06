'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
import { motion } from 'framer-motion';
import { TIMEFRAMES } from '@/lib/constants';
import { generateCandleData } from '@/lib/mockData';

interface CandlestickChartProps {
    symbol: string;
    height?: number;
}

export function CandlestickChart({ symbol, height = 400 }: CandlestickChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const [selectedTimeframe, setSelectedTimeframe] = useState('5m');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // Create chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#8b95a7',
                fontFamily: 'Inter, system-ui, sans-serif',
            },
            grid: {
                vertLines: { color: 'rgba(30, 41, 59, 0.5)' },
                horzLines: { color: 'rgba(30, 41, 59, 0.5)' },
            },
            width: chartContainerRef.current.clientWidth,
            height,
            crosshair: {
                mode: 1,
                vertLine: {
                    width: 1,
                    color: '#6366f1',
                    style: 2,
                    labelBackgroundColor: '#6366f1',
                },
                horzLine: {
                    width: 1,
                    color: '#6366f1',
                    style: 2,
                    labelBackgroundColor: '#6366f1',
                },
            },
            rightPriceScale: {
                borderColor: 'rgba(30, 41, 59, 0.8)',
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.1,
                },
            },
            timeScale: {
                borderColor: 'rgba(30, 41, 59, 0.8)',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        chartRef.current = chart;

        // Add candlestick series using new v5 API
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderUpColor: '#22c55e',
            borderDownColor: '#ef4444',
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        candleSeriesRef.current = candleSeries;

        // Load initial data
        const candleData = generateCandleData(symbol, 100);
        candleSeries.setData(candleData as CandlestickData<Time>[]);
        chart.timeScale().fitContent();

        setIsLoading(false);

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                });
            }
        };

        window.addEventListener('resize', handleResize);

        // Simulate real-time updates
        const updateInterval = setInterval(() => {
            if (candleSeriesRef.current) {
                const lastCandle = candleData[candleData.length - 1];
                const volatility = 0.002 + Math.random() * 0.005;
                const direction = Math.random() > 0.5 ? 1 : -1;
                const newClose = lastCandle.close * (1 + direction * volatility);

                candleSeriesRef.current.update({
                    time: lastCandle.time as Time,
                    open: lastCandle.open,
                    high: Math.max(lastCandle.high, newClose),
                    low: Math.min(lastCandle.low, newClose),
                    close: parseFloat(newClose.toFixed(2)),
                });
            }
        }, 1000);

        return () => {
            window.removeEventListener('resize', handleResize);
            clearInterval(updateInterval);
            chart.remove();
        };
    }, [symbol, height]);

    // Update data when timeframe changes
    useEffect(() => {
        if (candleSeriesRef.current) {
            setIsLoading(true);
            const candleData = generateCandleData(symbol, 100);
            candleSeriesRef.current.setData(candleData as CandlestickData<Time>[]);
            chartRef.current?.timeScale().fitContent();
            setIsLoading(false);
        }
    }, [selectedTimeframe, symbol]);

    return (
        <div className="relative">
            {/* Timeframe Selector */}
            <div className="flex items-center gap-1 mb-4">
                {TIMEFRAMES.map((tf) => (
                    <button
                        key={tf.value}
                        onClick={() => setSelectedTimeframe(tf.value)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${selectedTimeframe === tf.value
                                ? 'text-white'
                                : ''
                            }`}
                        style={{
                            background:
                                selectedTimeframe === tf.value
                                    ? 'var(--primary)'
                                    : 'var(--background-tertiary)',
                            color:
                                selectedTimeframe === tf.value
                                    ? 'white'
                                    : 'var(--foreground-muted)',
                        }}
                    >
                        {tf.label}
                    </button>
                ))}
            </div>

            {/* Chart Container */}
            <div
                ref={chartContainerRef}
                className="rounded-lg overflow-hidden"
                style={{ background: 'var(--background-secondary)' }}
            />

            {/* Loading Overlay */}
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(10, 14, 23, 0.8)' }}
                >
                    <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
                </motion.div>
            )}
        </div>
    );
}

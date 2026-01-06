'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useTradingStore } from '@/stores/tradingStore';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface OrderPanelProps {
    symbol: string;
    currentPrice: number;
    currency: string;
}

export function OrderPanel({ symbol, currentPrice, currency }: OrderPanelProps) {
    const { isPaperTrading, placeOrder } = useTradingStore();
    const [side, setSide] = useState<'buy' | 'sell'>('buy');
    const [orderType, setOrderType] = useState<string>('market');
    const [quantity, setQuantity] = useState('');
    const [limitPrice, setLimitPrice] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [oneClickTrading, setOneClickTrading] = useState(false);
    const [takeProfit, setTakeProfit] = useState('');
    const [stopLoss, setStopLoss] = useState('');

    const orderValue = parseFloat(quantity) * (orderType === 'limit' ? parseFloat(limitPrice) || currentPrice : currentPrice);

    const handleQuickQuantity = (percent: number) => {
        const balance = 100000;
        const maxQuantity = (balance * percent) / 100 / currentPrice;
        setQuantity(maxQuantity.toFixed(4));
    };

    const handleSubmit = () => {
        if (!quantity || parseFloat(quantity) <= 0) return;

        placeOrder({
            symbol,
            side,
            type: orderType as 'market' | 'limit' | 'stop_loss' | 'stop_limit',
            quantity: parseFloat(quantity),
            price: orderType === 'limit' ? parseFloat(limitPrice) : undefined,
        });

        setQuantity('');
        setLimitPrice('');
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Order</h3>
                    <div className="flex items-center gap-2">
                        <Label htmlFor="one-click" className="text-xs text-muted-foreground">One-Click</Label>
                        <Switch
                            id="one-click"
                            checked={oneClickTrading}
                            onCheckedChange={setOneClickTrading}
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Buy/Sell Toggle */}
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        variant={side === 'buy' ? 'default' : 'outline'}
                        onClick={() => setSide('buy')}
                        className={side === 'buy' ? 'bg-profit hover:bg-profit/90' : ''}
                    >
                        Buy / Long
                    </Button>
                    <Button
                        variant={side === 'sell' ? 'default' : 'outline'}
                        onClick={() => setSide('sell')}
                        className={side === 'sell' ? 'bg-loss hover:bg-loss/90' : ''}
                    >
                        Sell / Short
                    </Button>
                </div>

                {/* Order Type */}
                <div className="space-y-2">
                    <Label>Order Type</Label>
                    <Select value={orderType} onValueChange={setOrderType}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="market">Market Order</SelectItem>
                            <SelectItem value="limit">Limit Order</SelectItem>
                            <SelectItem value="stop_loss">Stop Loss</SelectItem>
                            <SelectItem value="stop_limit">Stop Limit</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Limit Price */}
                {(orderType === 'limit' || orderType === 'stop_limit') && (
                    <div className="space-y-2">
                        <Label>Price ({currency})</Label>
                        <Input
                            type="number"
                            value={limitPrice}
                            onChange={(e) => setLimitPrice(e.target.value)}
                            placeholder={currentPrice.toString()}
                        />
                    </div>
                )}

                {/* Quantity */}
                <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="0"
                    />
                    <div className="grid grid-cols-4 gap-1">
                        {[25, 50, 75, 100].map((pct) => (
                            <Button
                                key={pct}
                                variant="outline"
                                size="sm"
                                onClick={() => handleQuickQuantity(pct)}
                                className="text-xs"
                            >
                                {pct}%
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Order Value */}
                <div className="p-3 rounded-lg bg-secondary">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Order Value</span>
                        <span className="font-semibold">
                            {currency}{(orderValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                {/* Advanced Options */}
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    Advanced Options
                </button>

                {showAdvanced && (
                    <div className="space-y-3 pt-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Take Profit</Label>
                                <Input
                                    type="number"
                                    value={takeProfit}
                                    onChange={(e) => setTakeProfit(e.target.value)}
                                    placeholder="Price"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Stop Loss</Label>
                                <Input
                                    type="number"
                                    value={stopLoss}
                                    onChange={(e) => setStopLoss(e.target.value)}
                                    placeholder="Price"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Submit Button */}
                <Button
                    onClick={handleSubmit}
                    disabled={!quantity || parseFloat(quantity) <= 0}
                    className={`w-full ${side === 'buy' ? 'bg-profit hover:bg-profit/90' : 'bg-loss hover:bg-loss/90'}`}
                    size="lg"
                >
                    <Zap size={16} />
                    {side === 'buy' ? 'Buy' : 'Sell'} {symbol}
                </Button>

                {/* Paper Trading Notice */}
                {isPaperTrading && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-profit/10 text-xs">
                        <Info size={14} className="text-profit mt-0.5" />
                        <span className="text-muted-foreground">
                            Paper trading mode - orders are simulated
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

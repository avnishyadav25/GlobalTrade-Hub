'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useMarketStore } from '@/stores/marketStore';
import { usePaperStore } from '@/stores/paperStore';
import { useUIStore } from '@/stores/uiStore';
import { useCoachStore } from '@/stores/coachStore';
import { checkRules } from '@/lib/coach';
import { estimateCharges, type PaperOrderType, type PaperSide } from '@/lib/paperEngine';
import { getAsset } from '@/lib/mockData';
import { fmtPrice, fmtMoney, marketCurrency } from '@/lib/format';

type TicketType = 'market' | 'limit' | 'sl';

export function OrderTicket({ symbol, forcePaper = false }: { symbol: string; forcePaper?: boolean }) {
    const quote = useMarketStore((s) => s.quotes[symbol]);
    const place = usePaperStore((s) => s.place);
    const tradeMode = useUIStore((s) => s.tradeMode);
    const paper = forcePaper || tradeMode === 'paper';

    const [side, setSide] = useState<PaperSide>('buy');
    const [type, setType] = useState<TicketType>('market');
    const [qty, setQty] = useState('0.10');
    const [price, setPrice] = useState('');
    const [stop, setStop] = useState('');

    const asset = getAsset(symbol);
    const ccy = asset ? marketCurrency(asset.market) : 'USD';
    const px = quote?.price ?? asset?.price ?? 0;
    const q = parseFloat(qty) || 0;
    const refPrice = type === 'limit' ? parseFloat(price) || px : px;
    const charges = estimateCharges(symbol, q, refPrice);

    const submit = () => {
        if (q <= 0) return toast.error('Enter a quantity');
        if (!paper) {
            toast.message('Live trading', {
                description: 'Connect a broker in Settings → Connections and switch a connection to Live to route real orders.',
            });
            return;
        }
        // enforce applied AI-coach rules
        const applied = useCoachStore.getState().appliedRules;
        const gate = checkRules(applied, usePaperStore.getState().state, { symbol, qty: q, price: refPrice }, useMarketStore.getState().quotes);
        if (!gate.allowed) {
            toast.error('Blocked by your coach rule', { description: gate.reason });
            return;
        }
        const engineType: PaperOrderType =
            type === 'market' ? 'market' : type === 'limit' ? 'limit' : 'stop';
        place({
            symbol,
            side,
            type: engineType,
            qty: q,
            limitPrice: type === 'limit' ? parseFloat(price) || px : undefined,
            stopPrice: type === 'sl' ? parseFloat(stop) || px : undefined,
        });
        toast.success(
            `${side === 'buy' ? 'Buy' : 'Sell'} ${q} ${symbol} · ${type.toUpperCase()}`,
            { description: paper ? 'Paper order submitted' : 'Order routed' }
        );
    };

    const unit = symbol.includes('/') ? symbol.split('/')[0] : 'qty';

    return (
        <div className="flex flex-col">
            {/* Buy / Sell */}
            <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                    onClick={() => setSide('buy')}
                    className={`rounded-[9px] py-2.5 text-sm font-extrabold ${
                        side === 'buy' ? 'bg-up text-[color:var(--cp-text)]' : 'bg-chip text-foreground-muted'
                    }`}
                >
                    Buy
                </button>
                <button
                    onClick={() => setSide('sell')}
                    className={`rounded-[9px] py-2.5 text-sm font-extrabold ${
                        side === 'sell' ? 'bg-down text-white' : 'bg-chip text-foreground-muted'
                    }`}
                >
                    Sell
                </button>
            </div>

            {/* type */}
            <div className="mb-3.5 flex gap-1 text-[11.5px] font-semibold">
                {(['market', 'limit', 'sl'] as TicketType[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => setType(t)}
                        className={`flex-1 rounded-[7px] py-1.5 ${
                            type === t ? 'bg-accent-soft text-accent' : 'text-foreground-muted'
                        }`}
                    >
                        {t === 'sl' ? 'SL' : t[0].toUpperCase() + t.slice(1)}
                    </button>
                ))}
            </div>

            <Field label="QUANTITY">
                <input
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    inputMode="decimal"
                    className="mono w-full bg-transparent text-base font-semibold outline-none"
                />
                <span className="text-[13px] text-faint">{unit}</span>
            </Field>

            {type === 'limit' && (
                <Field label="LIMIT PRICE">
                    <input
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder={fmtPrice(px)}
                        inputMode="decimal"
                        className="mono w-full bg-transparent text-base font-semibold outline-none placeholder:text-faint"
                    />
                </Field>
            )}
            {type === 'sl' && (
                <Field label="TRIGGER PRICE">
                    <input
                        value={stop}
                        onChange={(e) => setStop(e.target.value)}
                        placeholder={fmtPrice(px)}
                        inputMode="decimal"
                        className="mono w-full bg-transparent text-base font-semibold outline-none placeholder:text-faint"
                    />
                </Field>
            )}

            <div className="mb-3.5 rounded-[9px] border border-border2 bg-background px-3.5 py-3 text-[12px]">
                <Row label="Order value" value={fmtMoney(charges.orderValue, 'INR')} />
                <Row label="Margin reqd" value={fmtMoney(charges.margin, 'INR')} />
                <Row label="Charges" value={fmtMoney(charges.charges, 'INR')} last />
            </div>

            <button
                onClick={submit}
                className="rounded-[11px] py-3.5 text-[15px] font-extrabold"
                style={{
                    background: side === 'buy' ? 'var(--up)' : 'var(--down)',
                    color: side === 'buy' ? 'var(--cp-text)' : '#fff',
                    boxShadow: `0 6px 20px ${side === 'buy' ? 'rgba(47,212,126,.2)' : 'rgba(255,84,112,.2)'}`,
                }}
            >
                {side === 'buy' ? 'Buy' : 'Sell'} {symbol}{paper ? ' · paper' : ''}
            </button>
            <div className="mt-3 text-center text-[11px] text-faint">
                {paper ? 'Fills are simulated against live market prices.' : 'Live orders route through your connected broker.'}
                {` · Ref ${ccy === 'INR' ? '₹' : '$'}${fmtPrice(px)}`}
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <>
            <label className="text-[10.5px] font-bold tracking-wide text-faint">{label}</label>
            <div className="mb-3.5 mt-1.5 flex items-center justify-between rounded-[9px] border border-border px-3.5 py-2.5">
                {children}
            </div>
        </>
    );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
    return (
        <div className={`flex justify-between ${last ? '' : 'mb-1.5'}`}>
            <span className="text-foreground-muted">{label}</span>
            <span className="mono font-semibold">{value}</span>
        </div>
    );
}

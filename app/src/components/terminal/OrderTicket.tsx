'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useMarketStore } from '@/stores/marketStore';
import { usePaperStore } from '@/stores/paperStore';
import { useUIStore } from '@/stores/uiStore';
import {
    estimateCharges,
    buyingPower,
    deriveFxRates,
    toBase,
    isFractional,
    type PaperOrderType,
    type PaperSide,
} from '@/lib/paperEngine';
import { getAsset } from '@/lib/mockData';
import { fmtPrice, fmtMoney } from '@/lib/format';

type TicketType = 'market' | 'limit' | 'sl';

/**
 * A starting quantity the account can actually afford (~10% of buying power).
 * The ticket used to default to a hardcoded 0.10, which on a ₹5,00,000 account is
 * ₹5.4 lakh of BTC — every default order was rejected.
 */
function defaultQty(symbol: string, price: number, power: number, fxUsd: number): string {
    if (!(price > 0) || !(power > 0)) return isFractional(symbol) ? '0.01' : '1';
    const budget = power * 0.1;
    const unitCostBase = toBase(symbol, price, { INR: 1, USD: fxUsd, JPY: fxUsd / 156.82, stale: true });
    if (!(unitCostBase > 0)) return isFractional(symbol) ? '0.01' : '1';
    const raw = budget / unitCostBase;
    if (!isFractional(symbol)) return String(Math.max(1, Math.floor(raw)));
    if (raw >= 1) return String(+raw.toFixed(2));
    return String(+raw.toPrecision(2));
}

export function OrderTicket({ symbol, forcePaper = false }: { symbol: string; forcePaper?: boolean }) {
    const quote = useMarketStore((s) => s.quotes[symbol]);
    const quotes = useMarketStore((s) => s.quotes);
    const place = usePaperStore((s) => s.place);
    const paperState = usePaperStore((s) => s.state);
    const tradeMode = useUIStore((s) => s.tradeMode);
    const paper = forcePaper || tradeMode === 'paper';

    const [side, setSide] = useState<PaperSide>('buy');
    const [type, setType] = useState<TicketType>('market');
    const [qty, setQty] = useState('');
    const [price, setPrice] = useState('');
    const [stop, setStop] = useState('');

    const asset = getAsset(symbol);
    // The instrument's own quote currency, not its market's — USD/JPY is quoted in yen.
    const ccy = asset?.quoteCcy ?? 'USD';
    const ccySymbol = ccy === 'INR' ? '₹' : ccy === 'JPY' ? '¥' : '$';
    const px = quote?.price ?? asset?.price ?? 0;
    const fx = deriveFxRates(quotes);
    const power = buyingPower(paperState);

    // Re-seed the quantity when the instrument changes, so the default is affordable.
    useEffect(() => {
        setQty(defaultQty(symbol, px, power, fx.USD));
        setPrice('');
        setStop('');
        // Intentionally keyed on symbol only: re-seeding on every price tick would
        // fight the user's typing.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol]);

    const q = parseFloat(qty) || 0;
    const refPrice = type === 'limit' ? parseFloat(price) || px : px;
    const charges = estimateCharges(symbol, q, refPrice, fx);
    // Only an opening trade needs funding; reducing an existing position never does.
    const posQty = paperState.positions[symbol]?.qty ?? 0;
    const reducing = posQty !== 0 && (side === 'buy' ? posQty < 0 : posQty > 0);
    const overBudget = !reducing && q > 0 && charges.orderValue + charges.charges > power;

    const submit = () => {
        if (q <= 0) return toast.error('Enter a quantity');
        if (!paper) {
            toast.message('Live trading', {
                description: 'Connect a broker in Settings → Connections and switch a connection to Live to route real orders.',
            });
            return;
        }
        const engineType: PaperOrderType =
            type === 'market' ? 'market' : type === 'limit' ? 'limit' : 'stop';

        // Kill-switch, coach rules and engine validation all run inside place().
        const result = place({
            symbol,
            side,
            type: engineType,
            qty: q,
            limitPrice: type === 'limit' ? parseFloat(price) || px : undefined,
            stopPrice: type === 'sl' ? parseFloat(stop) || px : undefined,
        });

        const label = `${side === 'buy' ? 'Buy' : 'Sell'} ${q} ${symbol} · ${type.toUpperCase()}`;
        if (result.status === 'rejected') {
            toast.error('Order rejected', { description: result.reason });
            return;
        }
        // Don't claim "submitted" for an order that is only resting — say which it is.
        toast.success(label, {
            description: result.status === 'filled' ? 'Filled' : 'Working — resting until the price is reached',
        });
    };

    const unit = symbol.includes('/') ? symbol.split('/')[0] : 'qty';

    return (
        <div className="flex flex-col">
            {/* Buy / Sell */}
            <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                    onClick={() => setSide('buy')}
                    className={`rounded-sm py-2.5 text-sm font-bold ${
                        side === 'buy' ? 'bg-up text-[color:var(--cp-text)]' : 'bg-chip text-foreground-muted'
                    }`}
                >
                    Buy
                </button>
                <button
                    onClick={() => setSide('sell')}
                    className={`rounded-sm py-2.5 text-sm font-bold ${
                        side === 'sell' ? 'bg-down text-white' : 'bg-chip text-foreground-muted'
                    }`}
                >
                    Sell
                </button>
            </div>

            {/* type */}
            <div className="mb-3.5 flex gap-1 text-xs font-semibold">
                {(['market', 'limit', 'sl'] as TicketType[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => setType(t)}
                        className={`flex-1 rounded-xs py-1.5 transition-colors ${
                            type === t ? 'bg-accent-soft font-semibold text-accent' : 'text-foreground-muted hover:text-foreground'
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
                <span className="text-base text-faint">{unit}</span>
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

            <div className="mb-3.5 rounded-sm border border-border2 bg-background px-3.5 py-3 text-sm">
                <Row label="Order value" value={fmtMoney(charges.orderValue, 'INR')} />
                <Row label="Margin reqd" value={fmtMoney(charges.margin, 'INR')} />
                <Row label="Charges" value={fmtMoney(charges.charges, 'INR')} />
                <Row label="Buying power" value={fmtMoney(power, 'INR')} last />
            </div>

            {overBudget && (
                <div className="mb-3 rounded-sm bg-down-dim px-3 py-2 text-xs font-medium text-down">
                    Exceeds buying power by {fmtMoney(charges.orderValue + charges.charges - power, 'INR', 0)}. Reduce the
                    quantity or reset the paper account.
                </div>
            )}

            <button
                onClick={submit}
                disabled={overBudget}
                className="rounded-sm py-3 text-md font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: side === 'buy' ? 'var(--up)' : 'var(--down)', color: 'var(--cp-text)' }}
            >
                {side === 'buy' ? 'Buy' : 'Sell'} {symbol}{paper ? ' · paper' : ''}
            </button>
            <div className="mt-3 text-center text-xs text-faint">
                {paper ? 'Fills are simulated against live market prices.' : 'Live orders route through your connected broker.'}
                {` · Ref ${ccySymbol}${fmtPrice(px)}`}
            </div>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <>
            <label className="text-2xs font-bold tracking-wide text-faint">{label}</label>
            <div className="field mb-3.5 mt-1.5 flex items-center justify-between rounded-sm border border-border px-3 py-2">
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

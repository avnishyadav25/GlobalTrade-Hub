'use client';

import { useEffect, useRef, useState } from 'react';

// Animated explainers for the Learn track.
//
// Hand-rolled SVG and CSS — no animation library, no charting dependency. Every one
// of these honours `prefers-reduced-motion` by rendering its final frame statically,
// and pauses while off-screen so a lesson page with several of them costs nothing
// while you are reading something else.

const UP = 'var(--up)';
const DOWN = 'var(--down)';
const ACCENT = 'var(--accent)';
const FAINT = 'var(--faint)';
const FG = 'var(--foreground)';

/** Plays only while visible, and never when the reader has asked for less motion. */
function useVisible<T extends Element>() {
    const ref = useRef<T>(null);
    const [play, setPlay] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const io = new IntersectionObserver(([e]) => setPlay(e.isIntersecting), { threshold: 0.35 });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    return { ref, play };
}

function Frame({ children, caption }: { children: React.ReactNode; caption?: string }) {
    return (
        <figure className="rounded-sm border border-border2 bg-panel2 p-3">
            {children}
            {caption && <figcaption className="mt-2 text-xs text-faint">{caption}</figcaption>}
        </figure>
    );
}

/* ------------------------------------------------------------ candle anatomy */

function CandleAnatomy() {
    const { ref, play } = useVisible<HTMLDivElement>();
    return (
        <Frame caption="One candle summarises a whole period with four numbers. The wicks are where price went and did not stay.">
            <div ref={ref}>
                <svg viewBox="0 0 260 150" className="w-full" role="img" aria-label="Anatomy of a candlestick: open, high, low and close">
                    <style>{`
                        .ca-part { opacity: 0; }
                        .ca-play .ca-part { animation: caIn .45s ease forwards; }
                        .ca-play .ca-2 { animation-delay: .45s }
                        .ca-play .ca-3 { animation-delay: .9s }
                        .ca-play .ca-4 { animation-delay: 1.35s }
                        @keyframes caIn { to { opacity: 1 } }
                        @media (prefers-reduced-motion: reduce) { .ca-part { opacity: 1 !important; animation: none !important } }
                    `}</style>
                    <g className={play ? 'ca-play' : ''}>
                        {/* body */}
                        <rect className="ca-part ca-1" x="110" y="55" width="34" height="52" rx="2" fill={UP} opacity="0.9" />
                        {/* upper wick */}
                        <line className="ca-part ca-2" x1="127" y1="20" x2="127" y2="55" stroke={UP} strokeWidth="2.5" />
                        {/* lower wick */}
                        <line className="ca-part ca-3" x1="127" y1="107" x2="127" y2="132" stroke={UP} strokeWidth="2.5" />

                        <g className="ca-part ca-4" fontSize="9" fill={FAINT} fontWeight="600">
                            <line x1="150" y1="20" x2="196" y2="20" stroke={FAINT} strokeDasharray="2 2" />
                            <text x="200" y="23">HIGH</text>
                            <line x1="150" y1="55" x2="196" y2="55" stroke={FAINT} strokeDasharray="2 2" />
                            <text x="200" y="58" fill={FG}>CLOSE</text>
                            <line x1="60" y1="107" x2="106" y2="107" stroke={FAINT} strokeDasharray="2 2" />
                            <text x="8" y="110" fill={FG}>OPEN</text>
                            <line x1="60" y1="132" x2="106" y2="132" stroke={FAINT} strokeDasharray="2 2" />
                            <text x="14" y="135">LOW</text>
                        </g>
                    </g>
                </svg>
            </div>
        </Frame>
    );
}

/* ---------------------------------------------------------------- order types */

function OrderTypes() {
    const { ref, play } = useVisible<HTMLDivElement>();
    return (
        <Frame caption="A market order fills now. A limit waits below for a better price. A stop sleeps until price falls to it, then exits.">
            <div ref={ref}>
                <svg viewBox="0 0 300 150" className="w-full" role="img" aria-label="How market, limit and stop orders behave as price moves">
                    <style>{`
                        .ot-path { stroke-dasharray: 420; stroke-dashoffset: 420; }
                        .ot-play .ot-path { animation: otDraw 4s linear infinite; }
                        @keyframes otDraw { to { stroke-dashoffset: 0 } }
                        @media (prefers-reduced-motion: reduce) { .ot-path { stroke-dashoffset: 0 !important; animation: none !important } }
                    `}</style>
                    <g className={play ? 'ot-play' : ''}>
                        <line x1="20" y1="46" x2="280" y2="46" stroke={ACCENT} strokeWidth="1.5" strokeDasharray="4 3" />
                        <text x="20" y="40" fontSize="9" fill={ACCENT} fontWeight="700">LIMIT SELL — waits above</text>

                        <line x1="20" y1="112" x2="280" y2="112" stroke={DOWN} strokeWidth="1.5" strokeDasharray="4 3" />
                        <text x="20" y="126" fontSize="9" fill={DOWN} fontWeight="700">STOP — sleeps, then exits</text>

                        <path
                            className="ot-path"
                            d="M20 80 L60 70 L95 92 L130 60 L165 48 L200 74 L235 104 L280 118"
                            fill="none"
                            stroke={FG}
                            strokeWidth="2"
                        />
                        <circle cx="165" cy="48" r="3.5" fill={ACCENT} />
                        <circle cx="238" cy="106" r="3.5" fill={DOWN} />
                    </g>
                </svg>
            </div>
        </Frame>
    );
}

/* -------------------------------------------------------------- long vs short */

function LongVsShort() {
    return (
        <Frame caption="A long can only fall to zero. A short has no ceiling — that asymmetry is the whole risk story.">
            <svg viewBox="0 0 300 150" className="w-full" role="img" aria-label="Payoff of a long versus a short position as price changes">
                <line x1="20" y1="75" x2="280" y2="75" stroke={FAINT} strokeWidth="1" />
                <line x1="150" y1="15" x2="150" y2="135" stroke={FAINT} strokeWidth="1" strokeDasharray="3 3" />
                <text x="152" y="146" fontSize="8" fill={FAINT}>entry price</text>

                <path d="M40 118 L260 32" fill="none" stroke={UP} strokeWidth="2.5" />
                <text x="235" y="26" fontSize="9" fill={UP} fontWeight="700">LONG</text>

                <path d="M40 32 L260 118" fill="none" stroke={DOWN} strokeWidth="2.5" />
                <text x="232" y="132" fontSize="9" fill={DOWN} fontWeight="700">SHORT</text>

                <text x="22" y="20" fontSize="8" fill={FAINT}>profit</text>
                <text x="22" y="132" fontSize="8" fill={FAINT}>loss</text>
            </svg>
        </Frame>
    );
}

/* ------------------------------------------------------------- slippage/fees */

function SlippageFees() {
    const { ref, play } = useVisible<HTMLDivElement>();
    return (
        <Frame caption="The price you saw, the price you got, and what is left after charges. The gaps are small individually and decisive in aggregate.">
            <div ref={ref}>
                <svg viewBox="0 0 300 120" className="w-full" role="img" aria-label="Quoted price versus fill price versus net after charges">
                    <style>{`
                        .sf-bar { transform: scaleX(0); transform-origin: 60px center; }
                        .sf-play .sf-bar { animation: sfGrow .6s ease forwards; }
                        .sf-play .sf-2 { animation-delay: .35s } .sf-play .sf-3 { animation-delay: .7s }
                        @keyframes sfGrow { to { transform: scaleX(1) } }
                        @media (prefers-reduced-motion: reduce) { .sf-bar { transform: scaleX(1) !important; animation: none !important } }
                    `}</style>
                    <g className={play ? 'sf-play' : ''} fontSize="9" fontWeight="600">
                        <text x="4" y="26" fill={FAINT}>QUOTED</text>
                        <rect className="sf-bar sf-1" x="60" y="16" width="220" height="14" rx="2" fill={ACCENT} opacity=".85" />

                        <text x="4" y="62" fill={FAINT}>FILLED</text>
                        <rect className="sf-bar sf-2" x="60" y="52" width="205" height="14" rx="2" fill={ACCENT} opacity=".55" />
                        <text x="270" y="62" fill={DOWN}>slippage</text>

                        <text x="4" y="98" fill={FAINT}>NET</text>
                        <rect className="sf-bar sf-3" x="60" y="88" width="192" height="14" rx="2" fill={UP} opacity=".75" />
                        <text x="257" y="98" fill={DOWN}>− charges</text>
                    </g>
                </svg>
            </div>
        </Frame>
    );
}

/* --------------------------------------------------------------- fx pipeline */

function FxConversion() {
    const { ref, play } = useVisible<HTMLDivElement>();
    return (
        <Frame caption="Every non-rupee position passes through this before it reaches your balance. The rate is frozen at fill time.">
            <div ref={ref}>
                <svg viewBox="0 0 300 90" className="w-full" role="img" aria-label="A dollar-priced position converted into rupees at the exchange rate">
                    <style>{`
                        .fx-dot { opacity: 0 }
                        .fx-play .fx-dot { animation: fxMove 2.4s ease-in-out infinite }
                        @keyframes fxMove { 0% { opacity:0; transform: translateX(0) } 15% { opacity:1 } 85% { opacity:1 } 100% { opacity:0; transform: translateX(190px) } }
                        @media (prefers-reduced-motion: reduce) { .fx-dot { opacity: 0 !important; animation: none !important } }
                    `}</style>
                    <g className={play ? 'fx-play' : ''}>
                        <rect x="6" y="26" width="76" height="38" rx="4" fill="var(--chip)" stroke="var(--border)" />
                        <text x="44" y="43" fontSize="11" fill={FG} textAnchor="middle" fontWeight="700">$ 213.40</text>
                        <text x="44" y="56" fontSize="8" fill={FAINT} textAnchor="middle">quoted in USD</text>

                        <line x1="86" y1="45" x2="206" y2="45" stroke={FAINT} strokeDasharray="3 3" />
                        <text x="146" y="36" fontSize="9" fill={ACCENT} textAnchor="middle" fontWeight="700">× 95.29</text>
                        <text x="146" y="60" fontSize="8" fill={FAINT} textAnchor="middle">USD → INR</text>
                        <circle className="fx-dot" cx="90" cy="45" r="3" fill={ACCENT} />

                        <rect x="210" y="26" width="84" height="38" rx="4" fill="var(--chip)" stroke="var(--border)" />
                        <text x="252" y="43" fontSize="11" fill={FG} textAnchor="middle" fontWeight="700">₹ 20,335</text>
                        <text x="252" y="56" fontSize="8" fill={FAINT} textAnchor="middle">in your book</text>
                    </g>
                </svg>
            </div>
        </Frame>
    );
}

/* ------------------------------------------------------------------ RSI gauge */

function RsiGauge() {
    const { ref, play } = useVisible<HTMLDivElement>();
    return (
        <Frame caption="Below 30 is called oversold, above 70 overbought. Neither is a signal — a strong trend sits in the zone for weeks.">
            <div ref={ref}>
                <svg viewBox="0 0 300 130" className="w-full" role="img" aria-label="RSI gauge from 0 to 100 with oversold and overbought bands">
                    <style>{`
                        .rsi-needle { transform-origin: 150px 105px; transform: rotate(-40deg) }
                        .rsi-play .rsi-needle { animation: rsiSwing 5s ease-in-out infinite }
                        @keyframes rsiSwing { 0%,100% { transform: rotate(-52deg) } 50% { transform: rotate(56deg) } }
                        @media (prefers-reduced-motion: reduce) { .rsi-needle { animation: none !important } }
                    `}</style>
                    <g className={play ? 'rsi-play' : ''}>
                        <path d="M40 105 A 110 110 0 0 1 88 24" fill="none" stroke={UP} strokeWidth="10" opacity=".55" />
                        <path d="M88 24 A 110 110 0 0 1 212 24" fill="none" stroke={FAINT} strokeWidth="10" opacity=".35" />
                        <path d="M212 24 A 110 110 0 0 1 260 105" fill="none" stroke={DOWN} strokeWidth="10" opacity=".55" />

                        <text x="34" y="122" fontSize="9" fill={UP} fontWeight="700">0 · oversold</text>
                        <text x="228" y="122" fontSize="9" fill={DOWN} fontWeight="700">overbought · 100</text>

                        <line className="rsi-needle" x1="150" y1="105" x2="150" y2="42" stroke={FG} strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="150" cy="105" r="5" fill={FG} />
                    </g>
                </svg>
            </div>
        </Frame>
    );
}

/* ------------------------------------------------------------ equity/drawdown */

function EquityDrawdown() {
    return (
        <Frame caption="The shaded fall is the drawdown. Recovering from −50% needs +100%, which is why avoiding deep holes beats catching big winners.">
            <svg viewBox="0 0 300 140" className="w-full" role="img" aria-label="An equity curve with its peak-to-trough drawdown shaded">
                <path d="M20 100 L60 74 L95 82 L125 44 L160 96 L195 118 L230 88 L275 52" fill="none" stroke={ACCENT} strokeWidth="2.2" />
                <path d="M125 44 L160 96 L195 118 L195 44 Z" fill={DOWN} opacity=".16" />
                <line x1="125" y1="44" x2="275" y2="44" stroke={FAINT} strokeDasharray="3 3" />
                <text x="128" y="38" fontSize="9" fill={FAINT} fontWeight="600">peak</text>
                <line x1="195" y1="118" x2="275" y2="118" stroke={FAINT} strokeDasharray="3 3" />
                <text x="198" y="132" fontSize="9" fill={DOWN} fontWeight="700">trough — this is the drawdown</text>
            </svg>
        </Frame>
    );
}

/* ------------------------------------------------------------- risk sizing */

function RiskSizing() {
    const [stop, setStop] = useState(25);
    const equity = 500_000;
    const riskPct = 0.01;
    const qty = Math.floor((equity * riskPct) / stop);

    return (
        <Frame caption="Move the stop distance. The risk stays fixed at 1% — the quantity is what changes. That is the whole idea.">
            <label className="block text-xs text-faint" htmlFor="risk-stop">
                Stop distance: <span className="mono text-foreground">₹{stop}</span> per unit
            </label>
            <input
                id="risk-stop"
                type="range"
                min={5}
                max={100}
                step={5}
                value={stop}
                onChange={(e) => setStop(Number(e.target.value))}
                className="mt-2 w-full accent-[color:var(--accent)]"
            />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div>
                    <div className="text-2xs font-bold tracking-wide text-faint">EQUITY</div>
                    <div className="mono text-sm">₹5,00,000</div>
                </div>
                <div>
                    <div className="text-2xs font-bold tracking-wide text-faint">RISK (1%)</div>
                    <div className="mono text-sm" style={{ color: DOWN }}>₹5,000</div>
                </div>
                <div>
                    <div className="text-2xs font-bold tracking-wide text-faint">QUANTITY</div>
                    <div className="mono text-sm font-semibold" style={{ color: ACCENT }}>{qty}</div>
                </div>
            </div>
        </Frame>
    );
}

/* ------------------------------------------------------------------ registry */

const VISUALS: Record<string, () => React.JSX.Element> = {
    'candle-anatomy': CandleAnatomy,
    'order-types': OrderTypes,
    'long-vs-short': LongVsShort,
    'slippage-fees': SlippageFees,
    'fx-conversion': FxConversion,
    'rsi-gauge': RsiGauge,
    'equity-drawdown': EquityDrawdown,
    'risk-sizing': RiskSizing,
};

export const VISUAL_KEYS = Object.keys(VISUALS);

/** Renders a lesson's animated explainer, or nothing if the key is unknown. */
export function LessonVisual({ name }: { name?: string }) {
    if (!name) return null;
    const Component = VISUALS[name];
    return Component ? <Component /> : null;
}

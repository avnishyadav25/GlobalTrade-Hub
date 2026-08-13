# Features and strategies — what each one buys you, and what it costs

**The strategy sections below are GENERATED** from the `explain` blocks in
`app/src/lib/strategies/defs/` and `app/src/lib/options/strategy.ts`. They cannot
disagree with what the app shows you, because they are the same text. Regenerate
rather than editing by hand.

Covers **20 equity strategies**, **4 options structures**, every major screen, and the eight
things deliberately not built. Verified against the code on 2026-08-12.

---

## Features

| Feature | What it buys you | What it costs you |
|---|---|---|
| **Paper engine** | Deterministic matching with the real Indian charge stack, and a ledger identity asserted by a 300-step randomised test. Your record means something. | No market depth, no circuit filters, no pre-open auction. Fills are cleaner than reality, so small caps are easier here than on the exchange. |
| **Live market data** | Real Binance crypto, real Indian and US equity, real FX — all behind a cache with rate limiting and a circuit breaker. | US equity price MOVEMENT is simulated. Free tiers are small, so adding instruments has a real budget cost. |
| **Charges** | Itemised brokerage, STT, exchange fee, SEBI fee, stamp duty and GST, shared by the simulator and every backtester. | No tax modelling of any kind. The charge is what you pay to trade, not what you keep. |
| **Backtest (compare)** | Every applicable strategy at DEFAULT settings against buy-and-hold, with statistics withheld below 30 trades. | One window, so it answers "if I had known the best parameters in advance" — a question nobody has. |
| **Walk-forward** | Parameters chosen on data you had, measured on data you had not seen. The gap is the finding. | Up to ~1,600 backtests per run. The grid truncates in cartesian order, so an over-sized grid never reaches the end. |
| **Portfolio test** | Portfolio drawdown from the COMBINED curve against the sleeve average — the gap IS your diversification, measured. | Sleeves are funded independently; there is no shared cash pool where instruments compete for capital. |
| **Options chain** | Live NSE NIFTY/BANKNIFTY with solved Greeks and IV, multi-leg orders, cash settlement at expiry. | Margin is an approximation and charged per leg, so defined-risk structures cost more here than at a broker. No historical chain to backtest against. |
| **Strategy signals** | Approval queue with per-strategy auto opt-in; every order goes through the same chokepoint as a manual one. | Signals are only as good as the rules, and the rules are only as good as the data behind them. |
| **Learn** | 117 lessons, every one with a visual. Practice lessons verified against your ledger — no mark-as-done anywhere. | Reading is not doing. Study lessons are quiz-verified, which is a weaker guarantee and the UI says so. |
| **Research** | US fundamentals, earnings calendar, live NSE IPOs, crypto supply — each distinguishing "no data" from "not covered" from "the source failed". | No free source covers Indian company financials, so that side is worked examples rather than live data. |
| **Coach rules + kill switch** | Pre-commitment devices enforced at the single order chokepoint, including live routing. | A rule you can switch off in one click is still a rule you can switch off. |
| **Cloud sync** | Your book follows you across devices, with a server-side monotonicity guard so an older device cannot overwrite a newer book. | One super-admin, not multi-user. Broker secrets live in Vault and never reach the browser. |

---

## Equity and spot strategies

### benchmark

#### Buy and hold

Buy once, never sell. It is not a trading strategy — it is the bar every trading strategy has to clear. Over long horizons it beats the large majority of active approaches, largely because it pays costs twice in total rather than twice per trade.

**Works when.** Whenever the asset appreciates over your holding period, which for broad equity has been most multi-year windows in history. Its real edge is structural rather than predictive: it pays two sets of charges in total instead of two per trade, it never mistimes a re-entry, and it cannot be talked out of a position during a drawdown. Most active strategies lose to it on costs and behaviour long before they lose on ideas.

**Fails when.** It takes the full drawdown, whatever that turns out to be. A strategy that returns less than buy-and-hold but suffers half the drawdown may well be the better one to actually live with — compare both numbers, not just the return.

> ⚠ Uses 100% of equity by default, which is what makes it a fair benchmark rather than a scaled-down version of one.

*Markets: crypto, india, us, forex, commodity · shape: single*

### trend

#### Moving average crossover

Two averages of the same price, one quick and one slow. When the quick one pulls above the slow one, recent prices are above the longer-run norm and the market is trending up. The crossing is not a prediction — it is a late, smoothed confirmation that a move has already begun, and that lateness is the price of filtering out noise.

**Works when.** Sustained trends, which is the only regime it is built for. When a market moves in one direction for weeks the crossover gets in late, stays in for the bulk of the move, and exits late — capturing the middle. Its low win rate is not a flaw but the shape of the payoff: a handful of large winners funds a long string of small whipsaw losses, and the arithmetic only works if you are still there when the trend arrives.

**Fails when.** Sideways markets. The averages tangle and cross repeatedly, each crossing costing a spread, a slippage and a round of charges. A crossover system can lose money for months in a range and make it all back in one trend — which is why judging it over a short sample tells you nothing.

*Markets: crypto, india, us, forex, commodity · shape: single*

#### MACD signal cross

MACD is the distance between a fast and a slow exponential average, and the signal line is a smoothed version of that distance. A crossing says the rate at which the trend is strengthening has itself turned. It is a moving-average crossover with an extra layer of smoothing, so it is later still — and correspondingly less twitchy.

**Works when.** Trends that build gradually rather than gapping into existence. Because MACD measures whether the trend is ACCELERATING, it tends to hold through the shallow pullbacks that shake a plain crossover out, and the extra smoothing suppresses the marginal crosses that a raw average produces in a drifting market.

**Fails when.** The same sideways-market problem as any crossover, plus one of its own: because MACD is a difference of averages, it can cross while price is going nowhere, purely because the averages are converging. The minimum-strength filter exists to suppress exactly those, at the cost of missing the start of some real moves.

*Markets: crypto, india, us, forex, commodity · shape: single*

#### Breakout with an ATR trailing stop

Enter when price breaks out of its recent range, then let the position run behind a stop that follows it up at a fixed multiple of recent volatility. Sizing comes from the same volatility measure, so a jumpy instrument automatically gets a smaller position than a calm one for the same rupee risk.

**Works when.** Markets that break out and keep going, where the absence of a profit target is the whole point — the trailing stop lets one trade run far enough to pay for a season of failed breakouts. Volatility-based sizing also means a violent instrument and a calm one risk the same rupees, so the strategy is comparable across a portfolio rather than accidentally concentrated in whatever moves most.

**Fails when.** False breakouts in a range: price pokes out, triggers the entry, and immediately reverses through the stop. Also gaps — the stop is a level, not a guarantee, and an overnight gap fills you well beyond it.

> ⚠ The trailing stop is re-expressed as a re-entry at zero additional size, because the engine holds one position with one stop.

*Markets: crypto, india, us, forex, commodity · shape: single*

#### Donchian channel breakout

The rule the Turtle traders were taught in 1983: buy a new N-bar high, sell a new N-bar low, and use a shorter channel to get out. It is almost embarrassingly simple, which is the point — it has no fitted parameters beyond two lookbacks, so there is very little for it to overfit to.

**Works when.** Long, persistent trends in liquid instruments — the regime it was designed for in 1983 and has survived in since. Its strength is what it lacks: with only two lookbacks and no fitted thresholds there is almost nothing to overfit, so an out-of-sample result tends to resemble the in-sample one, which is more than most strategies can claim.

**Fails when.** Choppy, mean-reverting markets, where every breakout is immediately retraced. It also suffers badly when many instruments break out together and then all reverse — the losses arrive at the same time rather than being spread out.

> ⚠ The channel deliberately excludes the current bar, so "breaking the 20-bar high" means exceeding the highest of the 20 bars BEFORE this one.

*Markets: crypto, india, us, forex, commodity · shape: single*

### meanReversion

#### Bollinger band + RSI reversion

Bollinger bands sit a couple of standard deviations either side of a moving average, so price outside them is unusual relative to its own recent volatility. On its own that is weak — price rides the upper band throughout a strong trend. Requiring RSI to agree that the move is stretched filters out the cases where "unusual" simply means "trending".

**Works when.** Range-bound markets with a stable mean, where price genuinely oscillates around a level. Requiring two independent conditions — statistical extension AND momentum exhaustion — is what separates it from a naive band-touch rule, because in a trend price rides the band while RSI refuses to confirm, and the trade is simply not taken.

**Fails when.** A genuine breakout. Price leaves the band and keeps going, RSI stays pinned below 30 for weeks, and every entry is against a move that does not stop. This is the strategy that most reliably produces a long string of small wins followed by one loss larger than all of them.

*Markets: crypto, india, us, forex, commodity · shape: single*

#### RSI(2) pullback in a trend

A very short RSI — two bars rather than fourteen — reacts to a single sharp down day. Combined with a long-term filter that only permits buying while the instrument is above its 200-bar average, this buys short pullbacks inside an established uptrend. The two components do different jobs: the long average decides whether to participate at all, the short RSI decides when.

**Works when.** Established uptrends that pull back sharply and briefly. The two components do genuinely different jobs, which is why the pair works better than either alone: the long average decides whether this market deserves participation at all, and the short RSI decides when the price is temporarily unattractive to everyone else. Buying fear inside strength has a rationale that buying fear alone does not.

**Fails when.** When the long-term trend breaks while you are still trading it. The 200-bar average turns slowly, so there is a window where the filter still says "uptrend" and the market has already rolled over. That window is where this strategy takes its worst losses.

> ⚠ Long only. The asymmetry it exploits — sharp dips inside uptrends — does not mirror cleanly on the short side.

*Markets: india, us, crypto · shape: single*

#### VWAP reversion

VWAP is the average price weighted by how much actually traded there, which makes it a rough proxy for where the day's real business was done. Institutions measure their own execution against it, so it acts as a magnet during a session: price that has run well away from VWAP often comes back to it.

**Works when.** Balanced intraday sessions where price rotates around the day's real business. VWAP is not an arbitrary average — institutions are measured against it, so it acts as a genuine magnet, and a stretch away from it is a stretch away from where size actually traded.

**Fails when.** Trend days, when VWAP simply rises all session and price never comes back to it. Fading a trend day with this is how an intraday account loses a week of gains in an afternoon.

> ⚠ Needs real per-bar volume. Historical candles have it; live bars built from quote ticks do not, so this produces no live signal on instruments without a volume feed.
> ⚠ VWAP anchors at each session open, so it is only meaningful on intraday bars.

*Markets: india, us, crypto · shape: single*

#### Z-score reversion

A z-score expresses how far price sits from its own recent mean in units of its own recent volatility. That normalisation is what makes it comparable across instruments: two standard deviations means the same thing on a quiet currency pair and a violent altcoin, even though the percentage moves differ by an order of magnitude.

**Works when.** Mean-reverting instruments with a stable level. Its advantage is comparability: because the threshold is in standard deviations rather than percent, the same parameters mean the same thing on a quiet currency pair and a violent altcoin, so one rule set can be applied across a portfolio without per-instrument tuning.

**Fails when.** When the mean itself is moving. A z-score measures distance from a rolling average, and in a steady trend that average chases price, so the score keeps resetting toward zero while the instrument marches away from where you bought it.

*Markets: crypto, india, us, forex, commodity · shape: single*

### session

#### Opening range breakout

The first minutes of a session absorb everything that happened while the market was shut — overnight news, other time zones, orders queued since yesterday. Once that initial burst settles, the high and low it produced act as reference levels, and a decisive break of one is read as the day choosing a direction.

**Works when.** Days that choose a direction early and hold it — typically after real overnight news. The opening range is a genuinely informative level rather than an arbitrary one, because it is where the market cleared everything that accumulated while it was shut, and a decisive break of it is the day's first real decision.

**Fails when.** Range-bound days, where price breaks the opening high, reverses, breaks the low, and reverses again — paying the spread and the charges each time. It also fails on gap days, where the opening range is enormous and the stop is consequently far away, making the position size tiny or the risk large.

> ⚠ Intraday only. On a continuous market there is no opening range and this produces no signal.
> ⚠ The app has roughly 28 days of NSE intraday history, which is far too short a sample to validate an intraday strategy. Treat any result as a check that the logic works, not as evidence of an edge.

*Markets: india, us · shape: single*

#### Asian range, London breakout

Currency markets run continuously, but liquidity does not. The Asian hours are comparatively quiet and prices tend to consolidate; when London opens, an order of magnitude more volume arrives at once. A break of the quiet range as that volume hits is read as the direction the larger participants are taking.

**Works when.** Days when the London open brings genuine directional flow into a range that formed on thin Asian liquidity. The edge is structural rather than statistical: the participants arriving are larger, and the range they are breaking was set by a much smaller set of them.

**Fails when.** Days when London opens and immediately reverses, which is common enough to have its own trading folklore. It also fails whenever a scheduled release lands mid-window: the range break and the news are the same event, and the spread widens exactly when the order goes in.

> ⚠ Session hours are in UTC and do not shift with daylight saving, so the London open drifts by an hour twice a year relative to these boundaries.
> ⚠ Needs intraday bars. On daily bars every bar is its own session and the range is undefined.

*Markets: forex, commodity, crypto · shape: single*

### spread

#### Pairs spread reversion

Two instruments that normally move together occasionally drift apart for reasons that are temporary — an index rebalance, a large order, a piece of news that affects one but should affect both. Measuring that gap in standard deviations of its own history gives a scale-free way to say "this is unusually wide", and the bet is that it narrows.

**Works when.** Two instruments with a real economic tie that drift apart on something temporary — an index rebalance, a block order, a headline affecting one but properly affecting both. The bet is on a relationship rather than a direction, so it can pay in a falling market as readily as a rising one.

**Fails when.** When the divergence is information rather than noise. If one company has genuinely deteriorated, the spread does not revert — it keeps widening, and the position that was sized for a two-sigma move keeps losing through four, five and six. Correlation measured on the past is exactly the thing that breaks first.

> ⚠ NOT market-neutral here. The engine holds one position, so this trades the primary leg using the spread as a signal; a real pairs trade is simultaneously short the other leg and is hedged against the market. Do not read these results as a hedged strategy.
> ⚠ Both series must be time-aligned bar for bar. Mismatched trading calendars between the legs will silently distort the spread.

*Markets: us, india, crypto · shape: pair*

#### Refining margin reversion

A refinery buys crude and sells petrol and heating oil, so the gap between them is its gross margin — the crack spread. That margin is bounded by physical economics: too thin and refiners cut runs, reducing product supply and widening it again; too fat and they run flat out, which compresses it. The bet is on that physical feedback loop, not on a statistical accident.

**Works when.** Refining margins stretched beyond what physical economics sustains. Unlike a purely statistical spread, this one has a feedback mechanism behind it: too thin and refiners cut runs, which tightens products and widens the margin again. That is a reason for reversion rather than merely a history of it.

**Fails when.** Genuine supply shocks. A refinery fire, a hurricane or a sanctions decision moves the margin to a new level and keeps it there, and the reversion never comes. Seasonal transitions also shift the normal range, so a lookback that spans a season change measures against a mean that no longer applies.

> ⚠ The data here is Yahoo CONTINUOUS front-month futures, not a real calendar-aligned spread. Continuous series splice contracts together at each roll, which puts artificial jumps into the ratio. This approximates the crack spread; it does not reproduce a tradeable one.
> ⚠ A real crack spread is a multi-leg futures position (commonly 3:2:1). This trades the crude leg alone.

*Markets: commodity · shape: pair*

#### Relative strength ranking

Cross-sectional momentum is the observation that, over medium horizons, instruments which have outperformed their peers tend to keep doing so. It is a RELATIVE statement, not a directional one: in a falling market the winner is the one falling least. The recent window is usually skipped because very short-term moves tend to reverse rather than persist.

**Works when.** Medium horizons in markets with dispersion, where leaders keep leading. Because the statement is relative rather than directional, it can hold up in a falling market — the winner is simply whatever falls least — which makes it behave differently from a trend filter measured against zero.

**Fails when.** Sharp reversals, where yesterday's leaders become the worst performers within days. Momentum strategies characteristically produce steady gains punctuated by severe, fast drawdowns — the pattern is well documented and it is why sizing matters more here than entry timing.

> ⚠ A real cross-sectional strategy ranks a whole universe and holds the top decile. The engine trades one instrument, so this is reduced to a two-way comparison against a single peer, which is a much weaker version of the idea.

*Markets: us, india, crypto · shape: universe*

### volatility

#### Volatility spike reversal

A volatility index measures what the options market is paying for protection, which is a fairly direct reading of how frightened participants are. Fear is mean-reverting in a way prices are not: it spikes hard and decays. Buying the underlying market once that spike has peaked and started to fall is a bet on the exhaustion of the panic rather than on any view about value.

**Works when.** The tail of a panic, once fear has peaked and begun to decay. Fear mean-reverts in a way prices do not, so the signal is measuring something with a genuine tendency to revert rather than hoping a price does. Entries cluster near capitulation, which is where the subsequent returns have historically been largest.

**Fails when.** When the spike is the beginning rather than the end. In a genuine crisis volatility puts in several lower peaks on the way down while the market keeps falling, and each one looks like exhaustion. This strategy will buy every one of them.

> ⚠ Long only. Buying fear has a rationale; shorting calm does not have the mirror-image one.
> ⚠ India VIX is available with roughly 595 days of daily history, which is a small sample containing few genuine panics.

*Markets: india, us · shape: single*

#### Volatility-targeted trend

The entry rule here is intentionally the simplest possible — hold while above a moving average — so that everything interesting is in the sizing. Position size is set inversely to recent volatility, so that a typical bar moves the account by roughly the same amount whatever you are trading. This is what "risk" means to a professional: not the amount invested, but the amount that moves.

**Works when.** Any trending market, because the entry rule is deliberately trivial and the edge is entirely in the sizing. Holding one average true range worth of risk constant means a calm instrument gets a large position and a violent one a small position, so the account's day-to-day movement is stable even as the instruments are not. That is what professional risk control actually means.

**Fails when.** Volatility measured on the past underestimates the future at exactly the wrong moments. Markets are calm right up until they are not, so this sizes UP into the quiet period before a shock and is largest when the shock arrives. Every volatility-targeting approach shares that flaw.

> ⚠ Capped at the maximum size parameter, because an unleveraged account cannot express the small position a very calm instrument implies.

*Markets: crypto, india, us, forex, commodity · shape: single*

### range

#### Grid trading

Place a ladder of buy orders below the current price and sell orders above it, then let the market oscillate through them. Each round trip harvests one rung of movement, and no view about direction is required — only that price keeps crossing the same region. Roughly three-quarters of the time, currency pairs do exactly that.

**Works when.** Range-bound markets that keep crossing the same region — which currency pairs do a large fraction of the time. It needs no view about direction at all, only that price oscillates, and each round trip harvests one rung regardless of which way the market went first.

**Fails when.** A trend. The grid keeps buying as price falls through every rung, each position underwater, and the account carries a growing loss with no mechanism to stop — unless the boundary rule fires. The boundary is not a refinement; it is the only thing standing between this strategy and a margin call.

> ⚠ The engine holds ONE position at a time, so this rests a single rung rather than a full ladder. A real grid holds many simultaneous positions, and its risk profile is correspondingly different — considerably worse in a trend.

*Markets: forex, crypto · shape: single*

### event

#### Post-earnings drift

Markets are supposed to absorb earnings news instantly, and mostly they do — but not completely. Prices have historically continued drifting in the direction of a large surprise for weeks afterwards, which is one of the most durable documented anomalies in finance. The usual explanation is that investors under-react to information that arrives all at once.

**Works when.** Large earnings surprises in liquid names. This is one of the most durable documented anomalies in finance and it survives, in weakened form, decades after publication — which is what you would expect of a real effect being slowly arbitraged rather than a data artefact. Requiring the gap to agree with the surprise filters the cases where the number was already priced.

**Fails when.** When the surprise was already anticipated, so the gap is the whole move and there is nothing left to drift. It also fails badly when a beat comes with weak guidance: the headline number is good, the stock falls, and the strategy is long into a decline. Requiring the gap to agree with the surprise filters most but not all of those.

> ⚠ Needs an earnings calendar with both actual and estimated EPS. Finnhub provides this for US listings on its free tier; there is no free equivalent for Indian companies, so this is US-only.

*Markets: us · shape: single*

#### Crude inventory shock

Weekly petroleum stock figures are one of the few genuinely scheduled supply signals in commodities. A build larger than expected means more oil sitting in tanks than the market thought, which is bearish; a draw is the reverse. The reaction is fast and usually visible within minutes of the release.

**Works when.** The minutes after a genuinely surprising petroleum stock figure. It is one of very few scheduled, quantified supply signals in any market, so the reaction is fast and the direction is interpretable rather than guessed.

**Fails when.** When the inventory number is contradicted by something larger — an OPEC decision, a geopolitical event, a demand revision. Inventories describe supply only, and price is set by both sides. It also fails when the release has already leaked into the market through the private survey published the evening before.

> ⚠ Requires a free EIA_API_KEY, which is not currently configured, so this strategy has no data source in this app today.
> ⚠ Where no consensus estimate is available the comparison is week-on-week, which measures a CHANGE rather than a SURPRISE. Those are not the same signal and the weaker one is what you get.

*Markets: commodity · shape: single*

#### Perpetual funding carry (signal only) — *signal only, not executable*

A perpetual futures contract has no expiry, so exchanges use a funding payment every few hours to tether it to the spot price. When the perpetual trades above spot, longs pay shorts. A trader holding the asset on the spot market while shorting the perpetual is flat on price and collects that payment — a genuine carry, not a directional bet.

**Works when.** Periods when the perpetual trades persistently above spot, which is most of a bull market. The position is flat on price by construction and collects a payment every few hours, so the return comes from a mechanical transfer between traders rather than from a forecast being right.

**Fails when.** The trade is only market-neutral while both legs are held. Exchange risk, liquidation of the short leg during a violent rally, and the funding rate flipping negative are the real hazards — the profit is small and steady, which means the losses that matter are rare and large.

> ⚠ SIGNAL ONLY. The paper engine has no perpetual-futures instrument, so this cannot be traded here and will never open a position. It exists to make the funding rate readable, not to imply an executable strategy.

*Markets: crypto · shape: single*

---

## Options structures

All NIFTY/BANKNIFTY, European and cash-settled.

### Short straddle

Sell the at-the-money call and put together, collecting both premiums. The position profits when the underlying stays near the strike and implied volatility falls. It is a bet that the market is charging more for movement than movement will turn out to cost.

**Works when.** Quiet markets that have been pricing in movement they do not deliver — the gap between implied and realised volatility, which is positive more often than not because buyers of protection systematically overpay for it. Time works for the position every single day it is open, which is the only Greek with a certain direction.

**Fails when.** A large move in either direction. Losses are unbounded on the call side, and they arrive fastest exactly when volatility is rising, so the position is losing on direction and on vega at the same time. This is the structure that has ended the most retail accounts, and it wins most of the time right up until it does not.

> ⚠ UNLIMITED LOSS on the call side. The margin model here is an approximation, not SPAN, and a real broker will require more.
> ⚠ Wins frequently and loses rarely and enormously. A high win rate here is a property of the payoff shape, not evidence of skill.

### Iron condor

Sell an out-of-the-money call spread and an out-of-the-money put spread at once. The position profits if the underlying stays between the short strikes, and the bought wings cap the loss if it does not.

**Works when.** Range-bound markets, with a loss that is capped rather than unbounded. The bought wings are what make the position survivable: the same view expressed as a naked strangle has no ceiling, and the difference between those two is whether one bad week ends the account or costs a known amount.

**Fails when.** A move through either short strike. The maximum loss is typically several times the maximum gain, so a strategy that wins nine times in ten can still lose money over a year. Defined risk is not small risk.

> ⚠ Four legs means four spreads and four sets of charges to open, and again to close. In a thin chain those costs can exceed the credit.
> ⚠ Margin is computed PER LEG here. A real broker gives a spread benefit this simulator does not model, so the requirement shown is conservative.

### Gamma scalping

Buy an at-the-money straddle and trade the underlying against it as price moves. A long option gains delta in the direction of the move, so repeatedly flattening that delta banks each swing. The position is long gamma and short theta: it is paid by movement and charged by time.

**Works when.** Markets moving more than their options are priced for. It is the mirror of the straddle seller and the rarer opportunity, because implied volatility usually exceeds realised — when it does not, the position is paid by every swing and the rebalances bank movement the option price did not charge for.

**Fails when.** A quiet market. Theta is charged every day whatever happens, so a straddle bought before a week of calm loses steadily and the scalps never cover it. It also fails when implied volatility falls after entry — the position is long vega as well as long gamma.

> ⚠ THE HEDGING LEG IS NOT MODELLED. Real gamma scalping requires trading the underlying against the straddle; this simulator has no NIFTY spot instrument, so the rebalances are signalled and not executed. The result therefore shows the straddle alone, which is NOT the strategy.
> ⚠ Rebalancing frequently is what generates the profit and what generates the costs. A backtest that ignores those costs describes a strategy nobody can run.

### IV skew reversion

Out-of-the-money puts on an equity index almost always carry higher implied volatility than the equivalent calls, because the market pays up for crash protection. This sells the expensive wing and buys the cheap one when the gap between them widens beyond its usual level.

**Works when.** Periods when crash protection has become unusually expensive relative to upside — after a scare rather than during one. Selling the wing the market is crowding into is a genuine liquidity provision, and index skew does mean-revert once the fear that widened it fades.

**Fails when.** Precisely when the skew was right. The gap widens because the market is pricing a crash, and selling that protection immediately before one is how the trade loses many times what it collected. Skew is not usually mispriced — it is compensation for a real and asymmetric risk.

> ⚠ This is short the crash. The skew exists because index crashes are real and asymmetric, so most of the time the gap is a fair price rather than an error.
> ⚠ The short put leg carries large, though bounded, loss — the index can only fall to zero, which is not much comfort.

---

## Cons with no pros — deliberately not built

Listed in the app at `/strategies/unavailable`, with what each would take.

| | Why not |
|---|---|
| MVRV on-chain | No free API publishes it. ~$30/mo. |
| Order-book imbalance | Live depth is fetchable; historical L2 essentially does not exist. Runnable, never testable. |
| Triangular FX arbitrage | Needs tick bid/ask on three pairs. On delayed mid prices any "arbitrage" is a data artefact. |
| Dark pool sentiment | Paid institutional feed. |
| Fed statement NLP | The edge is milliseconds; a newswire feed is required. |
| FII/DII flows | NSE publishes them and blocks programmatic access (verified 403). |
| Calendar spreads | No futures curve — commodity tickers are spliced continuous front-month. |
| Options on real premiums | No free historical chain exists. The nightly snapshot is accumulating one. |

---

## Lessons with an explicit trade-off panel

11 lessons carry a pros/cons panel where a genuine decision is at stake:

- **Limit orders: naming your price** — `/learn/limit-orders`
- **Stops: deciding the loss in advance** — `/learn/stops`
- **Shorting and margin** — `/learn/shorting-and-margin`
- **Intraday or delivery: the choice that changes everything** — `/learn/intraday-vs-delivery`
- **Spreads: paying less by giving something up** — `/learn/spreads-and-combinations`
- **Hedging: the use case that actually holds up** — `/learn/hedging-with-options`
- **Index funds and ETFs: the boring answer that usually wins** — `/learn/etfs-and-index-funds`
- **Asset allocation: the decision that dominates the others** — `/learn/asset-allocation`
- **Sizing a system: from risk, never from conviction** — `/learn/systematic-sizing`
- **From paper to real money** — `/learn/paper-to-live`
- **Custody: not your keys, not your coins** — `/learn/custody-and-keys`

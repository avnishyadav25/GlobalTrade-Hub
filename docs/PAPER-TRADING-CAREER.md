# Starting a paper-trading career

The long-form version of the programme at [`/start`](../app/src/app/start/page.tsx).
Both are generated from the same `app/src/lib/learn/programme.ts`, so they cannot
drift apart — if a step changes there, it changes in both.

---

## What this is, and what it is not

It is five weeks of structured practice with a paper account, ending in a decision.
It is not a course in how to make money, because nobody can honestly sell you that,
and it is not a promise that five weeks is enough — it is enough to find out whether
you want to spend a year on this.

Of the 18 steps, **12 are checked against your actual paper ledger**.
You cannot tick those off; the engine has to see you do them. The other
**6 are self-marked**, because no ledger can confirm that you wrote your rules
down or read your own journal honestly. Those are labelled as self-marked everywhere
they appear, because "the engine saw this" and "you told me this" are different
claims and should never look alike.

> **Before anything else.** Paper trading has one failure mode that matters: it does
> not test how you behave when the money is real. Everything below is designed to
> narrow the gap — real charges, real rejections, a real record — but the gap does not
> close, and the first live months are where you measure it.

---

## Week 1 — The machine

**The aim.** Learn what the buttons do, on positions small enough that nothing you learn is expensive.

**What goes wrong here.** Trying to make money in week one. You are learning where the controls are; a profit here teaches you nothing repeatable and a loss teaches you the wrong lesson.

### Watch three instruments in different markets
*checked against your account*

A crypto tick, an Indian equity and a currency pair behave nothing alike. Seeing that before trading stops you carrying one market’s habits into another.

Read: `/learn/what-you-are-looking-at`

### Place your first market order
*checked against your account*

The whole loop in one action: choose an instrument, choose a size, and watch what it costs.

Read: `/learn/your-first-order`

### Close it, and look at what you actually kept
*checked against your account*

Opening is the easy half. The number that matters appears only when a position is closed, after charges.

Read: `/learn/closing-a-trade`

### Rest a limit order that does not fill immediately
*checked against your account*

A limit that sits unfilled is the point of the exercise. You are buying price certainty with execution uncertainty, and feeling that trade-off is worth more than reading it.

Read: `/learn/limit-orders`

### Write down why you took each trade — before you take it
*self-marked*

One sentence per trade, written first. This is the only record that cannot be rewritten afterwards, and by month three it is the most valuable thing you own.

Read: `/learn/journal-and-discipline`

---

## Week 2 — What it costs

**The aim.** Find out what your trading actually costs, before you have an opinion about whether it works.

**What goes wrong here.** Assuming costs are small because each one is small. At 200 round trips a year, 8 basis points is 16% — larger than most edges.

### Pay a real charge and read it itemised
*checked against your account*

Not one blended "fees" line. Brokerage, STT, exchange fee, SEBI fee, stamp duty and GST are different things with different rules, and the differences decide which strategies survive.

Read: `/learn/fees-and-slippage`

### Trade something priced in another currency
*checked against your account*

Your return then has two parts, and only one of them was your idea. Knowing which half you were right about is what makes the record useful.

Read: `/learn/currency-and-fx`

### Work out your own annual cost drag
*self-marked*

Trades per year times cost per round trip. Do it with your own numbers rather than reading mine — an edge that survives on paper and dies live usually died here.

Read: `/learn/costs-in-backtests`

---

## Week 3 — A rule you can state

**The aim.** Convert whatever you have been doing by instinct into something specific enough to be wrong.

**What goes wrong here.** Writing a rule loose enough that it can never be violated. "Buy when the trend is strong" is not a rule; it is a mood.

### Decide the loss before you enter, and place the stop
*checked against your account*

A stop in your head is a preference. A stop in the book is a decision you have already made, taken while you were calm.

Read: `/learn/stops`

### Size a position from risk rather than from conviction
*checked against your account*

Conviction is highest exactly when you are most likely to be wrong about something. Sizing from the stop distance takes the feeling out of it.

Read: `/learn/position-sizing`

### Write your strategy down: entry, sizing, exit, universe, costs
*self-marked*

All five, or it is not testable. Then write what would make you abandon it — decided now, while nothing is at stake, because it cannot be decided honestly during a drawdown.

Read: `/learn/hypothesis-to-rules`

### Run your idea against buy-and-hold
*self-marked*

Not to see whether it made money — to see whether it beat doing nothing, which is the only comparison that means anything.

Read: `/learn/overfitting`

---

## Week 4 — Enough trades to mean something

**The aim.** Build a sample. Until you have one, every conclusion you draw about yourself is noise.

**What goes wrong here.** Concluding anything from ten trades. A 50% strategy produces eight losses in a row often enough that you will meet one, and most people quit inside it.

### Build a record of at least 20 closed round trips
*checked against your account*

Thirty is where ratios start to mean anything; twenty is where the shape of your own behaviour becomes visible. This app withholds statistics below that threshold for the same reason.

Read: `/learn/risk-of-ruin`

### Take a planned loss and let the stop do its job
*checked against your account*

A stop you move is not a stop. The first time you leave one alone is the moment the process becomes real.

Read: `/learn/stops`

### Take one short position
*checked against your account*

Not because shorting is a good idea, but because half of what happens in markets is invisible if you have only ever been long.

Read: `/learn/shorting-and-margin`

---

## Week 5 — The honest review

**The aim.** Find out what your record actually says — including the parts you would rather it did not.

**What goes wrong here.** Reading the equity curve and stopping there. The curve is the outcome; the average win against the average loss is the behaviour, and behaviour is what you can change.

### Let a rule stop you from doing something
*checked against your account*

A rule that has never refused you has never been tested. This is the one step where being blocked is the pass condition.

Read: `/learn/rules-that-bind`

### Compare your average win against your average loss
*self-marked*

If the average win is smaller, you are cutting winners and holding losers — the disposition effect, measured in your own numbers rather than described in a textbook.

Read: `/learn/behavioural-biases`

### Decide, in writing, whether to continue
*self-marked*

The three honest answers are keep going, change one thing, or stop. Most people never write the third one down, which is why they never choose it.

Read: `/learn/paper-to-live`

---

## After the five weeks

### What a realistic first year looks like

Most of it is unremarkable. A few trades that work for reasons you did not predict, a
few that fail for reasons you did, and a long middle where nothing much happens and
the temptation is to trade more to make something happen. That temptation is the
single most expensive thing in the first year, and it is not a knowledge problem.

Expect a losing streak of six to eight trades. A strategy that wins half the time
produces one reasonably often across a few hundred trades — it is ordinary, not a
signal, and most people quit inside one.

### Why the record matters more than the returns

Five weeks of returns tell you almost nothing: the sample is too small and the market
regime is one. Five weeks of *written reasoning* tells you a great deal — whether your
stated reason for entering matches what you actually did, whether you sized
consistently, whether you moved a stop.

That is why the reflective steps are in the programme at all. A version that only
counted what the ledger could count would have been stricter and worse, because it
would have quietly taught that only countable things matter.

### When to stop

Three honest answers at the end of week five: keep going, change one thing, or stop.
Most people never write the third down, which is why they never choose it.

Stopping is a reasonable outcome. SEBI's own published studies have repeatedly found
that around nine in ten individual derivatives traders lose money, and index investing
over the same periods did not. If you finish these five weeks and find you did not
enjoy the process — not the outcome, the process — that is a genuine finding, arrived
at for the price of some simulated money.

### If you continue

The next things worth your time, in order: `/learn` for the tracks matching what you
actually trade, `/backtest/walk-forward` to test whether a rule survives out of
sample, and `/backtest/portfolio` to find out whether your positions are as
diversified as you think. Then `docs/USER-ACCEPTANCE.md`, which tells you how to
check that this app is telling you the truth.

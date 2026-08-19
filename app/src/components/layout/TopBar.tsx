'use client';

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Sun, Moon, Settings, Menu, X } from 'lucide-react';
import { NAV_SECTIONS, sectionForPath } from '@/lib/constants';
import { useMarketStore } from '@/stores/marketStore';

export function TopBar() {
    const pathname = usePathname();
    const router = useRouter();
    const { resolvedTheme, setTheme } = useTheme();
    const [menuOpen, setMenuOpen] = useState(false);
    // The badge was hardcoded green while `usingRealFeed` — the one signal that could
    // make it truthful — was read by nothing. It stayed lit even when the feed failed.
    const usingRealFeed = useMarketStore((s) => s.usingRealFeed);
    const feedStatus = useMarketStore((s) => s.feedStatus);
    // Aggregate honestly: "LIVE" only when nothing is delayed or simulated.
    const states = Object.values(feedStatus).map((f) => f.state);
    const anyDelayed = states.includes('delayed');
    const anySim = states.includes('sim') || (!usingRealFeed && states.length === 0);
    const label = anySim ? 'SIM' : anyDelayed ? 'DELAYED' : usingRealFeed || states.length ? 'LIVE' : 'SIM';
    const tone = label === 'LIVE' ? 'up' : label === 'DELAYED' ? 'warn' : 'muted';
    const breakdown = Object.entries(feedStatus)
        .map(([m, f]) => `${m}: ${f.provider} (${f.state}${f.delayMinutes ? ` ~${f.delayMinutes}m` : ''})`)
        .join('\n') || 'crypto: binance (live)';

    const active = sectionForPath(pathname ?? '');
    const isActive = (href: string) => active?.href === href;

    return (
        <div className="flex flex-shrink-0 flex-col border-b border-border bg-panel">
        <header className="relative flex h-14 items-center justify-between px-5">
            <div className="flex items-center gap-3 md:gap-6">
                {/* Below md the nav was simply hidden with no alternative, leaving six
                    of the seven sections unreachable except by typing a URL. */}
                <button
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-label="Menu"
                    aria-expanded={menuOpen}
                    className="rounded-lg p-1.5 text-foreground-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] md:hidden"
                >
                    {menuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
                {/* Brand */}
                <Link href="/terminal" className="flex items-center gap-2.5">
                    <div className="gradient-brand flex h-7 w-7 items-center justify-center rounded-sm text-base font-bold text-white">
                        G
                    </div>
                    <span className="text-lg font-bold tracking-tight">
                        GlobalTrade<span className="text-accent"> Hub</span>
                    </span>
                </Link>

                {/* Section nav */}
                <nav className="hidden items-center gap-1 md:flex">
                    {NAV_SECTIONS.map((s) => (
                        <Link
                            key={s.key}
                            href={s.href}
                            className={`rounded-lg px-3.5 py-1.5 text-base font-semibold transition-colors ${
                                isActive(s.href)
                                    ? 'bg-chip text-foreground'
                                    : 'text-foreground-muted hover:text-foreground'
                            }`}
                        >
                            {s.label}
                        </Link>
                    ))}
                </nav>
            </div>

            {menuOpen && (
                <nav className="absolute left-0 right-0 top-14 z-50 flex flex-col border-b border-border bg-panel p-2 shadow-lg md:hidden">
                    {NAV_SECTIONS.map((s) => (
                        <Link
                            key={s.key}
                            href={s.href}
                            onClick={() => setMenuOpen(false)}
                            className={`rounded-lg px-3.5 py-2.5 text-md font-semibold ${
                                isActive(s.href) ? 'bg-chip text-foreground' : 'text-foreground-muted'
                            }`}
                        >
                            {s.label}
                        </Link>
                    ))}
                </nav>
            )}

            <div className="flex items-center gap-3">
                {/* Search */}
                <button
                    onClick={() => router.push('/scanner')}
                    className="hidden w-[180px] items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-base text-faint hover:border-border-hover lg:flex"
                >
                    <Search size={14} />
                    <span>Search markets</span>
                </button>

                {/* Feed indicator — reflects the actual source. */}
                <div
                    className={`flex items-center gap-1.5 rounded-sm border px-2.5 py-1 ${
                        tone === 'up' ? 'border-up/30 bg-up-dim' : tone === 'warn' ? 'border-warn/30 bg-warn-dim' : 'border-border bg-chip'
                    }`}
                    title={`Feed by market —\n${breakdown}`}
                >
                    <span
                        className={`h-[7px] w-[7px] rounded-full ${tone === 'up' ? 'bg-up pulse-live' : tone === 'warn' ? 'bg-warn' : ''}`}
                        style={tone === 'muted' ? { background: 'var(--faint)' } : undefined}
                    />
                    <span
                        className="text-xs font-semibold tracking-wide"
                        style={{ color: tone === 'up' ? 'var(--up)' : tone === 'warn' ? 'var(--warn)' : 'var(--foreground-muted)' }}
                    >
                        {label}
                    </span>
                </div>

                {/* Theme toggle */}
                <button
                    onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border bg-chip text-foreground-muted transition-colors hover:text-foreground"
                    title="Toggle theme"
                    aria-label="Toggle theme"
                >
                    {/* CSS-driven so there's no hydration mismatch or effect setState */}
                    <Sun size={15} className="hidden dark:block" />
                    <Moon size={15} className="block dark:hidden" />
                </button>

                {/* Settings */}
                <Link
                    href="/settings"
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border bg-chip text-foreground-muted transition-colors hover:text-foreground"
                    aria-label="Settings"
                >
                    <Settings size={15} />
                </Link>

                {/* Avatar */}
                <div className="flex h-[33px] w-[33px] items-center justify-center rounded-full bg-accent text-base font-bold text-[color:var(--cp-text)]">
                    GT
                </div>
            </div>
        </header>

            {/* Sub-nav for the active section, in flow so it never overlays content. */}
            {active?.children && (
                <nav aria-label={`${active.label} sections`} className="hidden items-center gap-1 border-t border-border2 px-5 py-1.5 md:flex">
                    {active.children.map((c) => (
                        <Link
                            key={c.key}
                            href={c.href}
                            className={`rounded-sm px-2.5 py-1 text-sm font-medium transition-colors ${
                                pathname === c.href ? 'bg-chip text-foreground' : 'text-foreground-muted hover:text-foreground'
                            }`}
                        >
                            {c.label}
                        </Link>
                    ))}
                </nav>
            )}
        </div>
    );
}

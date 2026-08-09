'use client';

import { useTheme } from 'next-themes';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, Sun, Moon, Settings } from 'lucide-react';
import { NAV_SECTIONS } from '@/lib/constants';

export function TopBar() {
    const pathname = usePathname();
    const router = useRouter();
    const { resolvedTheme, setTheme } = useTheme();

    const isActive = (href: string) =>
        pathname === href || (href !== '/' && pathname?.startsWith(href));

    return (
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-panel px-5">
            <div className="flex items-center gap-6">
                {/* Brand */}
                <Link href="/terminal" className="flex items-center gap-2.5">
                    <div className="gradient-brand flex h-7 w-7 items-center justify-center rounded-[7px] text-base font-extrabold text-white">
                        G
                    </div>
                    <span className="text-[15px] font-extrabold tracking-tight">
                        GlobalTrade<span className="text-accent"> Hub</span>
                    </span>
                </Link>

                {/* Section nav */}
                <nav className="hidden items-center gap-0.5 md:flex">
                    {NAV_SECTIONS.map((s) => (
                        <Link
                            key={s.key}
                            href={s.href}
                            className={`rounded-lg px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors ${
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

            <div className="flex items-center gap-3">
                {/* Search */}
                <button
                    onClick={() => router.push('/scanner')}
                    className="hidden w-[180px] items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] text-faint hover:border-border-hover lg:flex"
                >
                    <Search size={14} />
                    <span>Search markets</span>
                </button>

                {/* LIVE indicator */}
                <div className="flex items-center gap-1.5 rounded-lg border border-up/30 bg-up/10 px-2.5 py-1.5">
                    <span className="h-[7px] w-[7px] rounded-full bg-up pulse-live" style={{ boxShadow: '0 0 8px var(--up)' }} />
                    <span className="text-[12px] font-bold tracking-wide text-up">LIVE</span>
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
                <div className="flex h-[33px] w-[33px] items-center justify-center rounded-full bg-accent text-[13px] font-bold text-[color:var(--cp-text)]">
                    GT
                </div>
            </div>
        </header>
    );
}

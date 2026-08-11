'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CircleHelp } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/controls';
import { coachTopic } from '@/lib/learn/topics';
import { lessonBySlug } from '@/lib/learn/curriculum';
import { Rich } from '@/lib/learn/render';
import { useVerifyContext } from '@/lib/learn/progress';
import { useLearnStore } from '@/stores/learnStore';

/**
 * The "?" that explains the screen you are on.
 *
 * Each card can render a live figure from the user's own account, which is the whole
 * point — "equity is cash plus the market value of what you hold" lands differently
 * next to your own ₹4,79,349.
 *
 * Imports reach into the individual UI files rather than the `@/components/ui` barrel
 * because PageShell is exported from that barrel and renders this component.
 */
export function CoachMark({ topic, className = '' }: { topic: string; className?: string }) {
    const [open, setOpen] = useState(false);
    const seenAt = useLearnStore((s) => s.seenCoachMarks[topic]);
    const markCoachSeen = useLearnStore((s) => s.markCoachSeen);
    const ctx = useVerifyContext();

    const t = coachTopic(topic);
    if (!t) return null;

    const lesson = t.lesson ? lessonBySlug(t.lesson) : undefined;

    const show = () => {
        setOpen(true);
        markCoachSeen(topic);
    };

    return (
        <>
            <span className={`relative inline-flex ${className}`}>
                <IconButton label={`What is this screen? — ${t.title}`} onClick={show}>
                    <CircleHelp size={15} />
                </IconButton>
                {/* A quiet dot until it has been opened once — an invitation, not a nag. */}
                {!seenAt && (
                    <span
                        aria-hidden
                        className="pointer-events-none absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent"
                    />
                )}
            </span>

            <Sheet open={open} onClose={() => setOpen(false)} title={t.title} width={480}>
                <p className="mb-4 text-sm text-foreground-muted">{t.blurb}</p>

                <div className="flex flex-col gap-3">
                    {t.cards.map((card) => {
                        const value = card.value?.(ctx) ?? null;
                        return (
                            <section key={card.title} className="rounded-sm border border-border2 bg-panel2 p-3">
                                <h3 className="mb-1.5 text-sm font-semibold">{card.title}</h3>
                                <Rich text={card.body} className="text-sm text-foreground-muted" />
                                {value && (
                                    <p className="mono mt-2 border-t border-border2 pt-2 text-xs text-accent">{value}</p>
                                )}
                            </section>
                        );
                    })}
                </div>

                {lesson && (
                    <Link
                        href={`/learn/${lesson.slug}`}
                        onClick={() => setOpen(false)}
                        className="mt-4 flex items-center justify-between rounded-sm border border-border bg-panel2 p-3 transition-colors hover:border-accent"
                    >
                        <span>
                            <span className="block text-2xs font-bold tracking-wide text-faint">FULL LESSON</span>
                            <span className="block text-sm font-semibold">{lesson.title}</span>
                        </span>
                        <span className="text-xs text-faint">{lesson.minutes} min →</span>
                    </Link>
                )}
            </Sheet>
        </>
    );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronUp, GraduationCap, X } from 'lucide-react';
import { useCourseProgress } from '@/lib/learn/progress';
import { useLearnStore } from '@/stores/learnStore';
import { Rich } from '@/lib/learn/render';

/**
 * The step-by-step companion.
 *
 * It follows you across the app showing the next lesson's exercise and what is still
 * missing — and it ticks itself off the moment you actually do the thing, because the
 * text comes from the same engine-state verifier the lesson uses. There is no "mark
 * done" anywhere in this component.
 */
export function GuideBar() {
    const pathname = usePathname();
    const enabled = useLearnStore((s) => s.guideEnabled);
    const collapsed = useLearnStore((s) => s.guideCollapsed);
    const setCollapsed = useLearnStore((s) => s.setGuideCollapsed);
    const setEnabled = useLearnStore((s) => s.setGuideEnabled);
    const skipLesson = useLearnStore((s) => s.skipLesson);
    const progress = useCourseProgress();

    // Never over the auth screens, and never on top of the lesson it is describing.
    const hidden = !enabled || pathname.startsWith('/auth') || pathname.startsWith('/learn');
    if (hidden) return null;

    const next = progress.next;

    if (!next) {
        return (
            <div className="pointer-events-auto fixed bottom-4 right-4 z-40">
                <Link
                    href="/learn"
                    className="flex items-center gap-2 rounded-full border border-border bg-panel px-3.5 py-2 text-xs font-semibold shadow-elev-2 hover:border-accent"
                >
                    <GraduationCap size={14} className="text-up" />
                    All {progress.total} lessons complete
                </Link>
            </div>
        );
    }

    if (collapsed) {
        return (
            <div className="pointer-events-auto fixed bottom-4 right-4 z-40">
                <button
                    onClick={() => setCollapsed(false)}
                    className="flex items-center gap-2 rounded-full border border-border bg-panel px-3.5 py-2 text-xs font-semibold shadow-elev-2 hover:border-accent"
                >
                    <GraduationCap size={14} className="text-accent" />
                    Lesson {progress.lessons.indexOf(next) + 1} of {progress.total}
                    <ChevronUp size={14} className="text-faint" />
                </button>
            </div>
        );
    }

    const { lesson, result } = next;

    return (
        <aside
            aria-label="Learning guide"
            className="pointer-events-auto fixed bottom-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-md border border-border bg-panel shadow-elev-3"
        >
            <header className="flex items-center justify-between gap-2 border-b border-border2 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                    <GraduationCap size={14} className="shrink-0 text-accent" />
                    <span className="truncate text-2xs font-bold tracking-wide text-faint">
                        LESSON {progress.lessons.indexOf(next) + 1} OF {progress.total}
                    </span>
                </span>
                <span className="flex shrink-0 items-center gap-0.5">
                    <button
                        onClick={() => setCollapsed(true)}
                        aria-label="Collapse guide"
                        className="rounded-xs p-1 text-faint hover:text-foreground"
                    >
                        <ChevronDown size={14} />
                    </button>
                    <button
                        onClick={() => setEnabled(false)}
                        aria-label="Turn off the guide"
                        title="Turn off the guide (re-enable it on Learn)"
                        className="rounded-xs p-1 text-faint hover:text-foreground"
                    >
                        <X size={14} />
                    </button>
                </span>
            </header>

            <div className="px-3 py-2.5">
                <Link href={`/learn/${lesson.slug}`} className="text-sm font-semibold hover:text-accent">
                    {lesson.title}
                </Link>
                <p className="mt-1 text-xs font-semibold text-foreground-muted">{lesson.exercise.title}</p>

                {/* Straight from the verifier, so it always reflects reality. */}
                <Rich text={result.hint} className="mt-1.5 text-xs text-faint" />

                {result.progress != null && result.progress > 0 && (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-chip">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(result.progress * 100)}%` }} />
                    </div>
                )}

                {next.missingPrereqs.length > 0 && (
                    <p className="mt-2 text-2xs text-faint">
                        Worth doing first: {next.missingPrereqs.map((l) => l.title).join(', ')}
                    </p>
                )}
            </div>

            <footer className="flex items-center gap-2 border-t border-border2 px-3 py-2">
                <Link
                    href={lesson.where.href}
                    className="rounded-sm bg-accent px-2.5 py-1.5 text-xs font-semibold text-[color:var(--cp-text)] hover:opacity-90"
                >
                    {lesson.where.label} →
                </Link>
                <Link href={`/learn/${lesson.slug}`} className="text-xs text-foreground-muted hover:text-foreground">
                    Read it
                </Link>
                <button
                    onClick={() => skipLesson(lesson.slug)}
                    className="ml-auto text-xs text-faint hover:text-foreground"
                >
                    Skip
                </button>
            </footer>
        </aside>
    );
}

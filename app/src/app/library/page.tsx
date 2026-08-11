'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { PageShell, Panel, Badge, Input, SegmentedControl, EmptyState } from '@/components/ui';
import { libraryItems, LIBRARY_KINDS, type LibraryItem } from '@/lib/learn/library';
import { PATHS, resolvePath } from '@/lib/learn/paths';

const KIND_LABEL: Record<string, string> = {
    book: 'Book', course: 'Course', video: 'Video', article: 'Read',
    regulator: 'Official', tool: 'Tool', dataset: 'Data',
};

const REGION_LABEL: Record<string, string> = { india: 'India', us: 'US', global: 'Global' };

function ItemRow({ item }: { item: LibraryItem }) {
    const body = (
        <>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-sm font-semibold">{item.title}</span>
                {item.by && <span className="text-xs text-foreground-muted">{item.by}</span>}
                <Badge>{KIND_LABEL[item.kind] ?? item.kind}</Badge>
                <Badge>{REGION_LABEL[item.region]}</Badge>
                {item.url && <ExternalLink size={11} className="text-faint" />}
            </div>
            <p className="mt-1 text-xs text-foreground-muted">{item.why}</p>
            {item.citedBy?.length ? (
                <p className="mt-1.5 text-2xs text-faint">
                    Cited by {item.citedBy.length} lesson{item.citedBy.length === 1 ? '' : 's'}
                </p>
            ) : null}
        </>
    );

    // Books deliberately have no URL — a citation cannot rot. Render them as plain rows
    // rather than as links that go nowhere.
    return item.url ? (
        <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="panel block p-3.5 transition-colors hover:border-accent"
        >
            {body}
        </a>
    ) : (
        <div className="panel p-3.5">{body}</div>
    );
}

export default function LibraryPage() {
    const items = useMemo(() => libraryItems(), []);
    const [query, setQuery] = useState('');
    const [kind, setKind] = useState<string>('all');
    const [region, setRegion] = useState<string>('all');
    const [tab, setTab] = useState<'paths' | 'all'>('paths');

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter((i) => {
            if (kind !== 'all' && i.kind !== kind) return false;
            if (region !== 'all' && i.region !== region) return false;
            if (!q) return true;
            return (
                i.title.toLowerCase().includes(q) ||
                (i.by ?? '').toLowerCase().includes(q) ||
                i.why.toLowerCase().includes(q) ||
                i.topics.join(' ').toLowerCase().includes(q)
            );
        });
    }, [items, query, kind, region]);

    const withUrl = items.filter((i) => i.url).length;

    return (
        <PageShell
            title="Library"
            subtitle="Books, courses, videos and primary sources behind the curriculum. Every link here has been fetched and confirmed reachable; books carry no link on purpose, because a citation cannot rot."
            actions={
                <SegmentedControl
                    label="View"
                    size="sm"
                    value={tab}
                    onChange={setTab}
                    options={[{ value: 'paths', label: 'Reading paths' }, { value: 'all', label: `All ${items.length}` }]}
                />
            }
        >
            {tab === 'paths' ? (
                <div className="flex flex-col gap-5">
                    <p className="text-xs text-faint">
                        {PATHS.length} paths. A path is an ordered route through the{' '}
                        <Link href="/learn" className="text-accent underline underline-offset-2">course</Link> and these
                        resources, aimed at one question — because &ldquo;what exists&rdquo; is a less useful answer than
                        &ldquo;where do I start&rdquo;.
                    </p>

                    {PATHS.map((path) => {
                        const steps = resolvePath(path);
                        return (
                            <Panel key={path.id}>
                                <h2 className="text-sm font-semibold">{path.title}</h2>
                                <p className="mt-0.5 text-xs text-foreground-muted">{path.blurb}</p>
                                <p className="mt-1 text-2xs text-faint">{path.forWhom}</p>

                                <ol className="mt-3 flex flex-col gap-1.5 border-t border-border2 pt-3">
                                    {steps.map((step, i) => (
                                        <li key={step.ref} className="flex gap-2.5">
                                            <span className="mono w-5 shrink-0 pt-0.5 text-2xs text-faint">{i + 1}</span>
                                            <div className="min-w-0">
                                                {step.lesson ? (
                                                    <Link
                                                        href={`/learn/${step.lesson.slug}`}
                                                        className="text-xs font-semibold hover:text-accent"
                                                    >
                                                        {step.lesson.title}
                                                    </Link>
                                                ) : step.item?.url ? (
                                                    <a
                                                        href={step.item.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs font-semibold hover:text-accent"
                                                    >
                                                        {step.item.title}
                                                        <ExternalLink size={10} className="text-faint" />
                                                    </a>
                                                ) : (
                                                    <span className="text-xs font-semibold">
                                                        {step.item?.title}
                                                        {step.item?.by && (
                                                            <span className="ml-1.5 font-normal text-foreground-muted">
                                                                {step.item.by}
                                                            </span>
                                                        )}
                                                    </span>
                                                )}
                                                {step.note && <p className="text-2xs text-faint">{step.note}</p>}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </Panel>
                        );
                    })}
                </div>
            ) : (
                <>
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                        <div className="min-w-[200px] flex-1">
                            <Input placeholder="Search the library…" value={query} onChange={(e) => setQuery(e.target.value)} />
                        </div>
                        <SegmentedControl
                            label="Region"
                            size="sm"
                            value={region}
                            onChange={setRegion}
                            options={[
                                { value: 'all', label: 'All' },
                                { value: 'india', label: 'India' },
                                { value: 'us', label: 'US' },
                                { value: 'global', label: 'Global' },
                            ]}
                        />
                    </div>

                    <div className="mb-4 flex flex-wrap gap-1.5">
                        {['all', ...LIBRARY_KINDS].map((k) => (
                            <button
                                key={k}
                                onClick={() => setKind(k)}
                                className={`rounded-sm border px-2.5 py-1 text-2xs font-semibold transition-colors ${
                                    kind === k
                                        ? 'border-accent text-accent'
                                        : 'border-border text-foreground-muted hover:border-accent'
                                }`}
                            >
                                {k === 'all' ? 'Everything' : (KIND_LABEL[k] ?? k)}
                            </button>
                        ))}
                    </div>

                    <p className="mb-3 text-xs text-faint">
                        {matches.length} of {items.length} · {withUrl} carry a verified link · {items.length - withUrl} are
                        books, cited without one
                    </p>

                    <div className="flex flex-col gap-2">
                        {matches.map((i) => <ItemRow key={i.id} item={i} />)}
                    </div>

                    {matches.length === 0 && (
                        <EmptyState title="Nothing matches that" body="Try a broader search, or clear the filters." />
                    )}
                </>
            )}
        </PageShell>
    );
}

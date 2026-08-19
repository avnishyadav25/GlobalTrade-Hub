'use client';

import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { parseBlocks, parseInline, type InlineToken } from './markdownLite';

// Renders the markdown-lite parsed by ./markdownLite.
//
// The previous renderer was a ten-line local function inside /learn/[slug] that
// handled `**bold**` and nothing else — so a lesson could not link to the screen it
// was describing, list anything, or show a symbol as code. Parsing lives in a plain
// module so it can be unit-tested; this file only turns tokens into elements.

function Tokens({ tokens }: { tokens: InlineToken[] }): ReactNode {
    return (
        <>
            {tokens.map((t, i) => {
                switch (t.kind) {
                    case 'bold':
                        return <strong key={i} className="font-semibold text-foreground">{t.text}</strong>;
                    case 'code':
                        return (
                            <code key={i} className="mono rounded-xs bg-chip px-1 py-0.5 text-[0.9em]">
                                {t.text}
                            </code>
                        );
                    case 'link':
                        return t.external ? (
                            <a
                                key={i}
                                href={t.href}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="text-accent underline underline-offset-2 hover:opacity-80"
                            >
                                {t.text}
                                <span aria-hidden> ↗</span>
                            </a>
                        ) : (
                            <Link key={i} href={t.href} className="text-accent underline underline-offset-2 hover:opacity-80">
                                {t.text}
                            </Link>
                        );
                    default:
                        return <Fragment key={i}>{t.text}</Fragment>;
                }
            })}
        </>
    );
}

/** Inline formatting only — no block elements. */
export function Inline({ text }: { text: string }) {
    return <Tokens tokens={parseInline(text)} />;
}

/** Block-level rendering: paragraphs, bullet lists and callout lines. */
export function Rich({ text, className = '' }: { text: string; className?: string }) {
    return (
        <div className={`space-y-2 ${className}`}>
            {parseBlocks(text).map((block, i) => {
                if (block.kind === 'ul') {
                    return (
                        <ul key={i} className="ml-4 list-disc space-y-1">
                            {block.items.map((item, j) => (
                                <li key={j}>
                                    <Tokens tokens={item} />
                                </li>
                            ))}
                        </ul>
                    );
                }
                if (block.kind === 'quote') {
                    return (
                        <p key={i} className="border-l-2 border-accent pl-3 text-foreground-muted">
                            <Tokens tokens={block.content} />
                        </p>
                    );
                }
                return (
                    <p key={i}>
                        <Tokens tokens={block.content} />
                    </p>
                );
            })}
        </div>
    );
}

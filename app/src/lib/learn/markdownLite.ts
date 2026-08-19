// The parser behind lesson prose and coach marks, split out from the JSX so it can
// be tested without a DOM.
//
// Deliberately tiny: four inline constructs and three block ones. A markdown
// dependency for this would be more code than the feature.

export type InlineToken =
    | { kind: 'text'; text: string }
    | { kind: 'bold'; text: string }
    | { kind: 'code'; text: string }
    | { kind: 'link'; text: string; href: string; external: boolean };

export type Block =
    | { kind: 'p'; content: InlineToken[] }
    | { kind: 'quote'; content: InlineToken[] }
    | { kind: 'ul'; items: InlineToken[][] };

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;

export function parseInline(text: string): InlineToken[] {
    const out: InlineToken[] = [];
    for (const part of text.split(INLINE)) {
        if (!part) continue;
        if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
            out.push({ kind: 'bold', text: part.slice(2, -2) });
            continue;
        }
        if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
            out.push({ kind: 'code', text: part.slice(1, -1) });
            continue;
        }
        const link = LINK.exec(part);
        if (link) {
            const [, label, href] = link;
            // Internal routes keep client-side navigation; anything else leaves the app.
            out.push({ kind: 'link', text: label, href, external: !href.startsWith('/') });
            continue;
        }
        out.push({ kind: 'text', text: part });
    }
    return out;
}

export function parseBlocks(text: string): Block[] {
    const blocks: Block[] = [];
    let bullets: InlineToken[][] = [];

    const flush = () => {
        if (!bullets.length) return;
        blocks.push({ kind: 'ul', items: bullets });
        bullets = [];
    };

    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (line.startsWith('- ')) {
            bullets.push(parseInline(line.slice(2)));
            continue;
        }
        flush();
        if (!line) continue;
        if (line.startsWith('> ')) {
            blocks.push({ kind: 'quote', content: parseInline(line.slice(2)) });
            continue;
        }
        blocks.push({ kind: 'p', content: parseInline(line) });
    }
    flush();

    return blocks;
}

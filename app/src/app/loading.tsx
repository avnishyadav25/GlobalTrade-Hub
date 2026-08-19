export default function Loading() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <div className="flex items-center gap-3 text-base text-faint">
                <span className="h-3 w-3 animate-pulse rounded-full" style={{ background: 'var(--accent)' }} />
                Loading…
            </div>
        </div>
    );
}

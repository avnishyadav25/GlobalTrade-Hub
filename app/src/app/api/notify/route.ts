import { NextResponse } from 'next/server';
import { notify, configuredChannels } from '@/lib/notify';
import { requireAdmin } from '@/lib/auth';

export const runtime = 'nodejs';

// Both verbs are admin-only: POST sends real messages through the owner's
// Telegram/Resend/Twilio accounts, and GET discloses which channels are configured.

export async function GET(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    return NextResponse.json({ channels: configuredChannels() });
}

export async function POST(req: Request) {
    if (!(await requireAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    let body: { text?: string; subject?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    const text = body.text?.trim();
    if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });

    const channels = configuredChannels();
    if (channels.length === 0) {
        return NextResponse.json({ sent: [], channels: [], message: 'No channels configured. Add Telegram/Email/WhatsApp env vars.' });
    }
    const sent = await notify(text, body.subject);
    return NextResponse.json({ sent, channels });
}

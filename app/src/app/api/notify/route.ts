import { NextResponse } from 'next/server';
import { notify, configuredChannels } from '@/lib/notify';

export const runtime = 'nodejs';

export async function GET() {
    return NextResponse.json({ channels: configuredChannels() });
}

export async function POST(req: Request) {
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

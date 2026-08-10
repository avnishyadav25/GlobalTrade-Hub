import 'server-only';

// Unified notification fan-out. Channels self-enable when their env is set.
// Priority: Telegram → Email → WhatsApp.

import { sendTelegram } from './telegram';
import { sendEmail } from './email';
import { sendWhatsApp } from './whatsapp';

export interface NotifyResult {
    channel: string;
    ok: boolean;
    detail?: string;
}

export async function notify(text: string, subject = 'GlobalTrade Hub'): Promise<NotifyResult[]> {
    const results: NotifyResult[] = [];
    for (const fn of [
        () => sendTelegram(text),
        () => sendEmail(subject, text),
        () => sendWhatsApp(text),
    ]) {
        try {
            const r = await fn();
            if (r) results.push(r);
        } catch (e) {
            results.push({ channel: 'unknown', ok: false, detail: String(e) });
        }
    }
    return results;
}

export function configuredChannels(): string[] {
    const ch: string[] = [];
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) ch.push('telegram');
    if (process.env.RESEND_API_KEY || process.env.SMTP_HOST) ch.push('email');
    if (process.env.TWILIO_ACCOUNT_SID || process.env.WHATSAPP_TOKEN) ch.push('whatsapp');
    return ch;
}

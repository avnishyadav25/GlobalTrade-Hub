import 'server-only';
import type { NotifyResult } from './index';

// WhatsApp via Twilio (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_FROM + WHATSAPP_TO).
// Requires an approved Twilio WhatsApp sender (or sandbox). Meta Cloud API can be added similarly.
export async function sendWhatsApp(text: string): Promise<NotifyResult | null> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. whatsapp:+14155238886
    const to = process.env.WHATSAPP_TO;            // e.g. whatsapp:+91XXXXXXXXXX
    if (!sid || !token || !from || !to) return null;

    const body = new URLSearchParams({ From: from, To: to, Body: text });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        },
        body,
    });
    return { channel: 'whatsapp', ok: res.ok, detail: res.ok ? undefined : `HTTP ${res.status}` };
}

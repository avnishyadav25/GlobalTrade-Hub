import 'server-only';
import type { NotifyResult } from './index';

// Email via Resend (RESEND_API_KEY + EMAIL_FROM + EMAIL_TO). SMTP can be added later.
export async function sendEmail(subject: string, text: string): Promise<NotifyResult | null> {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    const to = process.env.EMAIL_TO;
    if (!key || !from || !to) return null;
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify({ from, to: to.split(',').map((s) => s.trim()), subject, text }),
    });
    return { channel: 'email', ok: res.ok, detail: res.ok ? undefined : `HTTP ${res.status}` };
}

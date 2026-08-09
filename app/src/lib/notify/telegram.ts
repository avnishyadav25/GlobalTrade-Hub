import 'server-only';
import type { NotifyResult } from './index';

// Telegram Bot API. Set TELEGRAM_BOT_TOKEN (from @BotFather) + TELEGRAM_CHAT_ID.
export async function sendTelegram(text: string): Promise<NotifyResult | null> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return null;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: true }),
    });
    return { channel: 'telegram', ok: res.ok, detail: res.ok ? undefined : `HTTP ${res.status}` };
}

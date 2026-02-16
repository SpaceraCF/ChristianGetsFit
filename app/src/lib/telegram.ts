const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

export async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  if (!API) {
    console.log("[Telegram] No token, would send to", chatId, ":", text.slice(0, 80));
    return false;
  }
  try {
    const res = await fetch(`${API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    return res.ok;
  } catch (e) {
    console.error("[Telegram]", e);
    return false;
  }
}

export async function setTelegramWebhook(url: string): Promise<void> {
  if (!API) return;
  await fetch(`${API}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export function getTelegramBotToken(): string | null {
  return BOT_TOKEN ?? null;
}

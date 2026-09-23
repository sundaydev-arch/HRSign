/**
 * Feishu / Lark custom bot webhook.
 * Set LARK_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/...
 */

export async function sendLarkMessage(msg: { text: string }): Promise<boolean> {
  const url = process.env.LARK_WEBHOOK_URL?.trim();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "text",
        content: { text: msg.text },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

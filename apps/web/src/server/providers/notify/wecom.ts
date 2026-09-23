/**
 * WeCom (企业微信) group robot webhook.
 * Set WECOM_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...
 */

export interface WecomMessage {
  text: string;
}

export async function sendWecomMessage(msg: WecomMessage): Promise<boolean> {
  const url = process.env.WECOM_WEBHOOK_URL?.trim();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msgtype: "text", text: { content: msg.text } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

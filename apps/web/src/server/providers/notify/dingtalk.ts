/**
 * DingTalk custom robot webhook.
 * Set DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=...
 */

export async function sendDingtalkMessage(msg: { text: string }): Promise<boolean> {
  const url = process.env.DINGTALK_WEBHOOK_URL?.trim();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "text",
        text: { content: msg.text },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

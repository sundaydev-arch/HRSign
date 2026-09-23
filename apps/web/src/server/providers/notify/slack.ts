/**
 * Slack Incoming Webhook.
 * Set SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
 */

export async function sendSlackMessage(msg: { text: string }): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: msg.text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

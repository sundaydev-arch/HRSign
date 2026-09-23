/**
 * Microsoft Teams Incoming Webhook (Adaptive Card / MessageCard simple text).
 * Set TEAMS_WEBHOOK_URL=https://...webhook.office.com/webhookb2/...
 *
 * Uses the legacy MessageCard payload which still works with classic connectors
 * and many Power Automate workflows that accept JSON { text }.
 */

export async function sendTeamsMessage(msg: { text: string }): Promise<boolean> {
  const url = process.env.TEAMS_WEBHOOK_URL?.trim();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        summary: "HRSign",
        themeColor: "1C1917",
        text: msg.text,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

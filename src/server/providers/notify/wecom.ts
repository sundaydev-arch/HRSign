/**
 * WeCom (Enterprise WeChat) notification adapter slot.
 *
 * Not enabled in the Phase 1 MVP; planned for a later milestone.
 * Two integration options when implemented:
 *   1. Group robot webhook: set WECOM_WEBHOOK_URL and POST JSON.
 *   2. Enterprise application message: set WECOM_CORP_ID / WECOM_AGENT_ID /
 *      WECOM_SECRET and call the access_token API.
 */

export interface WecomMessage {
  title: string;
  body: string;
  link?: string;
}

export async function sendWecomMessage(message: WecomMessage): Promise<boolean> {
  // TODO: read WECOM_WEBHOOK_URL, post the message, and return success.
  void message;
  return false;
}

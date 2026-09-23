/**
 * Fan-out task notifications across AppSettings.notifyChannels.
 */
import { loadAppSettings } from "@/lib/app-settings";
import { sendEmail, type SendEmailInput } from "@/server/providers/notify/email";
import { sendWecomMessage } from "@/server/providers/notify/wecom";
import { sendDingtalkMessage } from "@/server/providers/notify/dingtalk";
import { sendLarkMessage } from "@/server/providers/notify/lark";
import { sendSlackMessage } from "@/server/providers/notify/slack";
import { sendTeamsMessage } from "@/server/providers/notify/teams";

export async function fanOutChannels(input: {
  text: string;
  email?: SendEmailInput;
}): Promise<void> {
  const settings = await loadAppSettings();
  const channels = settings.notifyChannels.length > 0 ? settings.notifyChannels : (["EMAIL"] as const);

  for (const channel of channels) {
    if (channel === "EMAIL" && input.email) {
      await sendEmail(input.email);
    }
    if (channel === "WECOM") {
      await sendWecomMessage({ text: input.text });
    }
    if (channel === "DINGTALK") {
      await sendDingtalkMessage({ text: input.text });
    }
    if (channel === "LARK") {
      await sendLarkMessage({ text: input.text });
    }
    if (channel === "SLACK") {
      await sendSlackMessage({ text: input.text });
    }
    if (channel === "TEAMS") {
      await sendTeamsMessage({ text: input.text });
    }
  }
}

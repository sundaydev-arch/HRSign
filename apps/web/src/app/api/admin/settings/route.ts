import { ApiError, getClientIp, getUserAgent, handleApiError } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { env, isOidcConfigured, isSmtpConfigured } from "@/lib/env";
import { loadAppSettings, persistAppSettingsPatch } from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";
import { requireApiUser } from "@/lib/rbac";
import type { NotificationChannel, SignatureMethod } from "@/server/providers/types";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const METHODS: SignatureMethod[] = ["IMAGE_SEAL", "PADES", "GM_SM2"];
const CHANNELS: NotificationChannel[] = ["EMAIL", "WECOM", "DINGTALK", "LARK", "SLACK", "TEAMS"];

async function settingsPayload() {
  const retentionPolicies = await prisma.retentionPolicy.findMany({
    orderBy: { category: "asc" },
  });
  const app = await loadAppSettings();
  return {
    ...app,
    appUrl: env.APP_URL,
    smtpConfigured: isSmtpConfigured(),
    oidcConfigured: isOidcConfigured(),
    wecomConfigured: Boolean(process.env.WECOM_WEBHOOK_URL?.trim()),
    dingtalkConfigured: Boolean(process.env.DINGTALK_WEBHOOK_URL?.trim()),
    larkConfigured: Boolean(process.env.LARK_WEBHOOK_URL?.trim()),
    slackConfigured: Boolean(process.env.SLACK_WEBHOOK_URL?.trim()),
    teamsConfigured: Boolean(process.env.TEAMS_WEBHOOK_URL?.trim()),
    padesEnvConfigured: Boolean(process.env.PADES_CERT_PEM && process.env.PADES_KEY_PEM),
    retentionPolicies,
  };
}

export async function GET() {
  try {
    await requireApiUser(["SUPER_ADMIN"]);
    return NextResponse.json(await settingsPayload());
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireApiUser(["SUPER_ADMIN"]);
    const body = (await req.json()) as {
      watermarkText?: string;
      signatureMethod?: string;
      remindDaysBefore?: number;
      notifyChannels?: string[];
      padesCertPem?: string | null;
      padesKeyPem?: string | null;
      retentionPolicies?: Array<{ id: string; retentionYears?: number; enabled?: boolean }>;
    };

    const patch: Parameters<typeof persistAppSettingsPatch>[0] = {};

    if (typeof body.watermarkText === "string") {
      patch.watermarkText = body.watermarkText;
    }
    if (typeof body.signatureMethod === "string") {
      if (!METHODS.includes(body.signatureMethod as SignatureMethod)) {
        throw new ApiError(400, "SIGNATURE_METHOD_INVALID");
      }
      patch.signatureMethod = body.signatureMethod as SignatureMethod;
    }
    if (body.remindDaysBefore !== undefined) {
      if (
        typeof body.remindDaysBefore !== "number" ||
        !Number.isInteger(body.remindDaysBefore) ||
        body.remindDaysBefore < 0 ||
        body.remindDaysBefore > 30
      ) {
        throw new ApiError(400, "REMIND_DAYS_INVALID");
      }
      patch.remindDaysBefore = body.remindDaysBefore;
    }
    if (Array.isArray(body.notifyChannels)) {
      const channels = body.notifyChannels.filter((c): c is NotificationChannel =>
        CHANNELS.includes(c as NotificationChannel),
      );
      if (channels.length === 0) throw new ApiError(400, "NOTIFY_CHANNELS_REQUIRED");
      patch.notifyChannels = channels;
    }
    if (body.padesCertPem !== undefined) {
      patch.padesCertPem = body.padesCertPem?.trim() || null;
    }
    if (body.padesKeyPem !== undefined) {
      patch.padesKeyPem = body.padesKeyPem?.trim() || null;
    }

    try {
      if (Object.keys(patch).length > 0) {
        await persistAppSettingsPatch(patch);
      }
    } catch {
      throw new ApiError(400, "WATERMARK_TEXT_REQUIRED");
    }

    if (Array.isArray(body.retentionPolicies)) {
      for (const row of body.retentionPolicies) {
        if (!row?.id || typeof row.id !== "string") {
          throw new ApiError(400, "RETENTION_POLICY_ID_REQUIRED");
        }
        const existing = await prisma.retentionPolicy.findUnique({ where: { id: row.id } });
        if (!existing) throw new ApiError(404, "RETENTION_POLICY_NOT_FOUND");

        const data: { retentionYears?: number; enabled?: boolean } = {};
        if (row.retentionYears !== undefined) {
          if (
            typeof row.retentionYears !== "number" ||
            !Number.isInteger(row.retentionYears) ||
            row.retentionYears < 1 ||
            row.retentionYears > 100
          ) {
            throw new ApiError(400, "RETENTION_YEARS_INVALID");
          }
          data.retentionYears = row.retentionYears;
        }
        if (typeof row.enabled === "boolean") data.enabled = row.enabled;
        if (Object.keys(data).length > 0) {
          await prisma.retentionPolicy.update({ where: { id: row.id }, data });
        }
      }
    }

    await recordAudit({
      userId: user.id,
      action: "settings.update",
      targetType: "settings",
      targetId: "default",
      ip: getClientIp(req),
      userAgent: getUserAgent(req),
      detail: {
        keys: Object.keys(body),
      },
    });

    return NextResponse.json(await settingsPayload());
  } catch (err) {
    return handleApiError(err);
  }
}

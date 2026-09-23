import { prisma } from "@/lib/prisma";
import type { SignatureMethod, NotificationChannel } from "@/server/providers/types";

const SINGLETON_ID = "default";

export type AppSettingsView = {
  watermarkText: string;
  signatureMethod: SignatureMethod;
  remindDaysBefore: number;
  notifyChannels: NotificationChannel[];
  hasPadesCert: boolean;
  hasSm2Key: boolean;
};

function parseChannels(raw: string): NotificationChannel[] {
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return ["EMAIL"];
    return arr.filter((c): c is NotificationChannel =>
      ["EMAIL", "WECOM", "DINGTALK", "LARK", "SLACK", "TEAMS"].includes(String(c)),
    );
  } catch {
    return ["EMAIL"];
  }
}

function parseMethod(raw: string | null | undefined): SignatureMethod {
  if (raw === "PADES" || raw === "GM_SM2" || raw === "IMAGE_SEAL") return raw;
  return "IMAGE_SEAL";
}

export async function loadAppSettings(): Promise<AppSettingsView> {
  const row = await prisma.appSettings.findUnique({ where: { id: SINGLETON_ID } });
  return {
    watermarkText: row?.watermarkText?.trim() || process.env.WATERMARK_TEXT || "HRSign INTERNAL",
    signatureMethod: parseMethod(row?.signatureMethod),
    remindDaysBefore: row?.remindDaysBefore ?? 3,
    notifyChannels: parseChannels(row?.notifyChannels ?? '["EMAIL"]'),
    hasPadesCert: Boolean(row?.padesCertPem && row?.padesKeyPem) || Boolean(process.env.PADES_CERT_PEM),
    hasSm2Key: Boolean(row?.sm2KeyJson) || Boolean(process.env.GM_SM2_PRIVATE_KEY),
  };
}

export async function resolveSignatureMethod(): Promise<SignatureMethod> {
  const s = await loadAppSettings();
  return s.signatureMethod;
}

export async function persistAppSettingsPatch(input: {
  watermarkText?: string;
  signatureMethod?: SignatureMethod;
  remindDaysBefore?: number;
  notifyChannels?: NotificationChannel[];
  padesCertPem?: string | null;
  padesKeyPem?: string | null;
}): Promise<AppSettingsView> {
  const current = await loadAppSettings();
  const watermarkText = (input.watermarkText ?? current.watermarkText).trim();
  if (!watermarkText) throw new Error("WATERMARK_REQUIRED");

  await prisma.appSettings.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      watermarkText,
      signatureMethod: input.signatureMethod ?? current.signatureMethod,
      remindDaysBefore: input.remindDaysBefore ?? current.remindDaysBefore,
      notifyChannels: JSON.stringify(input.notifyChannels ?? current.notifyChannels),
      padesCertPem: input.padesCertPem ?? undefined,
      padesKeyPem: input.padesKeyPem ?? undefined,
    },
    update: {
      watermarkText,
      ...(input.signatureMethod ? { signatureMethod: input.signatureMethod } : {}),
      ...(input.remindDaysBefore !== undefined
        ? { remindDaysBefore: input.remindDaysBefore }
        : {}),
      ...(input.notifyChannels
        ? { notifyChannels: JSON.stringify(input.notifyChannels) }
        : {}),
      ...(input.padesCertPem !== undefined ? { padesCertPem: input.padesCertPem } : {}),
      ...(input.padesKeyPem !== undefined ? { padesKeyPem: input.padesKeyPem } : {}),
    },
  });
  return loadAppSettings();
}

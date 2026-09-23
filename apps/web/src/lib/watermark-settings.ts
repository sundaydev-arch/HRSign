import { env } from "./env";
import { prisma } from "./prisma";

const SINGLETON_ID = "default";

export async function resolveWatermarkText(): Promise<string> {
  try {
    const row = await prisma.appSettings.findUnique({ where: { id: SINGLETON_ID } });
    const text = row?.watermarkText?.trim();
    if (text) return text;
  } catch (err) {
    console.warn("[watermark-settings] read failed, using env default", err);
  }
  return env.WATERMARK_TEXT;
}

export async function persistWatermarkText(text: string): Promise<void> {
  const watermarkText = text.trim();
  if (!watermarkText) {
    throw new Error("WATERMARK_TEXT_REQUIRED");
  }
  await prisma.appSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, watermarkText },
    update: { watermarkText },
  });
}

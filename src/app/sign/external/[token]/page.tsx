import { ExternalSign } from "@/components/sign/ExternalSign";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("external");
  return { title: t("metadataTitle") };
}

export default async function ExternalSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ExternalSign token={token} />;
}

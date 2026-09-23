import { JsonLd } from "@/components/seo/JsonLd";
import { getSiteUrl } from "@/lib/site";
import { getSessionUser } from "@/lib/rbac";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
    alternates: { canonical: "/login" },
    openGraph: {
      url: "/login",
      title: t("ogTitle"),
      description: t("ogDescription"),
    },
  };
}

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const t = await getTranslations("app");
  const locale = await getLocale();
  const site = getSiteUrl();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "HRSign",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description: t("metadataDescription"),
    url: `${site}/login`,
    inLanguage: [locale === "zh-CN" ? "zh-CN" : "en"],
    featureList: [
      "PDF template field editor",
      "Approval-before-company-seal",
      "Handwritten signature & seal",
      "External candidate signing links",
      "Immutable version archive & audit logs",
      "Self-hosted single-tenant deployment",
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      {children}
    </>
  );
}

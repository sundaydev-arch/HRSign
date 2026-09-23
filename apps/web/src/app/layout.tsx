import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { getSiteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  const site = getSiteUrl();
  const title = t("metadataTitle");
  const description = t("metadataDescription");

  return {
    metadataBase: new URL(site),
    title: {
      default: title,
      template: `%s · HRSign`,
    },
    description,
    keywords: t("metadataKeywords")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    applicationName: "HRSign",
    authors: [{ name: "HRSign" }],
    creator: "HRSign",
    publisher: "HRSign",
    category: "business",
    icons: {
      icon: [
        { url: "/brand/favicon.ico", sizes: "any" },
        { url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
        { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      ],
      apple: [{ url: "/brand/icon-256.png", sizes: "256x256", type: "image/png" }],
    },
    openGraph: {
      type: "website",
      locale: "zh_CN",
      alternateLocale: ["en_US"],
      url: site,
      siteName: "HRSign",
      title: t("ogTitle"),
      description: t("ogDescription"),
      images: [
        {
          url: "/brand/icon-256.png",
          width: 256,
          height: 256,
          alt: "HRSign",
        },
      ],
    },
    twitter: {
      card: "summary",
      title: t("ogTitle"),
      description: t("ogDescription"),
      images: ["/brand/icon-256.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    alternates: {
      canonical: "/login",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} min-h-svh font-sans antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster position="top-center" richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

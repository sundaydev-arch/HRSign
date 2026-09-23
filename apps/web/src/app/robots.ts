import { getSiteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";

/**
 * Crawl policy for SEO + GEO:
 * - Index the public login / product surface.
 * - Block authenticated workspace, APIs, and tokenized external-sign links.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/brand/", "/llms.txt"],
        disallow: [
          "/api/",
          "/tasks",
          "/templates",
          "/archive",
          "/seals",
          "/audit-logs",
          "/admin",
          "/sign/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}

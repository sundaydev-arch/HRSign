import { getSiteUrl } from "@/lib/site";
import type { MetadataRoute } from "next";

/** Public URLs only — authenticated app routes stay out of the sitemap. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();
  return [
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}

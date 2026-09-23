import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Monorepo: trace files from repo root (prisma, packages, …)
  outputFileTracingRoot: path.join(__dirname, "../.."),
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
  },
  transpilePackages: ["@hrsign/sdk-ts"],
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

const config = withNextIntl(nextConfig);

export default async function nextConfigExport() {
  if (process.env.ANALYZE !== "1") return config;
  try {
    const { default: bundleAnalyzer } = await import("@next/bundle-analyzer");
    return bundleAnalyzer({ enabled: true })(config);
  } catch {
    console.warn(
      "[next.config] ANALYZE=1 but @next/bundle-analyzer is not installed.",
    );
    return config;
  }
}

import { z } from "zod";

/**
 * Environment validation (fail fast at import).
 * Optional SMTP fields stay empty-string-friendly so local/dev without mail works.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),

  MINIO_ENDPOINT: z.string().min(1).default("localhost"),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  MINIO_ACCESS_KEY: z.string().min(1).default("minioadmin"),
  MINIO_SECRET_KEY: z.string().min(1).default("minioadmin123"),
  MINIO_BUCKET: z.string().min(1).default("hrsign"),
  MINIO_PRESIGN_SECONDS: z.coerce.number().int().positive().default(300),

  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(16),
  AUTH_TRUST_HOST: z.string().optional(),

  APP_URL: z.string().url().default("http://localhost:3000"),
  WATERMARK_TEXT: z.string().default("HRSign INTERNAL"),

  SMTP_HOST: z.string().optional().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_FROM: z.string().default("HRSign <hrsign@example.com>"),

  OIDC_ISSUER: z.string().url().optional().or(z.literal("")).default(""),
  OIDC_CLIENT_ID: z.string().optional().default(""),
  OIDC_CLIENT_SECRET: z.string().optional().default(""),

  DATABASE_URL_WORKER: z.string().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

function loadEnv(): AppEnv {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }
  return parsed.data;
}

/**
 * Validated env singleton. Import from server code only.
 * Skips strict parse during `next build` collect phase when DATABASE_URL may be absent —
 * callers that need DB must still have a real runtime env.
 */
export const env: AppEnv = (() => {
  if (process.env.SKIP_ENV_VALIDATION === "1") {
    return EnvSchema.parse({
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://localhost:5432/hrsign",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "build-time-placeholder-secret",
    });
  }
  return loadEnv();
})();

export function isOidcConfigured(): boolean {
  return Boolean(env.OIDC_ISSUER && env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET);
}

export function isSmtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST);
}

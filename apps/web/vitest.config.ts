import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "127.0.0.1",
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["node_modules", ".next"],
    env: {
      SKIP_ENV_VALIDATION: "1",
      NEXTAUTH_SECRET: "test-secret-at-least-16-chars",
      DATABASE_URL: "postgresql://hrsign:hrsign@127.0.0.1:5433/hrsign",
      APP_URL: "http://127.0.0.1:3000",
      MINIO_ENDPOINT: "127.0.0.1",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/server/**/*.ts", "src/schemas/**/*.ts"],
      exclude: ["**/__tests__/**", "**/*.d.ts"],
    },
  },
});

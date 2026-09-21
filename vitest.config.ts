import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/server/**/*.ts", "src/schemas/**/*.ts"],
      exclude: ["**/__tests__/**", "**/*.d.ts"],
    },
  },
});

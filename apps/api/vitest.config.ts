import path from "node:path";
import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
  return {
    resolve: { alias: { "@": path.join(import.meta.dirname, "src") } },
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            JWT_SECRET: "test-secret-test-secret-test-secret",
            RESEND_API_KEY: "",
            PLATFORM_EMAIL_FROM: "test@example.com",
            PLATFORM_SUPPORT_EMAIL: "support@example.com",
            DODO_API_KEY: "",
            DODO_WEBHOOK_SECRET: "",
            DODO_TRIAL_PRODUCT_ID: "",
          },
        },
      }),
    ],
    test: { setupFiles: ["./test/apply-migrations.ts"] },
  };
});

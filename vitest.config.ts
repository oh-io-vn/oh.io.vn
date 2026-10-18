import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          ENVIRONMENT: "development",
          APP_ORIGIN: "http://localhost:8787",
          HMAC_SECRET: "test-only-secret-test-only-secret",
          TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
          // Never use developer/provider credentials inside the test Worker.
          GOOGLE_CLIENT_ID: "local-test-client",
          GOOGLE_CLIENT_SECRET: "",
          ADMIN_GOOGLE_SUBS: "",
          ADMIN_BOOTSTRAP_EMAIL: "",
          BACKUP_TOKEN: "",
          CF_METRICS_TOKEN: "",
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
        },
      },
    }),
  ],
  test: {
    // Do not discover downloaded tools or skill repositories under .local/.agents.
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.node.test.mjs"],
    setupFiles: ["./tests/setup.ts"],
  },
});

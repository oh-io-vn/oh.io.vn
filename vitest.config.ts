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
          TEST_MIGRATIONS: await readD1Migrations("./migrations"),
        },
      },
    }),
  ],
  test: {
    exclude: ["**/node_modules/**", "**/*.node.test.mjs"],
    setupFiles: ["./tests/setup.ts"],
  },
});

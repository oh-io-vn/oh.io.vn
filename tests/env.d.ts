/// <reference types="@cloudflare/vitest-plugin/types" />
import type { Env as WorkerEnv } from "../src/worker/types";
import type { D1Migration } from "@cloudflare/vitest-plugin";
declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

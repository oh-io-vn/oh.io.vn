import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  root: "src/web",
  publicDir: "../../public",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        [
          "index",
          "dashboard",
          "admin",
          "privacy",
          "terms",
          "report",
          "about",
        ].map((name) => [name, resolve(`src/web/${name}.html`)]),
      ),
    },
  },
});

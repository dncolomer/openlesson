import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup/flowcfg-embeddings-fetch.ts"],
    env: {
      STRIPE_SECRET_KEY: "sk_test_vitest_placeholder",
      FLOWCFG_EMBEDDINGS_BASE_URL: "http://flowcfg-embeddings.test",
      FLOWCFG_EMBEDDINGS_API_KEY: "sk-test-flowcfg",
    },
  },
  ssr: {
    noExternal: ["@excalidraw/excalidraw"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Node ESM requires the .js extension; the Excalidraw package imports this path bare.
      "roughjs/bin/rough": path.resolve(__dirname, "node_modules/roughjs/bin/rough.js"),
    },
  },
});
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      STRIPE_SECRET_KEY: "sk_test_vitest_placeholder",
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
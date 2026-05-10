/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/__tests__/**/*.spec.ts", "src/**/*.spec.ts"],
    environment: "node",
    reporters: "default",
  },
});

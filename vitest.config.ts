import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/{unit,integration,contract}/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
    restoreMocks: true,
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});

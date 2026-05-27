import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    coverage: { provider: "v8", reporter: ["text", "json", "html"] },
    testTimeout: 30_000,
  },
});

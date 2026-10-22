import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    // These tests hit a real, shared Postgres (rate limits, uniqueness
    // constraints) — run files one at a time so they can't race each other.
    fileParallelism: false,
  },
});

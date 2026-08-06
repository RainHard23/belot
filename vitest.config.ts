import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    // Server tests are limited to framework-free modules (no @nestjs/*
    // imports) — those pull in decorators + reflect-metadata that this
    // root Vite project isn't configured for. See turn-timer-logic.ts /
    // rate-limiter.ts for the pattern (pure logic extracted out of the
    // Nest-decorated services so it's testable here).
    include: ["shared/**/*.test.ts", "server/src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(root, "./shared"),
    },
  },
});

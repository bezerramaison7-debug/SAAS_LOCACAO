import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const raiz = import.meta.dirname;

const resolve = {
  alias: {
    "@": path.join(raiz, "src"),
    // Em testes o módulo "server-only" é neutro (no Next ele impede import no cliente).
    "server-only": path.join(raiz, "tests/unit-setup/server-only.ts"),
  },
};

export default defineConfig({
  plugins: [react()],
  resolve,
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}", "tests/unit/**/*.test.{ts,tsx}"],
          environment: "node",
          setupFiles: ["tests/unit-setup/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          testTimeout: 30_000,
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "rls",
          include: ["tests/rls/**/*.test.ts"],
          environment: "node",
          testTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
  },
});

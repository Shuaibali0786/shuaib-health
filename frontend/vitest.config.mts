import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Vite resolves the "@/*" alias from tsconfig.json natively.
  resolve: {
    tsconfigPaths: true,
    // Next resolves "server-only" itself; Vitest does not, so use an empty stub.
    alias: {
      "server-only": fileURLToPath(new URL("./tests/unit/helpers/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});

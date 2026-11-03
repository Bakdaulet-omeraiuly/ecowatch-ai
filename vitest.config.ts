import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Тест жүгірткісі (P1.7). `@/` алиасы tsconfig `paths`-пен бірдей: `@/x` → `src/x`.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

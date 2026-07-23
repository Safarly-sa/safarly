import { defineConfig } from "vitest/config";

/**
 * The API is bundled with esbuild, not Vite, so there is no shared config to
 * reuse — this stands alone. Tests cover the pure request validators and the
 * itinerary-action guard, all of which use relative imports and the node
 * environment, so no alias or DOM setup is needed.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});

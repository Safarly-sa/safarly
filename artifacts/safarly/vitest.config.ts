import path from "path";
import { defineConfig } from "vitest/config";

/**
 * Kept separate from vite.config.ts on purpose: the build config validates PORT
 * and wires React/Tailwind plugins that the unit tests neither need nor should
 * pay for. Tests here cover pure logic (the engine, itinerary editing, i18n
 * resolution, allergen normalisation), so the default `node` environment is
 * correct and fast — no jsdom.
 *
 * The `@` alias mirrors vite.config.ts so test imports read exactly like app
 * imports; if that alias changes there, change it here too.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});

// Minimal Vitest config — scoped to the pure-logic libs under src/lib so
// the test run doesn't try to mount React components or load Vite's full
// build pipeline. node environment is fine: these libs have no DOM deps.
//
// Heads-up for Canelo — running `npm run test` invokes `vitest run` (single
// pass, no watch). Add `vitest` with no args during development for the
// watch UI.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/**/*.test.ts"],
    globals: false,
  },
});

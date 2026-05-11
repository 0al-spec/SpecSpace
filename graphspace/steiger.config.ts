import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

/**
 * Steiger lints FSD layer/slice/segment rules — import direction, public-API
 * access, naming, segment/slice shape.
 *
 * Baseline: the plugin's `recommended` set. Local overrides below explain
 * the rare GraphSpace-specific relaxations; the recommended set runs as
 * "error" everywhere else.
 *
 * Run with `npm run lint:fsd`. Treat any new error as a real architectural
 * signal — fix the code first, suppress only with a rationale comment.
 */
export default defineConfig([
  ...fsd.configs.recommended,

  // `.gitkeep` notes inside placeholder layer folders carry planning prose,
  // not slices — exclude from every rule so they don't surface noise.
  { ignores: ["**/.gitkeep"] },

  // While the rewrite grows leaf-up, some slices have just one consumer (the
  // demo App). `insignificant-slice` is a useful refactor signal, not an
  // error — relax to warning so the build stays green until each slice
  // earns its second consumer.
  {
    rules: {
      "fsd/insignificant-slice": "warn",
    },
  },
]);

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

  // The Viewer page is intentionally decomposed into stable product
  // composition boundaries even though some of them currently have one page
  // consumer. Keep the exception list explicit and documented so any new
  // single-consumer slice still fails as an architectural signal.
  // See `docs/fsd-slice-rationale.md`.
  {
    files: [
      "src/entities/implementation-work/**/*",
      "src/entities/proposal-trace/**/*",
      "src/entities/recent-change/**/*",
      "src/entities/spec-edge/**/*",
      "src/entities/spec-node/**/*",
      "src/entities/specpm-lifecycle/**/*",
      "src/features/filter-by-tone/**/*",
      "src/features/search-by-spec/**/*",
      "src/widgets/implementation-work-panel/**/*",
      "src/widgets/proposal-trace/**/*",
      "src/widgets/recent-changes-panel/**/*",
      "src/widgets/spec-graph-canvas/**/*",
      "src/widgets/spec-inspector/**/*",
      "src/widgets/spec-node-navigator/**/*",
    ],
    rules: {
      "fsd/insignificant-slice": "off",
    },
  },
]);

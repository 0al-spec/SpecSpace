import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

/**
 * Steiger lints FSD layer/slice/segment rules: import direction,
 * cross-slice imports, public-API access, naming conventions.
 *
 * Run with `npm run lint:fsd`. Treated as warn-only during the rewrite —
 * we'll switch the project to strict once entities/ and features/ stabilise.
 */
export default defineConfig({
  rules: {
    ...fsd.configs.recommended.rules,
    // Day 1: scaffolding only — relax until we have enough slices to validate.
    "fsd/insignificant-slice": "off",
    "fsd/public-api": "warn",
  },
});

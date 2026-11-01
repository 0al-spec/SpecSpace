import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import ts from "typescript-eslint";
import globals from "globals";
import react from "eslint-plugin-react";
import hooks from "eslint-plugin-react-hooks";
import a11y from "eslint-plugin-jsx-a11y";
import refresh from "eslint-plugin-react-refresh";
import security from "eslint-plugin-security";
import sonar from "eslint-plugin-sonarjs";
export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...ts.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["graphspace/src/**/*.{ts,tsx}", "viewer/app/src/**/*.{ts,tsx}"],
  })),
  {
    files: ["graphspace/src/**/*.{ts,tsx}", "viewer/app/src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: fileURLToPath(new URL("../", import.meta.url)),
      },
    },
  },
  react.configs.flat.recommended,
  a11y.flatConfigs.recommended,
  security.configs.recommended,
  sonar.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    settings: { react: { version: "19.1.0" } },
    plugins: { "react-hooks": hooks, "react-refresh": refresh },
    rules: {
      ...hooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
);

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["apps/client/src/**/*.ts", "apps/client/vite.config.ts"],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ["apps/server/src/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["*.config.js", "*.config.cjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
];

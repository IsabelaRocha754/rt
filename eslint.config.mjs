// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.expo/**",
      "**/coverage/**",
      "**/drizzle/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  {
    rules: {
      // sql.raw bypasses Drizzle's parameterization — only migrations may use it.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='sql'][callee.property.name='raw']",
          message:
            "sql.raw() is banned outside db/migrations (see CLAUDE.md rule 5).",
        },
      ],
    },
  },
  {
    files: ["**/db/migrations/**"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: ["**/*.config.js", "**/.husky/**"],
    languageOptions: {
      globals: { module: "writable", require: "readonly", __dirname: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);

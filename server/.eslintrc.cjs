"use strict";

module.exports = {
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["n"],
  extends: ["eslint:recommended", "plugin:n/recommended"],
  rules: {
    // Allow console in logger module only; elsewhere use the logger
    "no-console": "warn",

    // Node plugin — we use ESM so this is expected
    "n/no-missing-import": "off",
    "n/no-unpublished-import": "off",
    // This repo includes CLI scripts and a server entrypoint that intentionally
    // terminate the process on fatal configuration/startup errors.
    "n/no-process-exit": "off",

    // Enforce explicit error handling
    "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],

    // Disallow var; only let/const
    "no-var": "error",
    "prefer-const": "error",
  },
  ignorePatterns: ["node_modules/", "coverage/"],
};

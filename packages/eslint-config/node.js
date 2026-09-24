// @repo/eslint-config/node — add on top of base for Node APIs/workers/libs.
//
// Curated eslint-plugin-n subset (actively maintained, flat-compatible):
// - no-unsupported-features/node-builtins: flags Node APIs newer than the
//   version range the plugin detects (per-package `engines` field, so
//   keep `engines` accurate in each backend package).
// - no-deprecated-api: flags deprecated Node APIs before they bite.
// - prefer-node-protocol: `node:fs` over `fs`; prevents builtin-vs-npm
//   shadowing bugs, autofixable.
// Deliberately NOT enabled: no-missing-import (tsc already resolves),
// no-sync (legit in CLIs/scripts — scope it locally if a request path
// needs it), no-process-exit (legit in workers/entrypoints).
import nodePlugin from "eslint-plugin-n";
import globals from "globals";

export default [
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    plugins: {
      n: nodePlugin,
    },
    rules: {
      "no-console": "off",
      "n/no-unsupported-features/node-builtins": "error",
      "n/no-deprecated-api": "error",
      "n/prefer-node-protocol": "error",
    },
  },
];

// @repo/eslint-config/react — add on top of base for React apps/packages.
//
// - eslint-plugin-react: classic React correctness (unknown props,
//   target-blank, …). `jsx-runtime` variant assumes the automatic JSX
//   transform (React 17+); `prop-types` stays off because TypeScript
//   already types props.
// - eslint-plugin-react-hooks v7 (official React team plugin): Rules of
//   Hooks + exhaustive-deps as a warning (stale closures are real bugs,
//   but the rule has known false positives — warn + --max-warnings 0
//   surfaces them without pretending certainty), plus the merged React
//   Compiler diagnostics (purity, immutability, refs, set-state-in-effect…).
//   Compiler rules surface even without the compiler installed; fix them
//   at your own pace to unlock future compiler optimization.
// - jsx-a11y recommended: interactive elements, labels, ARIA, keyboard
//   support. Meaningful for a UI-heavy platform; audit with real
//   assistive tech, don't treat the plugin as a full audit.
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.flat.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "react/prop-types": "off",
      // React event handlers legitimately receive async callbacks
      // (`onClick={save}` where save returns a promise). The base rule
      // still checks arguments (forEach(async…) stays an error).
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
];

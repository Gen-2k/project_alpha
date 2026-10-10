export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    // Checked as a warning: keeps history greppable (web/api/ui/…)
    // without blocking commits when no scope fits.
    "scope-enum": [
      1,
      "always",
      ["server", "cli", "database", "validation", "config", "repo", "ci", "deps", "deps-dev"],
    ],
  },
};

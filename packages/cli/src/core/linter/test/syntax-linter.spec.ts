import { describe, expect, it } from "vitest";

import { lintCatalog, lintTranslation, validateTagBalance } from "../syntax-linter.js";

describe("Deterministic Syntax & ICU Linter", () => {
  it("should pass for valid translations with identical variables and valid ICU syntax", () => {
    const errors = lintTranslation("welcome_user", "Welcome, {name}!", "Willkommen, {name}!");

    expect(errors).toHaveLength(0);
  });

  it("should fail when target translation drops a required variable", () => {
    const errors = lintTranslation("welcome_user", "Welcome, {name}!", "Willkommen!");

    expect(errors).toHaveLength(1);
    expect(errors[0]?.code).toBe("MISSING_VARIABLE");
    expect(errors[0]?.message).toContain("'{name}'");
  });

  it("should fail when a variable is accidentally translated by an AI model", () => {
    const errors = lintTranslation("welcome_user", "Welcome, {name}!", "Bienvenue, {nom}!");

    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.code)).toEqual(["MISSING_VARIABLE", "EXTRA_VARIABLE"]);
  });

  it("should detect mismatched or unclosed HTML/JSX tags", () => {
    const errors = lintTranslation(
      "terms",
      "Agree to <b>Terms</b> and <a>Privacy</a>",
      "Zustimmen zu <b>Bedingungen und <a>Datenschutz</b></a>",
    );

    expect(errors.some((e) => e.code === "UNMATCHED_TAGS")).toBe(true);
  });

  it("should handle self-closing tags and properly nested tags in validateTagBalance", () => {
    expect(validateTagBalance("Line 1<br/>Line 2<img src='a.png'/>")).toBe(true);
    expect(validateTagBalance("<p><b>Text</b> and <i>More</i></p>")).toBe(true);
    expect(validateTagBalance("<>")).toBe(true);
    expect(validateTagBalance("<p>Text without closing")).toBe(false);
  });

  it("should validate ICU plural syntax", () => {
    const validErrors = lintTranslation(
      "item_count",
      "{count, plural, one {# item} other {# items}}",
      "{count, plural, one {# Artikel} other {# Artikel}}",
    );
    expect(validErrors).toHaveLength(0);

    const invalidErrors = lintTranslation(
      "item_count",
      "{count, plural, one {# item} other {# items}}",
      "{count, plural, one {# Artikel",
    );
    expect(invalidErrors.some((e) => e.code === "INVALID_ICU")).toBe(true);
  });

  it("should lint an entire catalog and return aggregated results", () => {
    const source = {
      greeting: "Hello, {name}!",
      items: "{count, plural, one {# item} other {# items}}",
      extraKey: "Only in source",
    };

    const target = {
      greeting: "Hello!", // Missing {name}
      items: "{count, plural, one {# item} other {# items}}",
    };

    const result = lintCatalog(source, target);

    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.key).toBe("greeting");
    expect(result.errors[0]?.code).toBe("MISSING_VARIABLE");
  });
});

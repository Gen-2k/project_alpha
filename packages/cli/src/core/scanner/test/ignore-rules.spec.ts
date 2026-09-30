import { describe, expect, it } from "vitest";

import {
  IGNORED_JSX_ELEMENTS,
  isTranslatableText,
  TRANSLATABLE_ATTRIBUTES,
} from "../ignore-rules.js";

describe("ignore-rules (Natural Language Filter)", () => {
  it("should recognize translatable natural language", () => {
    expect(isTranslatableText("Hello World")).toBe(true);
    expect(isTranslatableText("Welcome to Dashboard!")).toBe(true);
    expect(isTranslatableText("Se connecter")).toBe(true);
    expect(isTranslatableText("Iniciar sesión")).toBe(true);
  });

  it("should reject empty, single-character, or pure whitespace strings", () => {
    expect(isTranslatableText("")).toBe(false);
    expect(isTranslatableText(" ")).toBe(false);
    expect(isTranslatableText("a")).toBe(false);
  });

  it("should reject punctuation, symbols, and pure numbers", () => {
    expect(isTranslatableText("12345")).toBe(false);
    expect(isTranslatableText("---")).toBe(false);
    expect(isTranslatableText("... / # $")).toBe(false);
    expect(isTranslatableText("404")).toBe(false);
  });

  it("should reject URLs, emails, and semver strings", () => {
    expect(isTranslatableText("https://example.com")).toBe(false);
    expect(isTranslatableText("/api/v1/users")).toBe(false);
    expect(isTranslatableText("mailto:support@app.com")).toBe(false);
    expect(isTranslatableText("admin@company.org")).toBe(false);
    expect(isTranslatableText("v1.2.3")).toBe(false);
    expect(isTranslatableText("2.0.0-beta.1")).toBe(false);
  });

  it("should reject file paths and image extensions", () => {
    expect(isTranslatableText("logo.png")).toBe(false);
    expect(isTranslatableText("avatar.webp")).toBe(false);
    expect(isTranslatableText("styles.css")).toBe(false);
    expect(isTranslatableText("config.json")).toBe(false);
  });

  it("should reject hex colors", () => {
    expect(isTranslatableText("#fff")).toBe(false);
    expect(isTranslatableText("#1a2b3c")).toBe(false);
    expect(isTranslatableText("#ff000088")).toBe(false);
  });

  it("should have expected ignored elements and translatable attributes defined", () => {
    expect(IGNORED_JSX_ELEMENTS.has("code")).toBe(true);
    expect(IGNORED_JSX_ELEMENTS.has("svg")).toBe(true);
    expect(TRANSLATABLE_ATTRIBUTES.has("placeholder")).toBe(true);
    expect(TRANSLATABLE_ATTRIBUTES.has("alt")).toBe(true);
  });
});

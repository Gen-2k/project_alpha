import { describe, expect, it } from "vitest";

import {
  findReferencedKeys,
  identifyObsoleteKeys,
  resolveTraverse,
} from "../key-reference-scanner.js";

describe("Key Reference Scanner & Obsolete Pruner", () => {
  it("should detect keys used in t() calls and Trans components", () => {
    const code = `
      export function Navigation() {
        const t = useTranslations();
        return (
          <nav>
            <a href="/">{t("nav.home")}</a>
            <a href="/about">{t('nav.about')}</a>
            <Trans id="nav.contact" />
            <FormattedMessage i18nKey="nav.help" />
          </nav>
        );
      }
    `;

    const keys = findReferencedKeys(code);

    expect(keys.has("nav.home")).toBe(true);
    expect(keys.has("nav.about")).toBe(true);
    expect(keys.has("nav.contact")).toBe(true);
    expect(keys.has("nav.help")).toBe(true);
    expect(keys.size).toBe(4);
  });

  it("should detect member expression calls like i18n.t() and template literals", () => {
    const code = `
      export function StatusBadge({ status }: { status: string }) {
        const label = i18n.t(\`status.\${status}\`);
        const staticLabel = i18n.t(\`static.header\`);
        return <span>{label} - {staticLabel}</span>;
      }
    `;

    const keys = findReferencedKeys(code);
    expect(keys.has("status.*")).toBe(true);
    expect(keys.has("static.header")).toBe(true);
  });

  it("should return empty set on syntax error in code", () => {
    const code = `export function Broken( {`;
    const keys = findReferencedKeys(code);
    expect(keys.size).toBe(0);
  });

  it("should not crash on duplicate declarations of t (scope collisions)", () => {
    const code = `
      const t = 1;
      const t = 2;
      export function Comp() {
        const t = () => "hello";
        return <div>{t("duplicate.test")}</div>;
      }
    `;
    const keys = findReferencedKeys(code);
    expect(keys.has("duplicate.test")).toBe(true);
  });

  it("should identify obsolete keys present in catalog but missing in code", () => {
    const catalogKeys = ["nav.home", "nav.about", "nav.legacy_promo", "footer.old_link"];
    const activeKeys = new Set(["nav.home", "nav.about"]);

    const obsolete = identifyObsoleteKeys(catalogKeys, activeKeys);

    expect(obsolete).toEqual(["nav.legacy_promo", "footer.old_link"]);
  });

  it("should protect dynamic keys matching wildcard prefixes from pruning", () => {
    const catalogKeys = ["status.active", "status.pending", "status.rejected", "other.obsolete"];
    const activeKeys = new Set(["status.*"]);

    const obsolete = identifyObsoleteKeys(catalogKeys, activeKeys);

    expect(obsolete).toEqual(["other.obsolete"]);
  });

  describe("resolveTraverse interop fallbacks", () => {
    it("should resolve functions and nested default exports", () => {
      const fn = () => undefined;
      expect(typeof resolveTraverse(fn)).toBe("function");
      expect(typeof resolveTraverse({ default: fn })).toBe("function");
      expect(typeof resolveTraverse({ default: { default: fn } })).toBe("function");
      expect(() => resolveTraverse({})).toThrow(
        "Unable to resolve callable @babel/traverse function",
      );
    });
  });
});

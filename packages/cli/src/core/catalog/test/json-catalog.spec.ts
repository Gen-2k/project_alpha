import { describe, expect, it } from "vitest";

import {
  flattenObject,
  mergeCatalog,
  serializeCatalog,
  sortObjectKeys,
  splitCatalogByNamespace,
  unflattenObject,
} from "../json-catalog.js";

describe("JSON Catalog Manager", () => {
  describe("sortObjectKeys", () => {
    it("should sort top-level and nested keys alphabetically", () => {
      const input = {
        zebra: "zoo",
        apple: "fruit",
        details: {
          zip: "10001",
          city: "New York",
        },
      };

      const sorted = sortObjectKeys(input);
      expect(Object.keys(sorted)).toEqual(["apple", "details", "zebra"]);
      expect(Object.keys(sorted.details as Record<string, unknown>)).toEqual(["city", "zip"]);
    });
  });

  describe("unflattenObject", () => {
    it("should transform dot-delimited flat keys into nested objects", () => {
      const flat = {
        "auth.login.title": "Sign In",
        "auth.login.submit": "Submit",
        "common.cancel": "Cancel",
      };

      const nested = unflattenObject(flat);

      expect(nested).toEqual({
        auth: {
          login: {
            title: "Sign In",
            submit: "Submit",
          },
        },
        common: {
          cancel: "Cancel",
        },
      });
    });

    it("should handle keys with empty segments or edge dots gracefully", () => {
      const flat = {
        ".prefix": "Leading Dot",
        "suffix.": "Trailing Dot",
        "..": "Empty Segments",
      };
      const nested = unflattenObject(flat);
      expect(nested).toBeDefined();
    });
  });

  describe("mergeCatalog", () => {
    it("should add new keys non-destructively without overwriting existing translations", () => {
      const existing = {
        welcome: "Existing Custom Welcome",
      };

      const incoming = {
        welcome: "Default Welcome",
        goodbye: "Goodbye",
      };

      const merged = mergeCatalog(existing, incoming);

      expect(merged).toEqual({
        welcome: "Existing Custom Welcome",
        goodbye: "Goodbye",
      });
    });

    it("should merge nested objects cleanly without overwriting existing nested keys", () => {
      const existing = {
        header: {
          title: "Existing Header Title",
        },
      };

      const incoming = {
        "header.subtitle": "New Subtitle",
        "header.title": "Default Header Title",
        "footer.copyright": "2026 Giltflow",
      };

      const merged = mergeCatalog(existing, incoming, { nested: true });

      expect(merged).toEqual({
        header: {
          title: "Existing Header Title",
          subtitle: "New Subtitle",
        },
        footer: {
          copyright: "2026 Giltflow",
        },
      });
    });
  });

  describe("serializeCatalog", () => {
    it("should serialize to formatted JSON with sorted keys and trailing newline", () => {
      const catalog = {
        b: "beta",
        a: "alpha",
      };

      const serialized = serializeCatalog(catalog);
      expect(serialized).toBe('{\n  "a": "alpha",\n  "b": "beta"\n}\n');
    });
  });

  describe("flattenObject", () => {
    it("should recursively flatten nested objects into dot paths", () => {
      const nested = {
        auth: {
          login: {
            title: "Sign In",
          },
        },
        count: 5,
      };

      const flat = flattenObject(nested);
      expect(flat).toEqual({
        "auth.login.title": "Sign In",
        count: "5",
      });
    });
  });

  describe("splitCatalogByNamespace", () => {
    it("should split keys by top-level namespace", () => {
      const flat = {
        "settings_view.title": "Settings",
        "settings_view.subtitle": "Preferences",
        "accounts_view.name": "Accounts",
        standalone: "General",
      };

      const split = splitCatalogByNamespace(flat);
      expect(Object.keys(split)).toEqual(["settings_view", "accounts_view", "common"]);
      expect(split.settings_view).toEqual({
        "settings_view.title": "Settings",
        "settings_view.subtitle": "Preferences",
      });
      expect(split.accounts_view).toEqual({
        "accounts_view.name": "Accounts",
      });
      expect(split.common).toEqual({
        standalone: "General",
      });
    });

    it("should optionally strip namespace prefix from sub-keys", () => {
      const flat = {
        "auth.login": "Log In",
        "auth.signup": "Sign Up",
      };

      const split = splitCatalogByNamespace(flat, { stripNamespacePrefix: true });
      expect(split.auth).toEqual({
        login: "Log In",
        signup: "Sign Up",
      });
    });
  });
});

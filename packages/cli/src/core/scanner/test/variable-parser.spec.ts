import { parseExpression } from "@babel/parser";
import * as t from "@babel/types";
import { describe, expect, it } from "vitest";

import {
  parseBinaryConcatenation,
  parseTemplateLiteral,
  parseTernaryPlural,
  sanitizeTokenName,
} from "../variable-parser.js";

describe("Variable Parser (Interpolation & Placeholders)", () => {
  describe("sanitizeTokenName", () => {
    it("should extract base token names from member expressions", () => {
      const existing = new Set<string>();
      expect(sanitizeTokenName("user.profile.name", existing)).toBe("name");
      expect(sanitizeTokenName("order.items.length", existing)).toBe("count");
    });

    it("should handle duplicate token names by appending numbers", () => {
      const existing = new Set<string>();
      expect(sanitizeTokenName("origin.city", existing)).toBe("city");
      expect(sanitizeTokenName("destination.city", existing)).toBe("city1");
      expect(sanitizeTokenName("final.city", existing)).toBe("city2");
    });

    it("should fallback to value for non-matching expressions", () => {
      const existing = new Set<string>();
      expect(sanitizeTokenName("###", existing)).toBe("value");
    });
  });

  describe("parseTemplateLiteral", () => {
    it("should parse template literals with variables into ICU tokens", () => {
      const expr = parseExpression(
        "`Welcome back, ${user.name}! You have ${unreadCount} messages.`",
      );
      expect(t.isTemplateLiteral(expr)).toBe(true);

      if (t.isTemplateLiteral(expr)) {
        const result = parseTemplateLiteral(expr);
        expect(result).not.toBeNull();
        expect(result?.text).toBe("Welcome back, {name}! You have {unreadCount} messages.");
        expect(result?.variables).toEqual([
          { token: "name", rawExpression: "user.name" },
          { token: "unreadCount", rawExpression: "unreadCount" },
        ]);
      }
    });

    it("should return null for empty template literals", () => {
      const expr = parseExpression("`   `");
      if (t.isTemplateLiteral(expr)) {
        const result = parseTemplateLiteral(expr);
        expect(result).toBeNull();
      }
    });

    it("should handle template literals with array length as count token", () => {
      const expr = parseExpression("`Cart total: ${cart.items.length} items`");
      if (t.isTemplateLiteral(expr)) {
        const result = parseTemplateLiteral(expr);
        expect(result?.text).toBe("Cart total: {count} items");
        expect(result?.variables).toEqual([{ token: "count", rawExpression: "cart.items.length" }]);
      }
    });
  });

  describe("parseBinaryConcatenation", () => {
    it("should flatten binary string concatenations into ICU placeholders", () => {
      const expr = parseExpression('"Hello, " + user.firstName + " " + user.lastName + "!"');
      expect(t.isBinaryExpression(expr)).toBe(true);

      if (t.isBinaryExpression(expr)) {
        const result = parseBinaryConcatenation(expr);
        expect(result).not.toBeNull();
        expect(result?.text).toBe("Hello, {firstName} {lastName}!");
        expect(result?.variables).toEqual([
          { token: "firstName", rawExpression: "user.firstName" },
          { token: "lastName", rawExpression: "user.lastName" },
        ]);
      }
    });

    it("should return null for non-translatable binary expressions", () => {
      const expr = parseExpression("1 + 2");
      if (t.isBinaryExpression(expr)) {
        const result = parseBinaryConcatenation(expr);
        expect(result).toBeNull();
      }
    });

    it("should return null when operator is not plus", () => {
      const expr = parseExpression("10 - 5");
      if (t.isBinaryExpression(expr)) {
        const result = parseBinaryConcatenation(expr);
        expect(result).toBeNull();
      }
    });
  });

  describe("parseTernaryPlural", () => {
    it("should convert ternary comparison to ICU plural syntax", () => {
      const expr = parseExpression('count === 1 ? "1 item" : "multiple items"');
      expect(t.isConditionalExpression(expr)).toBe(true);

      if (t.isConditionalExpression(expr)) {
        const result = parseTernaryPlural(expr);
        expect(result).not.toBeNull();
        expect(result?.text).toBe("{count, plural, one {1 item} other {multiple items}}");
        expect(result?.variables).toEqual([{ token: "count", rawExpression: "count" }]);
      }
    });

    it("should handle 1 on the left side of equality", () => {
      const expr = parseExpression('1 == count ? "1 item" : "items"');
      if (t.isConditionalExpression(expr)) {
        const result = parseTernaryPlural(expr);
        expect(result).not.toBeNull();
        expect(result?.text).toBe("{count, plural, one {1 item} other {items}}");
      }
    });

    it("should return null if condition is not equality or 1", () => {
      const expr1 = parseExpression('isReady ? "Ready" : "Waiting"');
      if (t.isConditionalExpression(expr1)) {
        expect(parseTernaryPlural(expr1)).toBeNull();
      }

      const expr2 = parseExpression('count === 2 ? "Pair" : "Other"');
      if (t.isConditionalExpression(expr2)) {
        expect(parseTernaryPlural(expr2)).toBeNull();
      }
    });

    it("should handle member expressions and template literals in plural", () => {
      const expr = parseExpression(
        "cart.items.length === 1 ? `1 product` : `${cart.items.length} products`",
      );
      if (t.isConditionalExpression(expr)) {
        const result = parseTernaryPlural(expr);
        expect(result).not.toBeNull();
        expect(result?.text).toBe("{count, plural, one {1 product} other {{count} products}}");
        expect(result?.variables).toEqual([{ token: "count", rawExpression: "cart.items.length" }]);
      }
    });

    it("should return null for non-equality operators like > or <=", () => {
      const expr = parseExpression('count > 1 ? "multiple" : "one"');
      if (t.isConditionalExpression(expr)) {
        expect(parseTernaryPlural(expr)).toBeNull();
      }
    });

    it("should return null when consequent or alternate are not translatable strings", () => {
      const expr = parseExpression("count === 1 ? null : undefined");
      if (t.isConditionalExpression(expr)) {
        expect(parseTernaryPlural(expr)).toBeNull();
      }
    });

    it("should handle call expressions and literal strings in template expressions", () => {
      const expr = parseExpression('`Hello ${getUserName()} and ${"static"}`');
      if (t.isTemplateLiteral(expr)) {
        const result = parseTemplateLiteral(expr);
        expect(result?.text).toBe("Hello {param} and {static}");
      }
    });
  });
});

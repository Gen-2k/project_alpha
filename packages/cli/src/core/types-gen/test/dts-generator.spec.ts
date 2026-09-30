import { describe, expect, it } from "vitest";

import { generateDts } from "../dts-generator.js";

describe("generateDts", () => {
  it("generates fallback string type when catalog is empty", () => {
    const result = generateDts({});
    expect(result).toContain("export type GiltflowMessageKey = string;");
  });

  it("generates string union type for flat catalog", () => {
    const catalog = {
      checkoutTitle: "Checkout",
      payNow: "Pay now",
    };
    const result = generateDts(catalog);
    expect(result).toContain('  | "checkoutTitle"\n  | "payNow";');
    expect(result).toContain("namespace Giltflow");
  });

  it("generates flattened dot-notation keys for nested catalog", () => {
    const catalog = {
      checkout: {
        title: "Checkout",
        button: {
          submit: "Pay",
        },
      },
      home: "Home",
    };
    const result = generateDts(catalog);
    expect(result).toContain('  | "checkout.button.submit"');
    expect(result).toContain('  | "checkout.title"');
    expect(result).toContain('  | "home";');
  });
});

import { describe, expect, it } from "vitest";

import { generateKey } from "../key-naming.js";

describe("key-naming (Automatic Key Derivation)", () => {
  it("should generate snake_case key from text with component prefix", () => {
    const key = generateKey("Welcome to our application", "HeaderNav");
    expect(key).toBe("header_nav.welcome_to_our_application");
  });

  it("should truncate slug at 5 words", () => {
    const key = generateKey("One two three four five six seven", "Post");
    expect(key).toBe("post.one_two_three_four_five");
  });

  it("should strip ICU variable tokens before slugifying", () => {
    const key = generateKey("Hello, {name}! Welcome to {company}", "Greeting");
    expect(key).toBe("greeting.hello_welcome_to");
  });

  it("should fallback to 'text' when clean text contains no alphanumeric words", () => {
    const key = generateKey("{name}", "Avatar");
    expect(key).toBe("avatar.text");
  });

  it("should handle ICU plural expressions with count and custom variables", () => {
    const countKey = generateKey("{count, plural, one {1 item} other {items}}", "Cart");
    expect(countKey).toBe("cart.count_plural");

    const customKey = generateKey("{totalItems, plural, one {1 item} other {items}}", "Cart");
    expect(customKey).toBe("cart.total_items_count");
  });

  it("should resolve collision by appending numeric counter", () => {
    const existing = new Set<string>();
    const key1 = generateKey("Submit", "Form", existing);
    const key2 = generateKey("Submit", "Form", existing);
    const key3 = generateKey("Submit", "Form", existing);

    expect(key1).toBe("form.submit");
    expect(key2).toBe("form.submit_1");
    expect(key3).toBe("form.submit_2");
  });

  it("should handle key generation without componentName", () => {
    const key = generateKey("Save changes");
    expect(key).toBe("save_changes");
  });
});

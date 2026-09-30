import { describe, expect, it } from "vitest";

import { pseudoLocalize, pseudoLocalizeCatalog } from "../pseudo-localizer.js";

describe("Pseudo-Localization Engine", () => {
  it("should wrap text in brackets and expand length by ~40%", () => {
    const input = "Submit Order";
    const pseudo = pseudoLocalize(input);

    expect(pseudo.startsWith("[!! ")).toBe(true);
    expect(pseudo.endsWith(" !!]")).toBe(true);
    expect(pseudo.length).toBeGreaterThan(input.length * 1.3);
    expect(pseudo).toContain("~");
  });

  it("should preserve {variable} placeholder tokens unaltered", () => {
    const input = "Welcome back, {name}! You have {count} items.";
    const pseudo = pseudoLocalize(input);

    expect(pseudo).toContain("{name}");
    expect(pseudo).toContain("{count}");
    expect(pseudo).not.toContain("{ñàɱé}");

    const leadingToken = "{user} has joined";
    const pseudoLeading = pseudoLocalize(leadingToken);
    expect(pseudoLeading).toContain("{user}");
  });

  it("should preserve HTML and JSX tag structures unaltered", () => {
    const input = "Click <b>here</b> to read <a href='/terms'>Terms</a>.";
    const pseudo = pseudoLocalize(input);

    expect(pseudo).toContain("<b>");
    expect(pseudo).toContain("</b>");
    expect(pseudo).toContain("<a href='/terms'>");
    expect(pseudo).toContain("</a>");
  });

  it("should pseudo-localize an entire catalog recursively", () => {
    const catalog = {
      header: {
        title: "Dashboard",
      },
      welcome: "Welcome, {name}!",
      number: 123, // non-string, non-object handled
    };

    const pseudo = pseudoLocalizeCatalog(catalog) as {
      header: { title: string };
      welcome: string;
    };

    expect(pseudo.header.title.startsWith("[!! ")).toBe(true);
    expect(pseudo.welcome).toContain("{name}");
  });
});

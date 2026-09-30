import { describe, expect, it } from "vitest";

import { resolveTraverse, scanJsx } from "../jsx-scanner.js";

describe("JSX Scanner (String Detection)", () => {
  it("should extract raw JSX text from elements", () => {
    const code = `
      export function Header() {
        return (
          <header className="flex p-4">
            <h1>Welcome to Dashboard</h1>
            <p>Manage your account settings effortlessly.</p>
          </header>
        );
      }
    `;

    const result = scanJsx(code, "src/components/Header.tsx");

    expect(result.hasClientDirective).toBe(false);
    expect(result.strings).toHaveLength(2);
    expect(result.strings[0]?.text).toBe("Welcome to Dashboard");
    expect(result.strings[0]?.sourceType).toBe("jsx-text");
    expect(result.strings[0]?.componentName).toBe("Header");
    expect(result.strings[1]?.text).toBe("Manage your account settings effortlessly.");
  });

  it("should extract translatable attributes (placeholder, alt, title, aria-label)", () => {
    const code = `
      export function SearchBar() {
        return (
          <div className="search-box">
            <input type="text" placeholder="Search products..." id="search-input" />
            <img src="/logo.png" alt="Company Logo" title="Official Logo" />
            <button aria-label={\`Clear search query \${tag}\`}>X</button>
          </div>
        );
      }
    `;

    const result = scanJsx(code, "src/components/SearchBar.tsx");

    expect(result.strings).toHaveLength(4);
    expect(result.strings[0]?.text).toBe("Search products...");
    expect(result.strings[0]?.attributeName).toBe("placeholder");
    expect(result.strings[1]?.text).toBe("Company Logo");
    expect(result.strings[1]?.attributeName).toBe("alt");
    expect(result.strings[2]?.text).toBe("Official Logo");
    expect(result.strings[2]?.attributeName).toBe("title");
    expect(result.strings[3]?.text).toBe("Clear search query {tag}");
    expect(result.strings[3]?.attributeName).toBe("aria-label");
  });

  it("should ignore code blocks, script tags, and non-translatable text", () => {
    const code = `
      export function Docs() {
        return (
          <div>
            <h2>API Documentation</h2>
            <code>npm install @repo/cli</code>
            <pre>const x = 42;</pre>
            <span className="badge">123</span>
            <span>---</span>
          </div>
        );
      }
    `;

    const result = scanJsx(code, "src/components/Docs.tsx");

    expect(result.strings).toHaveLength(1);
    expect(result.strings[0]?.text).toBe("API Documentation");
  });

  it("should detect the 'use client' directive", () => {
    const code = `
      "use client";
      import { useState } from "react";

      export function Counter() {
        return <button>Click me to increment</button>;
      }
    `;

    const result = scanJsx(code, "src/components/Counter.tsx");

    expect(result.hasClientDirective).toBe(true);
    expect(result.strings).toHaveLength(1);
    expect(result.strings[0]?.text).toBe("Click me to increment");
  });

  it("should normalize multi-line JSX text correctly", () => {
    const code = `
      export function Hero() {
        return (
          <p>
            This is a multi-line paragraph
            that spans multiple source code lines
            with irregular indentation.
          </p>
        );
      }
    `;

    const result = scanJsx(code, "src/components/Hero.tsx");

    expect(result.strings).toHaveLength(1);
    expect(result.strings[0]?.text).toBe(
      "This is a multi-line paragraph that spans multiple source code lines with irregular indentation.",
    );
  });

  it("should extract template literals and binary concatenations with variables", () => {
    const code = `
      export function NotificationBanner({ user, count }: Props) {
        return (
          <div>
            <span>{\`Hello, \${user.name}! You have \${count} updates.\`}</span>
            <p>{"Current status: " + status}</p>
          </div>
        );
      }
    `;

    const result = scanJsx(code, "src/components/NotificationBanner.tsx");

    expect(result.strings).toHaveLength(2);
    expect(result.strings[0]?.text).toBe("Hello, {name}! You have {count} updates.");
    expect(result.strings[0]?.variables).toEqual([
      { token: "name", rawExpression: "user.name" },
      { token: "count", rawExpression: "count" },
    ]);
    expect(result.strings[1]?.text).toBe("Current status: {status}");
    expect(result.strings[1]?.variables).toEqual([{ token: "status", rawExpression: "status" }]);
  });

  it("should extract ternary plural expressions", () => {
    const code = `
      export function ItemCount({ count }: { count: number }) {
        return <span>{count === 1 ? "1 item" : "multiple items"}</span>;
      }
    `;

    const result = scanJsx(code, "src/components/ItemCount.tsx");
    expect(result.strings).toHaveLength(1);
    expect(result.strings[0]?.text).toBe("{count, plural, one {1 item} other {multiple items}}");
  });

  it("should detect component name inside forwardRef and memo wrappers", () => {
    const code = `
      import React, { forwardRef } from "react";

      export const CustomButton = forwardRef(function CustomButton(props, ref) {
        return <button ref={ref}>Click to Proceed</button>;
      });
    `;

    const result = scanJsx(code, "src/components/CustomButton.tsx");
    expect(result.strings).toHaveLength(1);
    expect(result.strings[0]?.text).toBe("Click to Proceed");
    expect(result.strings[0]?.componentName).toBe("CustomButton");
  });

  it("should skip mixed inline children to prevent sentence fragmentation", () => {
    const code = `
      export function Terms() {
        return <p>Please read our <a href="/terms">Terms</a> carefully.</p>;
      }
    `;

    const result = scanJsx(code, "src/components/Terms.tsx");
    // "Terms" inside <a> is pure JSXText within <a> (not mixed), while <p> contains mixed children
    expect(result.strings).toHaveLength(1);
    expect(result.strings[0]?.text).toBe("Terms");
  });

  it("should return empty result safely on parse syntax error", () => {
    const code = `export function Broken() { return <div className=; }`;
    const result = scanJsx(code, "Broken.tsx");
    expect(result.strings).toHaveLength(0);
    expect(result.hasClientDirective).toBe(false);
  });

  it("should detect component name in export default function declaration", () => {
    const code = `
      export default function DashboardPage() {
        return <h1>Dashboard Overview</h1>;
      }
    `;
    const result = scanJsx(code, "page.tsx");
    expect(result.strings).toHaveLength(1);
    expect(result.strings[0]?.componentName).toBe("DashboardPage");
  });

  it("should safely handle JSX spread attributes alongside translatable attributes", () => {
    const code = `
      export function InputWrapper(props: any) {
        return <input {...props} placeholder="Enter your query" />;
      }
    `;
    const result = scanJsx(code, "InputWrapper.tsx");
    expect(result.strings).toHaveLength(1);
    expect(result.strings[0]?.text).toBe("Enter your query");
  });

  it("should handle lowercase component names and anonymous export default", () => {
    const code1 = `
      const myWidget = () => <div>Widget Text</div>;
    `;
    const result1 = scanJsx(code1, "Widget.tsx");
    expect(result1.strings).toHaveLength(1);

    const code2 = `
      export default () => <h1>Welcome Anonymous</h1>;
    `;
    const result2 = scanJsx(code2, "Hero.tsx");
    expect(result2.strings).toHaveLength(1);
    expect(result2.strings[0]?.componentName).toBe("Hero");
  });

  it("should detect component names across wrapped React.memo export default and named function exports", () => {
    const codeMemo = `
      import React from "react";
      export default React.memo(() => {
        return <span>Memoized Card</span>;
      });
    `;
    const resMemo = scanJsx(codeMemo, "MemoCard.tsx");
    expect(resMemo.strings).toHaveLength(1);
    expect(resMemo.strings[0]?.componentName).toBe("MemoCard");

    const codeNamedExpr = `
      export default (function DefaultArticle() {
        return <article>Article Body</article>;
      });
    `;
    const resNamed = scanJsx(codeNamedExpr, "article.tsx");
    expect(resNamed.strings).toHaveLength(1);
    expect(resNamed.strings[0]?.componentName).toBe("DefaultArticle");

    const codeNestedCall = `
      const el = wrapper(<span>Nested Call Text</span>);
    `;
    const resNested = scanJsx(codeNestedCall, "nested.tsx");
    expect(resNested.strings).toHaveLength(1);
    expect(resNested.strings[0]?.text).toBe("Nested Call Text");
  });

  it("should handle lowercase function declaration and non-function variables", () => {
    const code = `
      let unassigned;
      const notAFunc = 123;
      function renderSubHeader() {
        return <h3>Sub Header</h3>;
      }
    `;
    const result = scanJsx(code, "SubHeader.tsx");
    expect(result.strings).toHaveLength(1);
    expect(result.strings[0]?.text).toBe("Sub Header");
  });

  it("should scan code with duplicate declarations without scope collision errors", () => {
    const code = `
      const t = 1;
      const t = 2;
      export function Comp() {
        return <div>Hello Duplicate</div>;
      }
    `;
    const result = scanJsx(code, "Comp.tsx");
    expect(result.strings).toHaveLength(1);
    expect(result.strings[0]?.text).toBe("Hello Duplicate");
  });

  it("should extract button text when preceded by an icon element", () => {
    const code = `
      export function ActionButtons() {
        return (
          <button>
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </button>
        );
      }
    `;
    const result = scanJsx(code, "ActionButtons.tsx");
    expect(result.strings).toHaveLength(1);
    expect(result.strings[0]?.text).toBe("Try Again");
  });

  it("should extract both branches of non-plural conditional expressions", () => {
    const code = `
      export function ErrorNotice({ scope }: { scope: string }) {
        return (
          <p>
            {scope === 'route' ? 'Something went wrong' : 'Application Error'}
          </p>
        );
      }
    `;
    const result = scanJsx(code, "ErrorNotice.tsx");
    expect(result.strings).toHaveLength(2);
    expect(result.strings.map((s) => s.text)).toEqual([
      "Something went wrong",
      "Application Error",
    ]);
  });

  it("should extract natural language messages in component variable declarations", () => {
    const code = `
      export function ErrorFallback({ isDev, error }: any) {
        const errorMessage = isDev ? error.message : 'An unexpected application error has occurred. Please try again later.';
        const errorStack = error.stack ?? 'Stack trace unavailable.';
        return <div>{errorMessage}</div>;
      }
    `;
    const result = scanJsx(code, "ErrorFallback.tsx");
    expect(result.strings).toHaveLength(2);
    expect(result.strings.map((s) => s.text)).toContain(
      "An unexpected application error has occurred. Please try again later.",
    );
    expect(result.strings.map((s) => s.text)).toContain("Stack trace unavailable.");
  });

  describe("resolveTraverse fallbacks", () => {
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

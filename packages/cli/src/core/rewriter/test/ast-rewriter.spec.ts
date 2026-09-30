import { describe, expect, it } from "vitest";

import { resolveGenerator, resolveTraverse, rewriteJsx } from "../ast-rewriter.js";

describe("AST Rewriter (Auto-Wrapping with t())", () => {
  it("should wrap JSX text with t() and inject useTranslations in Client Components", () => {
    const input = `
"use client";
import { useState } from "react";

export function Header() {
  return (
    <header>
      <h1>Welcome to Store</h1>
    </header>
  );
}
    `.trim();

    const result = rewriteJsx(input);

    expect(result.hasClientDirective).toBe(true);
    expect(result.code).toContain('import { useTranslations } from "next-intl";');
    expect(result.code).toContain("const t = useTranslations();");
    expect(result.code).toContain('{t("header.welcome_to_store")}');
    expect(result.extractedEntries["header.welcome_to_store"]).toBe("Welcome to Store");
  });

  it("should inject async getTranslations and automatically mark sync Server Component as async", () => {
    const input = `
export function ProductPage() {
  return (
    <main>
      <h1>Featured Products</h1>
    </main>
  );
}
    `.trim();

    const result = rewriteJsx(input);

    expect(result.hasClientDirective).toBe(false);
    expect(result.code).toContain('import { getTranslations } from "next-intl/server";');
    expect(result.code).toContain("const t = await getTranslations();");
    expect(result.code).toContain("export async function ProductPage()");
    expect(result.code).toContain('{t("product_page.featured_products")}');
    expect(result.extractedEntries["product_page.featured_products"]).toBe("Featured Products");
  });

  it("should inject async getTranslations in already-async Server Components", () => {
    const input = `
export async function UserList() {
  return (
    <div>
      <h2>User Directory</h2>
    </div>
  );
}
    `.trim();

    const result = rewriteJsx(input);

    expect(result.code).toContain("const t = await getTranslations();");
    expect(result.code).toContain('{t("user_list.user_directory")}');
  });

  it("should inject hooks into wrapped components like forwardRef or memo", () => {
    const input = `
"use client";
import { forwardRef } from "react";

export const CustomInput = forwardRef((props, ref) => {
  return <input ref={ref} placeholder="Enter your email" />;
});
    `.trim();

    const result = rewriteJsx(input);

    expect(result.code).toContain('import { useTranslations } from "next-intl";');
    expect(result.code).toContain("const t = useTranslations();");
    expect(result.code).toContain('placeholder={t("custom_input.enter_your_email")}');
  });

  it("should wrap translatable attributes like placeholder and alt", () => {
    const input = `
"use client";
export function Search() {
  return (
    <div>
      <input placeholder="Search catalog..." />
      <img src="/logo.png" alt="Company Logo" />
    </div>
  );
}
    `.trim();

    const result = rewriteJsx(input);

    expect(result.code).toContain('placeholder={t("search.search_catalog")}');
    expect(result.code).toContain('alt={t("search.company_logo")}');
    expect(result.extractedEntries["search.search_catalog"]).toBe("Search catalog...");
    expect(result.extractedEntries["search.company_logo"]).toBe("Company Logo");
  });

  it("should handle template literals with variables", () => {
    const input = `
"use client";
export function Greeting({ user }: Props) {
  return <div>{\`Hello, \${user.name}!\`}</div>;
}
    `.trim();

    const result = rewriteJsx(input);

    expect(result.code).toContain('t("greeting.hello", {');
    expect(result.code).toContain("name: user.name");
    expect(result.extractedEntries["greeting.hello"]).toBe("Hello, {name}!");
  });

  it("should handle binary string concatenations with variables", () => {
    const input = `
"use client";
export function Welcome({ name }: Props) {
  return <div>{"Welcome " + name + " to portal"}</div>;
}
    `.trim();

    const result = rewriteJsx(input);
    expect(result.code).toContain('t("welcome.welcome_to_portal", {');
  });

  it("should extract ternary plural expression into ICU message", () => {
    const input = `
"use client";
export function Cart({ count }: { count: number }) {
  return <div>{count === 1 ? "1 item" : "multiple items"}</div>;
}
    `.trim();

    const result = rewriteJsx(input);

    expect(result.extractedEntries["cart.count_plural"]).toBe(
      "{count, plural, one {1 item} other {multiple items}}",
    );
    expect(result.code).toContain('t("cart.count_plural", {');
    expect(result.code).toContain("count: count");
  });

  it("should support react-i18next preset with { t } destructuring and useTranslation", () => {
    const input = `
export function Profile() {
  return <h2>User Profile</h2>;
}
    `.trim();

    const result = rewriteJsx(input, { framework: "react-i18next" });

    expect(result.code).toContain('import { useTranslation } from "react-i18next";');
    expect(result.code).toMatch(/const\s*\{\s*t\s*\}\s*=\s*useTranslation\(\);/);
    expect(result.code).toContain('{t("profile.user_profile")}');
    expect(result.extractedEntries["profile.user_profile"]).toBe("User Profile");
  });

  it("should leave code unmodified if no translatable text is present", () => {
    const input = `
export function Divider() {
  return <hr className="my-4 border-gray-200" />;
}
    `.trim();

    const result = rewriteJsx(input);

    expect(result.code).toBe(input);
    expect(Object.keys(result.extractedEntries)).toHaveLength(0);
  });

  it("should ignore internal helper functions and keep PascalCase component name and hook location", () => {
    const input = `
export const SettingsView = () => {
  const [copied, setCopied] = useState(false);
  const copyEnvToClipboard = () => {
    navigator.clipboard.writeText("test");
  };
  return <h1>Settings & Preferences</h1>;
};
    `.trim();

    const result = rewriteJsx(input, {
      framework: "react-i18next",
      filePath: "SettingsView.tsx",
    });

    expect(result.extractedEntries["settings_view.settings_preferences"]).toBe(
      "Settings & Preferences",
    );
    expect(result.code).toContain('{t("settings_view.settings_preferences")}');
    expect(result.code).toMatch(
      /export const SettingsView = \(\) => \{\s*const \{\s*t\s*\} = useTranslation\(\);/,
    );
  });

  it("should skip mixed inline children to protect sentence cohesion", () => {
    const input = `
export function MixedDoc() {
  return <p>Visit our <a>documentation</a> today.</p>;
}
    `.trim();

    const result = rewriteJsx(input);
    // <p> text is not rewritten as isolated fragments, only pure child <a> is rewritten
    expect(result.code).toContain('{t("mixed_doc.documentation")}');
    expect(result.code).toContain("<p>Visit our <a>");
  });

  it("should not inject duplicate hook or duplicate import if they already exist", () => {
    const input = `
"use client";
import { useTranslations } from "next-intl";

export function Existing() {
  const t = useTranslations();
  return <div>New Message</div>;
}
    `.trim();

    const result = rewriteJsx(input);
    const importMatches = result.code.match(/import \{ useTranslations \} from "next-intl";/g);
    expect(importMatches?.length).toBe(1);

    const hookMatches = result.code.match(/const t = useTranslations\(\);/g);
    expect(hookMatches?.length).toBe(1);
    expect(result.code).toContain('{t("existing.new_message")}');
  });

  it("should not inject duplicate hook for react-i18next if destructured t already exists", () => {
    const input = `
import { useTranslation } from "react-i18next";

export function ExistingI18n() {
  const { t } = useTranslation();
  return <div>Additional Text</div>;
}
    `.trim();

    const result = rewriteJsx(input, { framework: "react-i18next" });
    const hookMatches = result.code.match(/const\s*\{\s*t\s*\}\s*=\s*useTranslation\(\);/g);
    expect(hookMatches?.length).toBe(1);
  });

  it("should preserve non-string JSX expression containers like numbers or null", () => {
    const input = `
export function NumberContainer() {
  return <div>{123}{null}<span>Hello User</span></div>;
}
    `.trim();

    const result = rewriteJsx(input);
    expect(result.code).toContain("{123}");
    expect(result.code).toContain("{null}");
    expect(result.code).toContain('{t("number_container.hello_user")}');
  });

  it("should handle syntax errors gracefully by returning original code", () => {
    const brokenCode = "export function Broken() { return <div className=; }";
    const result = rewriteJsx(brokenCode);
    expect(result.code).toBe(brokenCode);
    expect(result.extractedEntries).toEqual({});
  });

  it("should skip ignored JSX elements like code and pre blocks", () => {
    const input = `
export function Documentation() {
  return (
    <div>
      <code>npm install @repo/cli</code>
      <pre>const x = 1;</pre>
      <h1>Getting Started</h1>
    </div>
  );
}
    `.trim();

    const result = rewriteJsx(input);
    expect(result.code).toContain("<code>npm install @repo/cli</code>");
    expect(result.code).toContain("<pre>const x = 1;</pre>");
    expect(result.code).toContain('{t("documentation.getting_started")}');
    expect(result.extractedEntries["documentation.getting_started"]).toBe("Getting Started");
    expect(result.extractedEntries["npm install @repo/cli"]).toBeUndefined();
  });

  it("should handle JSX spread attributes alongside translatable attributes", () => {
    const input = `
"use client";
export function InputField(props: any) {
  return <input {...props} placeholder="Enter your username" />;
}
    `.trim();

    const result = rewriteJsx(input);
    expect(result.code).toContain('placeholder={t("input_field.enter_your_username")}');
  });

  it("should convert concise arrow function components into block statements", () => {
    const input = `
"use client";
export const Banner = () => <div>Important Announcement</div>;
    `.trim();

    const result = rewriteJsx(input);
    expect(result.code).toContain('import { useTranslations } from "next-intl";');
    expect(result.code).toContain("const t = useTranslations();");
    expect(result.code).toContain('return <div>{t("banner.important_announcement")}</div>;');
  });

  it("should handle lowercase helper functions and uninitialized variables", () => {
    const input = `
"use client";
let unassigned;
const nonFunction = 42;

function renderHelper() {
  return <span>Helper Text</span>;
}

const renderArrow = () => <span>Arrow Text</span>;
    `.trim();

    const result = rewriteJsx(input, { filePath: "CustomWidget.tsx" });
    expect(result.code).toContain('import { useTranslations } from "next-intl";');
    expect(result.code).toContain('{t("custom_widget.helper_text")}');
    expect(result.code).toContain('{t("custom_widget.arrow_text")}');
  });

  it("should support various export default patterns", () => {
    const defaultFn = `
export default function DefaultPage() {
  return <h1>Main Page</h1>;
}
    `.trim();
    const res1 = rewriteJsx(defaultFn);
    expect(res1.code).toContain('{t("default_page.main_page")}');

    const defaultConcise = `
"use client";
export default () => <div>Concise Default</div>;
    `.trim();
    const res2 = rewriteJsx(defaultConcise, { filePath: "page.tsx" });
    expect(res2.code).toContain('{t("page.concise_default")}');

    const defaultMemo = `
"use client";
import React from "react";
export default React.memo(() => <div>Memoized Default</div>);
    `.trim();
    const res3 = rewriteJsx(defaultMemo, { filePath: "memo.tsx" });
    expect(res3.code).toContain('{t("memo.memoized_default")}');
  });

  it("should rewrite JSX at top-level outside of any enclosing function", () => {
    const input = `const staticElement = <div>Global Static Text</div>;`;
    const result = rewriteJsx(input, { filePath: "static.tsx" });
    expect(result.code).toContain('{t("static.global_static_text")}');
    expect(result.extractedEntries["static.global_static_text"]).toBe("Global Static Text");
  });

  it("should handle non-expression statement variables and generator yields in expressions", () => {
    const input = `
"use client";
export function* GeneratorComp() {
  const obj = { val: 1 };
  return (
    <div>
      {\`Data: \${"hello world"}\`}
      {\`Yielded: \${yield 42}\`}
    </div>
  );
}
    `.trim();

    const result = rewriteJsx(input);
    expect(result.code).toContain('t("generator_comp.data", {');
    expect(result.code).toContain('t("generator_comp.yielded", {');
  });

  it("should rewrite code with duplicate declarations without scope collision errors", () => {
    const input = `
const t = 1;
const t = 2;
export function Comp() {
  return <div>Hello Duplicate</div>;
}
    `.trim();

    const result = rewriteJsx(input);
    expect(Object.keys(result.extractedEntries).length).toBe(1);
    expect(result.code).toContain('t("comp.hello_duplicate")');
  });

  it("should rewrite button text when preceded by an icon element", () => {
    const input = `
export function ActionButtons() {
  return (
    <button>
      <RefreshCw className="h-3.5 w-3.5" />
      Try Again
    </button>
  );
}
    `.trim();

    const result = rewriteJsx(input);
    expect(result.code).toContain('t("action_buttons.try_again")');
  });

  it("should rewrite both branches of non-plural conditional expressions", () => {
    const input = `
export function ErrorNotice({ scope }: { scope: string }) {
  return (
    <p>
      {scope === 'route' ? 'Something went wrong' : 'Application Error'}
    </p>
  );
}
    `.trim();

    const result = rewriteJsx(input);
    expect(result.code).toContain('t("error_notice.something_went_wrong")');
    expect(result.code).toContain('t("error_notice.application_error")');
  });

  it("should rewrite natural language messages in component variable declarations", () => {
    const input = `
export function ErrorFallback({ isDev, error }: any) {
  const errorMessage = isDev ? error.message : 'An unexpected application error has occurred. Please try again later.';
  const errorStack = error.stack ?? 'Stack trace unavailable.';
  return <div>{errorMessage}</div>;
}
    `.trim();

    const result = rewriteJsx(input);
    expect(result.code).toContain("const errorMessage = isDev ? error.message : t(");
    expect(result.code).toContain("const errorStack = error.stack ?? t(");
  });

  describe("resolveTraverse & resolveGenerator fallbacks", () => {
    it("should resolve direct functions", () => {
      const dummyFn = () => ({ code: "" });
      expect(typeof resolveTraverse(dummyFn)).toBe("function");
      expect(typeof resolveGenerator(dummyFn)).toBe("function");
    });

    it("should resolve single-level default objects", () => {
      const dummyFn = () => ({ code: "" });
      expect(typeof resolveTraverse({ default: dummyFn })).toBe("function");
      expect(typeof resolveGenerator({ default: dummyFn })).toBe("function");
    });

    it("should resolve two-level nested default objects", () => {
      const dummyFn = () => ({ code: "" });
      expect(typeof resolveTraverse({ default: { default: dummyFn } })).toBe("function");
      expect(typeof resolveGenerator({ default: { default: dummyFn } })).toBe("function");
    });

    it("should throw when module is unresolvable", () => {
      expect(() => resolveTraverse({})).toThrow(
        "Unable to resolve callable @babel/traverse function",
      );
      expect(() => resolveGenerator({})).toThrow(
        "Unable to resolve callable @babel/generator function",
      );
    });
  });
});

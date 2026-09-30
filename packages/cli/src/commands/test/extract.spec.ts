import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runExtract } from "../extract.js";

describe("runExtract Command", () => {
  let tempDir: string;
  let localesDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `giltflow-extract-test-${String(Date.now())}`);
    localesDir = join(tempDir, "locales");
    await mkdir(tempDir, { recursive: true });
    await mkdir(localesDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should handle empty project directory without errors", async () => {
    await expect(runExtract({ path: tempDir, localesDir })).resolves.not.toThrow();
  });

  it("should handle project with no translatable strings without rewriting", async () => {
    const componentCode = `export function Divider() { return <hr className="my-2" />; }`;
    const filePath = join(tempDir, "Divider.tsx");
    await writeFile(filePath, componentCode, "utf-8");

    await runExtract({ path: tempDir, localesDir });

    const content = await readFile(filePath, "utf-8");
    expect(content).toBe(componentCode);
  });

  it("should support nested structure with --nested option", async () => {
    const componentCode = `
      export function UserCard() {
        return <div>Profile Overview</div>;
      }
    `;
    await writeFile(join(tempDir, "UserCard.tsx"), componentCode, "utf-8");

    await runExtract({ path: tempDir, localesDir, nested: true });

    const enPath = join(localesDir, "en.json");
    const enContent = await readFile(enPath, "utf-8");
    const en = JSON.parse(enContent) as { user_card: { profile_overview: string } };

    expect(en.user_card.profile_overview).toBe("Profile Overview");
  });

  it("should support namespace splitting with --split option", async () => {
    const componentCode = `
      export function CheckoutForm() {
        return <div>Payment Summary</div>;
      }
    `;
    await writeFile(join(tempDir, "CheckoutForm.tsx"), componentCode, "utf-8");

    await runExtract({ path: tempDir, localesDir, split: true });

    const splitFilePath = join(localesDir, "en", "checkout_form.json");
    const splitContent = await readFile(splitFilePath, "utf-8");
    const splitJson = JSON.parse(splitContent) as Record<string, string>;

    expect(splitJson["checkout_form.payment_summary"]).toBe("Payment Summary");
  });

  it("should merge with existing en.json and split namespace files when they already exist", async () => {
    await mkdir(join(localesDir, "en"), { recursive: true });
    await writeFile(
      join(localesDir, "en.json"),
      JSON.stringify({ "existing.key": "Pre-existing" }),
      "utf-8",
    );
    await writeFile(
      join(localesDir, "en", "login.json"),
      JSON.stringify({ "login.old": "Old Value" }),
      "utf-8",
    );

    const componentCode = `export function Login() { return <h1>Sign In</h1>; }`;
    await writeFile(join(tempDir, "Login.tsx"), componentCode, "utf-8");

    await runExtract({ path: tempDir, localesDir, split: true });

    const enContent = await readFile(join(localesDir, "en.json"), "utf-8");
    const enJson = JSON.parse(enContent) as Record<string, string>;
    expect(enJson["existing.key"]).toBe("Pre-existing");
    expect(enJson["login.sign_in"]).toBe("Sign In");

    const splitContent = await readFile(join(localesDir, "en", "login.json"), "utf-8");
    const splitJson = JSON.parse(splitContent) as Record<string, string>;
    expect(splitJson["login.old"]).toBe("Old Value");
    expect(splitJson["login.sign_in"]).toBe("Sign In");
  });

  it("should auto-detect Vite/React project and use react-i18next", async () => {
    const pkg = {
      dependencies: { react: "^18.0.0", vite: "^5.0.0" },
    };
    await writeFile(join(tempDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");

    const componentCode = `
      export function Nav() {
        return <nav>Explore More</nav>;
      }
    `;
    const compFile = join(tempDir, "Nav.tsx");
    await writeFile(compFile, componentCode, "utf-8");

    await runExtract({ path: tempDir, localesDir });

    const rewritten = await readFile(compFile, "utf-8");
    expect(rewritten).toContain('import { useTranslation } from "react-i18next";');
    expect(rewritten).toMatch(/const\s*\{\s*t\s*\}\s*=\s*useTranslation\(\);/);
  });

  it("should preview extraction without writing changes when dryRun is true", async () => {
    const componentCode = `export function DryRunCard() { return <h2>Preview Only</h2>; }`;
    const compFile = join(tempDir, "DryRunCard.tsx");
    await writeFile(compFile, componentCode, "utf-8");

    await runExtract({ path: tempDir, localesDir, dryRun: true });

    // File content should remain completely unmodified
    const unwrittenContent = await readFile(compFile, "utf-8");
    expect(unwrittenContent).toBe(componentCode);

    // Master en.json should not have been created/written
    let catalogExists = true;
    try {
      await readFile(join(localesDir, "en.json"));
    } catch {
      catalogExists = false;
    }
    expect(catalogExists).toBe(false);
  });
});

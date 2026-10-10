import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runValidate } from "../validate.js";

describe("runValidate Command", () => {
  let tempDir: string;
  let localesDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `giltflow-validate-test-${String(Date.now())}`);
    localesDir = join(tempDir, "locales");
    await mkdir(localesDir, { recursive: true });
    process.exitCode = undefined;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    process.exitCode = undefined;
  });

  it("should return true when locales directory does not exist (skip validation)", async () => {
    const success = await runValidate({ localesDir: join(tempDir, "missing_dir") });
    expect(success).toBe(true);
  });

  it("should fail closed in CI mode when locales directory does not exist", async () => {
    const success = await runValidate({ localesDir: join(tempDir, "missing_dir"), ci: true });
    expect(success).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it("should return false if source catalog is missing", async () => {
    const success = await runValidate({ localesDir, sourceLocale: "en" });
    expect(success).toBe(false);
  });

  it("should set exitCode = 1 in CI mode if source catalog is missing", async () => {
    const success = await runValidate({ localesDir, sourceLocale: "en", ci: true });
    expect(success).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it("should return true when no target catalogs exist to validate against", async () => {
    await writeFile(join(localesDir, "en.json"), JSON.stringify({ hello: "Hello" }), "utf-8");
    const success = await runValidate({ localesDir, sourceLocale: "en" });
    expect(success).toBe(true);
  });

  it("should return true when all target catalogs are 100% valid", async () => {
    await writeFile(
      join(localesDir, "en.json"),
      JSON.stringify({ greeting: "Welcome {user}" }),
      "utf-8",
    );
    await writeFile(
      join(localesDir, "fr.json"),
      JSON.stringify({ greeting: "Bienvenue {user}" }),
      "utf-8",
    );

    const success = await runValidate({ localesDir, sourceLocale: "en" });
    expect(success).toBe(true);
  });

  it("should return false and flag syntax errors when variables are missing in target", async () => {
    await writeFile(
      join(localesDir, "en.json"),
      JSON.stringify({ greeting: "Welcome {user}" }),
      "utf-8",
    );
    await writeFile(
      join(localesDir, "fr.json"),
      JSON.stringify({ greeting: "Bienvenue" }), // Missing {user}
      "utf-8",
    );

    const success = await runValidate({ localesDir, sourceLocale: "en", ci: true });
    expect(success).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it("should handle invalid JSON in target file gracefully and fail", async () => {
    await writeFile(join(localesDir, "en.json"), JSON.stringify({ test: "Value" }), "utf-8");
    await writeFile(join(localesDir, "es.json"), "{ invalid json", "utf-8");

    const success = await runValidate({ localesDir, sourceLocale: "en" });
    expect(success).toBe(false);
  });
});

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runTypes } from "../types.js";

describe("runTypes Command", () => {
  let tempDir: string;
  let localesDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `giltflow-types-test-${String(Date.now())}`);
    localesDir = join(tempDir, "locales");
    await mkdir(localesDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should generate TypeScript definitions from source catalog", async () => {
    const catalog = {
      nav: {
        home: "Home",
        about: "About",
      },
      logout: "Log out",
    };
    await writeFile(join(localesDir, "en.json"), JSON.stringify(catalog, null, 2), "utf-8");

    const outputPath = join(tempDir, "giltflow.d.ts");
    await runTypes({
      localesDir,
      sourceLocale: "en",
      output: outputPath,
    });

    const dts = await readFile(outputPath, "utf-8");
    expect(dts).toContain('  | "logout"');
    expect(dts).toContain('  | "nav.about"');
    expect(dts).toContain('  | "nav.home";');
    expect(dts).toContain("declare global {");
  });

  it("should handle missing source catalog without throwing", async () => {
    const outputPath = join(tempDir, "giltflow.d.ts");
    await expect(
      runTypes({
        localesDir: join(tempDir, "non_existent"),
        output: outputPath,
      }),
    ).resolves.not.toThrow();
  });

  it("should run with default parameters when no options are provided", async () => {
    await expect(runTypes()).resolves.not.toThrow();
  });
});

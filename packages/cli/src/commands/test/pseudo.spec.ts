import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runPseudo } from "../pseudo.js";

describe("runPseudo Command", () => {
  let tempDir: string;
  let localesDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `giltflow-pseudo-test-${String(Date.now())}`);
    localesDir = join(tempDir, "locales");
    await mkdir(localesDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should generate pseudo.json with expanded accented strings", async () => {
    const catalog = {
      greeting: "Hello {name}",
      checkout: "Proceed to payment",
    };
    await writeFile(join(localesDir, "en.json"), JSON.stringify(catalog, null, 2), "utf-8");

    await runPseudo({ localesDir, sourceLocale: "en" });

    const pseudoPath = join(localesDir, "pseudo.json");
    const content = await readFile(pseudoPath, "utf-8");
    const pseudo = JSON.parse(content) as Record<string, string>;

    expect(pseudo.greeting).toContain("{name}");
    expect(pseudo.greeting?.startsWith("[!! ")).toBe(true);
    expect(pseudo.checkout?.startsWith("[!! ")).toBe(true);
  });

  it("should handle missing source catalog without throwing", async () => {
    await expect(
      runPseudo({ localesDir: join(tempDir, "missing_locales") }),
    ).resolves.not.toThrow();
  });

  it("should run with default parameters when no options are provided", async () => {
    await expect(runPseudo()).resolves.not.toThrow();
  });
});

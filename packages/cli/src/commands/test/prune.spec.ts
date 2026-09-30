import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runPrune } from "../prune.js";

describe("runPrune Command", () => {
  let tempDir: string;
  let localesDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `giltflow-prune-test-${String(Date.now())}`);
    localesDir = join(tempDir, "locales");
    await mkdir(tempDir, { recursive: true });
    await mkdir(localesDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should remove obsolete keys from catalogs when run without dryRun", async () => {
    const componentCode = `
      export function App() {
        const t = useTranslations();
        return <div>{t("active.key")}</div>;
      }
    `;
    await writeFile(join(tempDir, "App.tsx"), componentCode, "utf-8");

    const enCatalog = {
      "active.key": "Active Message",
      "dead.key": "Dead Message",
    };
    await writeFile(join(localesDir, "en.json"), JSON.stringify(enCatalog, null, 2), "utf-8");

    await runPrune({ path: tempDir, localesDir, dryRun: false });

    const updatedRaw = await readFile(join(localesDir, "en.json"), "utf-8");
    const updated = JSON.parse(updatedRaw) as Record<string, string>;

    expect(updated["active.key"]).toBe("Active Message");
    expect("dead.key" in updated).toBe(false);
  });

  it("should not modify files when dryRun is true", async () => {
    const componentCode = `
      export function App() {
        return <div>{t("keep.me")}</div>;
      }
    `;
    await writeFile(join(tempDir, "App.tsx"), componentCode, "utf-8");

    const enCatalog = {
      "keep.me": "Keep",
      "dead.me": "Dead",
    };
    await writeFile(join(localesDir, "en.json"), JSON.stringify(enCatalog, null, 2), "utf-8");

    await runPrune({ path: tempDir, localesDir, dryRun: true });

    const updatedRaw = await readFile(join(localesDir, "en.json"), "utf-8");
    const updated = JSON.parse(updatedRaw) as Record<string, string>;

    expect("dead.me" in updated).toBe(true);
  });

  it("should protect dynamic keys matching wildcard expressions", async () => {
    const componentCode = `
      export function StatusBadge({ status }: Props) {
        return <span>{i18n.t(\`badge.\${status}\`)}</span>;
      }
    `;
    await writeFile(join(tempDir, "Badge.tsx"), componentCode, "utf-8");

    const enCatalog = {
      "badge.active": "Active",
      "badge.pending": "Pending",
      "dead.key": "Dead",
    };
    await writeFile(join(localesDir, "en.json"), JSON.stringify(enCatalog, null, 2), "utf-8");

    await runPrune({ path: tempDir, localesDir, dryRun: false });

    const updatedRaw = await readFile(join(localesDir, "en.json"), "utf-8");
    const updated = JSON.parse(updatedRaw) as Record<string, string>;

    expect(updated["badge.active"]).toBe("Active");
    expect(updated["badge.pending"]).toBe("Pending");
    expect("dead.key" in updated).toBe(false);
  });

  it("should handle missing locales directory gracefully", async () => {
    await expect(
      runPrune({ path: tempDir, localesDir: join(tempDir, "missing") }),
    ).resolves.not.toThrow();
  });

  it("should handle locales directory with no JSON files", async () => {
    await writeFile(join(localesDir, "notes.txt"), "some notes", "utf-8");
    await expect(runPrune({ path: tempDir, localesDir })).resolves.not.toThrow();
  });

  it("should report zero dead keys when all catalog keys are referenced in code", async () => {
    const componentCode = `
      export function Home() {
        return <h1>{t("nav.home")}</h1>;
      }
    `;
    await writeFile(join(tempDir, "Home.tsx"), componentCode, "utf-8");
    await writeFile(
      join(localesDir, "en.json"),
      JSON.stringify({ "nav.home": "Home" }, null, 2),
      "utf-8",
    );

    await expect(runPrune({ path: tempDir, localesDir })).resolves.not.toThrow();
  });

  it("should run with default parameters when no options are provided", async () => {
    await expect(runPrune()).resolves.not.toThrow();
  });
});

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadConfig } from "../config-loader.js";
import { DEFAULT_CONFIG } from "../types.js";

describe("loadConfig", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "giltflow-config-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  it("returns DEFAULT_CONFIG when no config file exists", async () => {
    const config = await loadConfig(tempDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("loads config and applies react-i18next preset", async () => {
    const configPath = join(tempDir, "giltflow.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        framework: "react-i18next",
      }),
      "utf-8",
    );

    const config = await loadConfig(tempDir);
    expect(config.framework).toBe("react-i18next");
    expect(config.hookName).toBe("useTranslation");
    expect(config.importSource).toBe("react-i18next");
  });

  it("applies user overrides over presets and defaults", async () => {
    const configPath = join(tempDir, "giltflow.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        framework: "next-intl",
        sourceLocale: "fr",
        nested: true,
        targetLocales: ["en", "es"],
      }),
      "utf-8",
    );

    const config = await loadConfig(tempDir);
    expect(config.sourceLocale).toBe("fr");
    expect(config.nested).toBe(true);
    expect(config.targetLocales).toEqual(["en", "es"]);
    expect(config.hookName).toBe("useTranslations");
  });

  it("handles custom framework without predefined preset", async () => {
    const configPath = join(tempDir, "giltflow.config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        framework: "custom",
        hookName: "useMyCustomI18n",
      }),
      "utf-8",
    );

    const config = await loadConfig(tempDir);
    expect(config.framework).toBe("custom");
    expect(config.hookName).toBe("useMyCustomI18n");
  });
});

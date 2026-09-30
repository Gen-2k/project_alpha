import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runExport } from "../export.js";
import { runImport } from "../import.js";

describe("runExport & runImport Commands", () => {
  let tempDir: string;
  let localesDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `giltflow-io-test-${String(Date.now())}`);
    localesDir = join(tempDir, "locales");
    await mkdir(tempDir, { recursive: true });
    await mkdir(localesDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("runExport", () => {
    it("should export source catalog to CSV format", async () => {
      const sourceCatalog = {
        "btn.submit": "Submit Order",
        "btn.cancel": "Cancel",
      };
      await writeFile(join(localesDir, "en.json"), JSON.stringify(sourceCatalog), "utf-8");

      const csvOutput = join(tempDir, "export.csv");
      await runExport({
        localesDir,
        sourceLocale: "en",
        format: "csv",
        output: csvOutput,
      });

      const csvContent = await readFile(csvOutput, "utf-8");
      expect(csvContent).toContain('"Key","Source","Translation"');
      expect(csvContent).toContain("btn.submit,Submit Order,");
    });

    it("should export to XLIFF format with optional target catalog", async () => {
      const sourceCatalog = { "welcome.title": "Welcome" };
      const targetCatalog = { "welcome.title": "Willkommen" };

      await writeFile(join(localesDir, "en.json"), JSON.stringify(sourceCatalog), "utf-8");
      await writeFile(join(localesDir, "de.json"), JSON.stringify(targetCatalog), "utf-8");

      const xlfOutput = join(tempDir, "export.xlf");
      await runExport({
        localesDir,
        sourceLocale: "en",
        targetLocale: "de",
        format: "xliff",
        output: xlfOutput,
      });

      const xlfContent = await readFile(xlfOutput, "utf-8");
      expect(xlfContent).toContain('<xliff version="1.2"');
      expect(xlfContent).toContain("<source>Welcome</source>");
      expect(xlfContent).toContain("<target>Willkommen</target>");
    });

    it("should export to TypeScript dictionary format", async () => {
      const sourceCatalog = { "app.title": "My Application" };
      await writeFile(join(localesDir, "en.json"), JSON.stringify(sourceCatalog), "utf-8");

      const tsOutput = join(tempDir, "messages.ts");
      await runExport({
        localesDir,
        sourceLocale: "en",
        format: "ts",
        output: tsOutput,
      });

      const tsContent = await readFile(tsOutput, "utf-8");
      expect(tsContent).toContain("export default {");
      expect(tsContent).toContain('"app.title": "My Application"');
    });

    it("should handle missing source file without crashing", async () => {
      await expect(
        runExport({
          localesDir: join(tempDir, "missing"),
          sourceLocale: "en",
        }),
      ).resolves.not.toThrow();
    });
  });

  describe("runImport", () => {
    it("should import CSV translations and merge into target locale", async () => {
      const csvData = `key,source,target\nbtn.checkout,Checkout,Pagar\nbtn.back,Back,Volver`;
      const csvPath = join(tempDir, "translations.csv");
      await writeFile(csvPath, csvData, "utf-8");

      await runImport({
        input: csvPath,
        targetLocale: "es",
        localesDir,
      });

      const targetPath = join(localesDir, "es.json");
      const targetContent = await readFile(targetPath, "utf-8");
      const targetJson = JSON.parse(targetContent) as Record<string, string>;

      expect(targetJson["btn.checkout"]).toBe("Pagar");
      expect(targetJson["btn.back"]).toBe("Volver");
    });

    it("should import XLIFF translations into target locale", async () => {
      const xlfData = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
  <file source-language="en" target-language="fr" datatype="plaintext" original="messages">
    <body>
      <trans-unit id="nav.home">
        <source>Home</source>
        <target>Accueil</target>
      </trans-unit>
    </body>
  </file>
</xliff>`;
      const xlfPath = join(tempDir, "translations.xlf");
      await writeFile(xlfPath, xlfData, "utf-8");

      await runImport({
        input: xlfPath,
        targetLocale: "fr",
        localesDir,
      });

      const targetPath = join(localesDir, "fr.json");
      const targetContent = await readFile(targetPath, "utf-8");
      const targetJson = JSON.parse(targetContent) as Record<string, string>;

      expect(targetJson["nav.home"]).toBe("Accueil");
    });

    it("should support nested structure on import", async () => {
      const jsonData = JSON.stringify({ "user.profile.title": "Profil de l'utilisateur" });
      const jsonPath = join(tempDir, "input.json");
      await writeFile(jsonPath, jsonData, "utf-8");

      await runImport({
        input: jsonPath,
        targetLocale: "fr",
        localesDir,
        nested: true,
      });

      const targetPath = join(localesDir, "fr.json");
      const targetContent = await readFile(targetPath, "utf-8");
      const targetJson = JSON.parse(targetContent) as {
        user: { profile: { title: string } };
      };

      expect(targetJson.user.profile.title).toBe("Profil de l'utilisateur");
    });

    it("should export to JSON format", async () => {
      const sourceCatalog = { "app.title": "My Application" };
      await writeFile(join(localesDir, "en.json"), JSON.stringify(sourceCatalog), "utf-8");

      const jsonOutput = join(tempDir, "messages.json");
      await runExport({
        localesDir,
        sourceLocale: "en",
        format: "json",
        output: jsonOutput,
      });

      const jsonContent = await readFile(jsonOutput, "utf-8");
      expect(JSON.parse(jsonContent)).toEqual(sourceCatalog);
    });

    it("should fail gracefully when input file is missing or invalid", async () => {
      await expect(
        runImport({
          input: join(tempDir, "does-not-exist.csv"),
          targetLocale: "es",
          localesDir,
        }),
      ).resolves.not.toThrow();
    });

    it("should early return when required input or targetLocale parameters are missing", async () => {
      await expect(
        runImport({
          input: "",
          targetLocale: "es",
          localesDir,
        }),
      ).resolves.not.toThrow();

      await expect(
        runImport({
          input: "some-file.json",
          targetLocale: "",
          localesDir,
        }),
      ).resolves.not.toThrow();
    });

    it("should handle empty translation entry files gracefully", async () => {
      const emptyFile = join(tempDir, "empty.json");
      await writeFile(emptyFile, "{}", "utf-8");

      await expect(
        runImport({
          input: emptyFile,
          targetLocale: "es",
          localesDir,
        }),
      ).resolves.not.toThrow();
    });

    it("should merge with pre-existing target file on import", async () => {
      const targetPath = join(localesDir, "de.json");
      await writeFile(targetPath, JSON.stringify({ "pre.key": "Vorhanden" }), "utf-8");

      const inputCsv = join(tempDir, "incoming.csv");
      await writeFile(inputCsv, `"Key","Translation"\n"new.key","Neu"\n`, "utf-8");

      await runImport({
        input: inputCsv,
        targetLocale: "de",
        localesDir,
      });

      const updated = JSON.parse(await readFile(targetPath, "utf-8")) as Record<string, string>;
      expect(updated["pre.key"]).toBe("Vorhanden");
      expect(updated["new.key"]).toBe("Neu");
    });

    it("should export to default path and default target name when options omitted", async () => {
      const sourceCatalog = { "test.key": "Value" };
      await writeFile(join(localesDir, "en.json"), JSON.stringify(sourceCatalog), "utf-8");

      await runExport({
        localesDir,
        sourceLocale: "en",
        format: "xliff",
      });

      const defaultXlf = join(localesDir, "export-en.xlf");
      const content = await readFile(defaultXlf, "utf-8");
      expect(content).toContain('target-language="target"');
    });
  });
});

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import pc from "picocolors";

import { mergeCatalog, serializeCatalog } from "../core/catalog/json-catalog.js";
import { csvToCatalog } from "../core/formats/csv-converter.js";
import { xliffToCatalog } from "../core/formats/xliff-converter.js";
import { logger } from "../ui/logger.js";

export interface ImportCommandOptions {
  input: string;
  targetLocale: string;
  localesDir?: string;
  format?: "csv" | "xliff" | "json";
  nested?: boolean;
}

export async function runImport(options: ImportCommandOptions): Promise<void> {
  logger.banner();
  const localesDir = options.localesDir ?? join(process.cwd(), "locales");
  const targetLocale = options.targetLocale;
  const inputPath = options.input;

  if (!inputPath) {
    logger.error("Missing required --input <file> parameter.");
    return;
  }
  if (!targetLocale) {
    logger.error("Missing required --target-locale <locale> parameter.");
    return;
  }

  logger.step(`Reading translation file from ${pc.cyan(inputPath)}...`);

  let rawInput: string;
  try {
    rawInput = await readFile(inputPath, "utf-8");
  } catch (err) {
    logger.error(`Failed to read input file at ${inputPath}: ${String(err)}`);
    return;
  }

  // Detect format
  let format = options.format;
  if (!format) {
    if (inputPath.endsWith(".csv")) {
      format = "csv";
    } else if (inputPath.endsWith(".xlf") || inputPath.endsWith(".xliff")) {
      format = "xliff";
    } else {
      format = "json";
    }
  }

  let importedCatalog: Record<string, string>;
  switch (format) {
    case "csv":
      importedCatalog = csvToCatalog(rawInput);
      break;
    case "xliff":
      importedCatalog = xliffToCatalog(rawInput);
      break;
    case "json":
    default:
      importedCatalog = JSON.parse(rawInput) as Record<string, string>;
      break;
  }

  const importedCount = Object.keys(importedCatalog).length;
  if (importedCount === 0) {
    logger.warn("No translation entries found in the imported file.");
    return;
  }

  const targetCatalogPath = join(localesDir, `${targetLocale}.json`);
  let existingTarget: Record<string, unknown> = {};
  try {
    const rawExisting = await readFile(targetCatalogPath, "utf-8");
    existingTarget = JSON.parse(rawExisting) as Record<string, unknown>;
  } catch {
    existingTarget = {};
  }

  const merged = mergeCatalog(existingTarget, importedCatalog, {
    nested: options.nested,
  });

  await mkdir(dirname(targetCatalogPath), { recursive: true });
  await writeFile(targetCatalogPath, serializeCatalog(merged), "utf-8");

  logger.success(
    `Imported ${String(importedCount)} translations into ${pc.cyan(targetCatalogPath)}`,
  );
  logger.done("Import completed! Target catalog updated successfully.");
}

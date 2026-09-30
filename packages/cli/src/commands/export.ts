import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import pc from "picocolors";

import { serializeCatalog } from "../core/catalog/json-catalog.js";
import { catalogToCsv } from "../core/formats/csv-converter.js";
import { serializeTsDictionary } from "../core/formats/ts-formatter.js";
import { catalogToXliff } from "../core/formats/xliff-converter.js";
import { logger } from "../ui/logger.js";

export interface ExportCommandOptions {
  localesDir?: string;
  sourceLocale?: string;
  targetLocale?: string;
  format?: "csv" | "xliff" | "ts" | "json";
  output?: string;
}

export async function runExport(options: ExportCommandOptions = {}): Promise<void> {
  logger.banner();
  const localesDir = options.localesDir ?? join(process.cwd(), "locales");
  const sourceLocale = options.sourceLocale ?? "en";
  const format = options.format ?? "csv";
  const sourceFilePath = join(localesDir, `${sourceLocale}.json`);

  logger.step(`Loading source catalog from ${pc.cyan(sourceFilePath)}...`);

  let sourceCatalog: Record<string, string>;
  try {
    const raw = await readFile(sourceFilePath, "utf-8");
    sourceCatalog = JSON.parse(raw) as Record<string, string>;
  } catch (err) {
    logger.error(`Failed to load source catalog at ${sourceFilePath}: ${String(err)}`);
    return;
  }

  let targetCatalog: Record<string, string> = {};
  if (options.targetLocale) {
    const targetFilePath = join(localesDir, `${options.targetLocale}.json`);
    try {
      const rawTarget = await readFile(targetFilePath, "utf-8");
      targetCatalog = JSON.parse(rawTarget) as Record<string, string>;
    } catch {
      // optional target catalog
    }
  }

  let outputContent: string;
  let defaultExt: string;

  switch (format) {
    case "csv":
      outputContent = catalogToCsv(sourceCatalog, targetCatalog);
      defaultExt = "csv";
      break;
    case "xliff":
      outputContent = catalogToXliff(
        sourceCatalog,
        targetCatalog,
        sourceLocale,
        options.targetLocale ?? "target",
      );
      defaultExt = "xlf";
      break;
    case "ts":
      outputContent = serializeTsDictionary(sourceCatalog);
      defaultExt = "ts";
      break;
    case "json":
    default:
      outputContent = serializeCatalog(sourceCatalog);
      defaultExt = "json";
      break;
  }

  const outputPath = options.output ?? join(localesDir, `export-${sourceLocale}.${defaultExt}`);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, outputContent, "utf-8");

  logger.success(
    `Exported ${String(Object.keys(sourceCatalog).length)} keys to ${pc.cyan(outputPath)} (${format.toUpperCase()})`,
  );
  logger.done("Export completed! Ready to share with translators.");
}

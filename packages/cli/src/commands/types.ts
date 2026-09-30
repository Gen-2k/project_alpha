import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import pc from "picocolors";

import { generateDts } from "../core/types-gen/dts-generator.js";
import { logger } from "../ui/logger.js";

export interface TypesCommandOptions {
  path?: string;
  dir?: string;
  localesDir?: string;
  sourceLocale?: string;
  output?: string;
}

export async function runTypes(options: TypesCommandOptions = {}): Promise<void> {
  logger.banner();
  const targetDir = options.path ?? options.dir ?? process.cwd();
  const localesDir = options.localesDir ?? join(targetDir, "locales");
  const sourceLocale = options.sourceLocale ?? "en";
  const outputPath = options.output ?? join(targetDir, "giltflow.d.ts");
  const sourcePath = join(localesDir, `${sourceLocale}.json`);

  logger.step(`Generating TypeScript definitions from ${pc.cyan(sourcePath)}...`);

  let catalog: Record<string, unknown>;
  try {
    const raw = await readFile(sourcePath, "utf-8");
    catalog = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    logger.error(`Failed to read source catalog at ${sourcePath}: ${String(err)}`);
    return;
  }

  const dtsContent = generateDts(catalog);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, dtsContent, "utf-8");

  logger.success(`Wrote type definitions to ${pc.cyan(outputPath)}`);
  logger.done("TypeScript types generated! Your IDE will now autocomplete translation keys.");
}

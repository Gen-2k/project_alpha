import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import pc from "picocolors";

import { serializeCatalog } from "../core/catalog/json-catalog.js";
import { pseudoLocalizeCatalog } from "../core/pseudo/pseudo-localizer.js";
import { logger } from "../ui/logger.js";

export interface PseudoCommandOptions {
  path?: string;
  dir?: string;
  localesDir?: string;
  sourceLocale?: string;
}

export async function runPseudo(options: PseudoCommandOptions = {}): Promise<void> {
  logger.banner();
  const targetDir = options.path ?? options.dir ?? process.cwd();
  const localesDir = options.localesDir ?? join(targetDir, "locales");
  const sourceLocale = options.sourceLocale ?? "en";
  const sourcePath = join(localesDir, `${sourceLocale}.json`);
  const pseudoPath = join(localesDir, "pseudo.json");

  logger.step(`Generating pseudo-localization catalog from ${pc.cyan(sourcePath)}...`);

  let sourceCatalog: Record<string, unknown>;
  try {
    const raw = await readFile(sourcePath, "utf-8");
    sourceCatalog = JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    logger.error(`Failed to read source catalog at ${sourcePath}: ${String(err)}`);
    return;
  }

  const pseudoCatalog = pseudoLocalizeCatalog(sourceCatalog);
  const serialized = serializeCatalog(pseudoCatalog);

  await writeFile(pseudoPath, serialized, "utf-8");

  const totalKeys = Object.keys(sourceCatalog).length;
  logger.success(
    `Created pseudo-locale at ${pc.cyan(pseudoPath)} with ${String(totalKeys)} key(s) (+40% text expansion).`,
  );
  logger.done(
    "Pseudo-localization complete! Set your app locale to 'pseudo' to test layout overflows.",
  );
}

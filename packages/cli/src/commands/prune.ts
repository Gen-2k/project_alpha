import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import pc from "picocolors";

import { serializeCatalog } from "../core/catalog/json-catalog.js";
import { findReferencedKeys, identifyObsoleteKeys } from "../core/prune/key-reference-scanner.js";
import { findJsxFiles } from "../core/scanner/file-finder.js";
import { logger } from "../ui/logger.js";

export interface PruneCommandOptions {
  path?: string;
  dir?: string;
  localesDir?: string;
  dryRun?: boolean;
  fix?: boolean;
}

export async function runPrune(options: PruneCommandOptions = {}): Promise<void> {
  logger.banner();
  const targetDir = options.path ?? options.dir ?? process.cwd();
  const localesDir = options.localesDir ?? join(targetDir, "locales");

  logger.step(`Scanning codebase in ${pc.cyan(targetDir)} for active keys...`);
  const files = await findJsxFiles(targetDir);

  const activeKeys = new Set<string>();
  for (const file of files) {
    try {
      const content = await readFile(file, "utf-8");
      const found = findReferencedKeys(content);
      for (const k of found) {
        activeKeys.add(k);
      }
    } catch (err) {
      logger.warn(`Skipped scanning ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  logger.info(`Found ${String(activeKeys.size)} active translation key(s) in code.`);

  let localeFiles: string[];
  try {
    localeFiles = await readdir(localesDir);
  } catch {
    logger.warn(`Locales directory ${localesDir} not found.`);
    return;
  }

  const jsonFiles = localeFiles.filter((f) => f.endsWith(".json"));
  if (jsonFiles.length === 0) {
    logger.info("No translation files found to prune.");
    return;
  }

  let totalObsolete = 0;

  for (const jsonFile of jsonFiles) {
    const fullPath = join(localesDir, jsonFile);
    const raw = await readFile(fullPath, "utf-8");
    const catalog = JSON.parse(raw) as Record<string, unknown>;

    const catalogKeys = Object.keys(catalog);
    const obsolete = identifyObsoleteKeys(catalogKeys, activeKeys);

    if (obsolete.length === 0) {
      logger.success(`${jsonFile}: Clean (no obsolete keys).`);
      continue;
    }

    totalObsolete += obsolete.length;
    logger.warn(`${jsonFile}: Found ${String(obsolete.length)} obsolete key(s):`);
    for (const key of obsolete) {
      logger.info(`  - ${pc.dim(key)}`);
    }

    if (!options.dryRun) {
      const pruned = Object.fromEntries(
        Object.entries(catalog).filter(([k]) => !obsolete.includes(k)),
      );
      await writeFile(fullPath, serializeCatalog(pruned), "utf-8");
      logger.success(`Pruned ${String(obsolete.length)} dead key(s) from ${jsonFile}.`);
    }
  }

  if (options.dryRun && totalObsolete > 0) {
    logger.done(
      `Dry run complete! Found ${String(totalObsolete)} dead key(s). Run without '--dry-run' to delete them.`,
    );
  } else if (totalObsolete === 0) {
    logger.done("All catalogs are clean! Zero dead keys found.");
  } else {
    logger.done(
      `Pruning complete! Removed ${String(totalObsolete)} dead key(s) across all locales.`,
    );
  }
}

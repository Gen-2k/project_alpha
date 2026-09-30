import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import pc from "picocolors";

import {
  mergeCatalog,
  serializeCatalog,
  splitCatalogByNamespace,
} from "../core/catalog/json-catalog.js";
import { loadConfig } from "../core/config/config-loader.js";
import { FRAMEWORK_PRESETS } from "../core/config/types.js";
import { rewriteJsx } from "../core/rewriter/ast-rewriter.js";
import { findJsxFiles } from "../core/scanner/file-finder.js";
import { logger } from "../ui/logger.js";

export interface ExtractCommandOptions {
  path?: string;
  dir?: string;
  localesDir?: string;
  nested?: boolean;
  split?: boolean;
  framework?: "next-intl" | "react-i18next" | "custom";
  dryRun?: boolean;
}

export async function runExtract(options: ExtractCommandOptions = {}): Promise<void> {
  logger.banner();
  const targetDir = options.path ?? options.dir ?? process.cwd();
  const localesDir = options.localesDir ?? join(targetDir, "locales");
  const enCatalogPath = join(localesDir, "en.json");

  const config = await loadConfig(targetDir);

  // Auto-detect if target project is a Vite or non-Next.js React app
  let framework = options.framework ?? config.framework;
  try {
    const rawPkg = await readFile(join(targetDir, "package.json"), "utf-8");
    const pkg = JSON.parse(rawPkg) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (!("next" in deps) && ("react" in deps || "vite" in deps)) {
      framework = "react-i18next";
    }
  } catch {
    // keep configured framework
  }

  logger.step(`Scanning and extracting strings in ${pc.cyan(targetDir)} [${framework}]...`);
  const files = await findJsxFiles(targetDir);

  if (files.length === 0) {
    logger.warn("No .tsx or .jsx files found.");
    logger.done("Extraction finished.");
    return;
  }

  const allExtractedEntries: Record<string, string> = {};
  let modifiedFilesCount = 0;

  const activePreset =
    framework in FRAMEWORK_PRESETS
      ? FRAMEWORK_PRESETS[framework as keyof typeof FRAMEWORK_PRESETS]
      : {};
  const activeHookName = activePreset.hookName ?? config.hookName;
  const activeServerHookName = activePreset.serverHookName ?? config.serverHookName;
  const activeImportSource = activePreset.importSource ?? config.importSource;
  const activeServerImportSource = activePreset.serverImportSource ?? config.serverImportSource;

  for (const file of files) {
    try {
      const originalContent = await readFile(file, "utf-8");
      const result = rewriteJsx(originalContent, {
        framework,
        hookName: activeHookName,
        serverHookName: activeServerHookName,
        importSource: activeImportSource,
        serverImportSource: activeServerImportSource,
        filePath: file,
      });

      const keysCount = Object.keys(result.extractedEntries).length;
      if (keysCount > 0) {
        if (!options.dryRun) {
          await writeFile(file, result.code, "utf-8");
        }
        modifiedFilesCount += 1;
        Object.assign(allExtractedEntries, result.extractedEntries);
        const prefix = options.dryRun ? pc.yellow("[DRY RUN] Would wrap ") : "";
        logger.success(`${prefix}${file} (${String(keysCount)} string(s))`);
      }
    } catch (err) {
      logger.warn(`Skipped ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const totalKeysExtracted = Object.keys(allExtractedEntries).length;
  if (totalKeysExtracted === 0) {
    logger.info("No strings needed extraction.");
    logger.done("Everything is already up to date!");
    return;
  }

  // Handle Multi-file namespace splitting
  if (options.split) {
    const namespaced = splitCatalogByNamespace(allExtractedEntries);
    const splitDir = join(localesDir, config.sourceLocale || "en");
    if (!options.dryRun) {
      await mkdir(splitDir, { recursive: true });
    }

    logger.step(`Writing namespaced catalogs to ${pc.cyan(splitDir)}/...`);
    for (const [ns, entries] of Object.entries(namespaced)) {
      const nsPath = join(splitDir, `${ns}.json`);
      let existingNs: Record<string, unknown> = {};
      try {
        const raw = await readFile(nsPath, "utf-8");
        existingNs = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        existingNs = {};
      }
      const mergedNs = mergeCatalog(existingNs, entries, {
        nested: options.nested,
      });
      if (!options.dryRun) {
        await writeFile(nsPath, serializeCatalog(mergedNs), "utf-8");
      }
      logger.info(`  - ${ns}.json (${String(Object.keys(entries).length)} keys)`);
    }
  }

  // Always keep master en.json updated
  logger.step(`Updating catalog at ${pc.cyan(enCatalogPath)}...`);
  let existingCatalog: Record<string, unknown> = {};

  try {
    const rawCatalog = await readFile(enCatalogPath, "utf-8");
    existingCatalog = JSON.parse(rawCatalog) as Record<string, unknown>;
  } catch {
    existingCatalog = {};
  }

  const merged = mergeCatalog(existingCatalog, allExtractedEntries, {
    nested: options.nested,
  });

  if (!options.dryRun) {
    await mkdir(dirname(enCatalogPath), { recursive: true });
    await writeFile(enCatalogPath, serializeCatalog(merged), "utf-8");
    logger.success(`Updated ${enCatalogPath} with ${String(totalKeysExtracted)} key(s).`);
  } else {
    logger.info(
      pc.yellow(
        `[DRY RUN] Would update ${enCatalogPath} with ${String(totalKeysExtracted)} key(s).`,
      ),
    );
  }

  const doneMsg = options.dryRun
    ? `Dry run complete! Would modify ${String(modifiedFilesCount)} file(s) and extract ${String(totalKeysExtracted)} string(s).`
    : `Extraction complete! Modified ${String(modifiedFilesCount)} file(s) and extracted ${String(totalKeysExtracted)} string(s).`;
  logger.done(doneMsg);
}

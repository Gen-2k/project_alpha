import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import pc from "picocolors";

import { lintCatalog } from "../core/linter/syntax-linter.js";
import { logger } from "../ui/logger.js";

export interface ValidateCommandOptions {
  path?: string;
  dir?: string;
  localesDir?: string;
  sourceLocale?: string;
  ci?: boolean;
}

export async function runValidate(options: ValidateCommandOptions = {}): Promise<boolean> {
  logger.banner();
  const targetDir = options.path ?? options.dir ?? process.cwd();
  const localesDir = options.localesDir ?? join(targetDir, "locales");
  const sourceLocale = options.sourceLocale ?? "en";
  const sourceFilePath = join(localesDir, `${sourceLocale}.json`);

  let files: string[];
  try {
    files = await readdir(localesDir);
  } catch {
    // Fail closed in CI: validating nothing must not read as "all valid".
    // Locally this stays a skip — the developer may not have locales yet.
    logger.warn(`Locales directory ${localesDir} does not exist.`);
    if (options.ci) {
      process.exitCode = 1;
      return false;
    }
    return true;
  }

  logger.step(`Reading source catalog from ${pc.cyan(sourceFilePath)}...`);

  let sourceCatalog: Record<string, string>;
  try {
    const raw = await readFile(sourceFilePath, "utf-8");
    sourceCatalog = JSON.parse(raw) as Record<string, string>;
  } catch (err) {
    logger.error(`Failed to load source catalog at ${sourceFilePath}: ${String(err)}`);
    if (options.ci) {
      process.exitCode = 1;
    }
    return false;
  }

  const targetFiles = files.filter((f) => f.endsWith(".json") && f !== `${sourceLocale}.json`);

  if (targetFiles.length === 0) {
    logger.info("No target translation files found to validate against.");
    logger.done("Validation skipped.");
    return true;
  }

  let hasFailures = false;

  for (const targetFile of targetFiles) {
    const targetFilePath = join(localesDir, targetFile);
    logger.step(`Validating ${pc.cyan(targetFile)}...`);

    try {
      const rawTarget = await readFile(targetFilePath, "utf-8");
      const targetCatalog = JSON.parse(rawTarget) as Record<string, string>;

      const result = lintCatalog(sourceCatalog, targetCatalog);
      if (result.isValid) {
        logger.success(`${targetFile}: 100% valid (0 syntax or placeholder errors)`);
      } else {
        hasFailures = true;
        logger.error(`${targetFile}: Found ${String(result.errors.length)} validation error(s):`);

        for (const err of result.errors) {
          logger.warn(`Key: ${pc.bold(err.key)} [${err.code}]`);
          logger.info(`  Source: ${err.sourceText}`);
          logger.info(`  Target: ${err.targetText}`);
          logger.info(`  Issue:  ${pc.red(err.message)}`);
        }
      }
    } catch (err) {
      hasFailures = true;
      logger.error(`Failed to parse ${targetFile}: ${String(err)}`);
    }
  }

  if (hasFailures) {
    logger.error("Validation failed! Please fix the errors above.");
    if (options.ci) {
      process.exitCode = 1;
    }
    return false;
  }

  logger.done("All translation catalogs passed validation! Ready for production release.");
  return true;
}

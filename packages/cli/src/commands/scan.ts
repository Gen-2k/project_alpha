import { readFile } from "node:fs/promises";

import pc from "picocolors";

import { findJsxFiles } from "../core/scanner/file-finder.js";
import { scanJsx } from "../core/scanner/jsx-scanner.js";
import { logger } from "../ui/logger.js";

export interface ScanCommandOptions {
  path?: string;
  dir?: string;
  ci?: boolean;
}

export async function runScan(options: ScanCommandOptions = {}): Promise<boolean> {
  logger.banner();
  const targetDir = options.path ?? options.dir ?? process.cwd();

  logger.step(`Scanning React components in ${pc.cyan(targetDir)}...`);
  const files = await findJsxFiles(targetDir);

  if (files.length === 0) {
    logger.warn("No .tsx or .jsx files found.");
    logger.done("Scan completed.");
    return true;
  }

  logger.info(`Found ${String(files.length)} candidate component files.`);
  let totalStrings = 0;
  const filesWithStrings: { file: string; count: number }[] = [];

  for (const file of files) {
    try {
      const content = await readFile(file, "utf-8");
      const result = scanJsx(content, file);

      if (result.strings.length > 0) {
        totalStrings += result.strings.length;
        filesWithStrings.push({ file, count: result.strings.length });
      }
    } catch (err) {
      logger.warn(`Skipped ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (filesWithStrings.length === 0) {
    logger.success("All components are internationalized! No raw strings found.");
    logger.done("Scan completed.");
    return true;
  }

  logger.step("Discovered hardcoded translatable strings:");
  for (const item of filesWithStrings) {
    logger.warn(`${item.file}: ${pc.bold(String(item.count))} raw string(s)`);
  }

  logger.done(
    `Scan complete! Found ${String(totalStrings)} hardcoded string(s) across ${String(filesWithStrings.length)} file(s). Run 'giltflow extract' to auto-wrap them.`,
  );

  if (options.ci) {
    logger.error("CI mode enabled: Failing build due to unextracted strings.");
    process.exitCode = 1;
    return false;
  }

  return true;
}

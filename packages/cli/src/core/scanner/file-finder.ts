import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".git",
  "coverage",
  ".output",
  "out",
  ".cache",
  "public",
  "storybook-static",
]);

export interface FileFinderFs {
  readdir?: (path: string) => Promise<string[]>;
  stat?: (path: string) => Promise<{ isFile(): boolean; isDirectory(): boolean }>;
}

/**
 * Recursively discovers all .tsx and .jsx files in a target directory.
 */
export async function findJsxFiles(targetDir: string, customFs?: FileFinderFs): Promise<string[]> {
  const statFn = customFs?.stat ?? stat;
  const readdirFn = customFs?.readdir ?? readdir;

  try {
    const targetStat = await statFn(targetDir);
    if (targetStat.isFile()) {
      const isValidExt =
        targetDir.endsWith(".tsx") ||
        targetDir.endsWith(".jsx") ||
        targetDir.endsWith(".ts") ||
        targetDir.endsWith(".js");
      const isIgnored =
        targetDir.endsWith(".d.ts") ||
        targetDir.endsWith(".spec.ts") ||
        targetDir.endsWith(".spec.tsx") ||
        targetDir.endsWith(".test.ts") ||
        targetDir.endsWith(".test.tsx");
      return isValidExt && !isIgnored ? [targetDir] : [];
    }
  } catch {
    return [];
  }

  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdirFn(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (DEFAULT_IGNORED_DIRS.has(entry)) {
        continue;
      }

      const fullPath = join(dir, entry);
      let fileStat;
      try {
        fileStat = await statFn(fullPath);
      } catch {
        continue;
      }

      if (fileStat.isDirectory()) {
        await walk(fullPath);
      } else {
        const isIgnored =
          entry.endsWith(".spec.ts") ||
          entry.endsWith(".spec.tsx") ||
          entry.endsWith(".spec.js") ||
          entry.endsWith(".spec.jsx") ||
          entry.endsWith(".test.ts") ||
          entry.endsWith(".test.tsx") ||
          entry.endsWith(".test.js") ||
          entry.endsWith(".test.jsx") ||
          entry.endsWith(".d.ts") ||
          entry.endsWith(".d.mts") ||
          entry.endsWith(".d.cts") ||
          entry.includes(".min.") ||
          entry.endsWith(".bundle.js") ||
          entry.endsWith(".config.ts") ||
          entry.endsWith(".config.js") ||
          entry.endsWith(".config.mjs") ||
          entry.endsWith(".config.cjs");

        const isValidExt =
          entry.endsWith(".tsx") ||
          entry.endsWith(".jsx") ||
          entry.endsWith(".ts") ||
          entry.endsWith(".js");

        if (isValidExt && !isIgnored) {
          results.push(fullPath);
        }
      }
    }
  }

  await walk(targetDir);
  return results;
}

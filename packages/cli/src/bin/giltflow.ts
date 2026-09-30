#!/usr/bin/env node
import { Command } from "commander";

import { runExport } from "../commands/export.js";
import { runExtract } from "../commands/extract.js";
import { runImport } from "../commands/import.js";
import { runInit } from "../commands/init.js";
import { runPrune } from "../commands/prune.js";
import { runPseudo } from "../commands/pseudo.js";
import { runScan } from "../commands/scan.js";
import { runTypes } from "../commands/types.js";
import { runValidate } from "../commands/validate.js";
import { CLI_NAME, CLI_VERSION } from "../index.js";

const program = new Command();

program
  .name(CLI_NAME)
  .description("Giltflow CLI — Continuous Code Localization & String Extraction")
  .version(CLI_VERSION);

program
  .command("init [dir]")
  .description("Initialize Giltflow configuration (auto-detecting framework)")
  .option("-d, --dir <dir>", "Project root directory (defaults to current directory)")
  .option("-p, --path <path>", "Project root directory (alias for --dir)")
  .option("--no-scaffold", "Skip scaffolding runtime adapter files")
  .action(
    async (
      dirArg: string | undefined,
      options: { dir?: string; path?: string; scaffold?: boolean },
    ) => {
      await runInit({ dir: dirArg ?? options.dir ?? options.path, scaffold: options.scaffold });
    },
  );

program
  .command("scan [path]")
  .description("Scan React/JSX components for hardcoded translatable strings")
  .option("-p, --path <path>", "Directory to scan (defaults to current directory)")
  .option("-d, --dir <dir>", "Directory to scan (alias for --path)")
  .option("--ci", "Exit with non-zero code if unextracted strings are found")
  .action(
    async (pathArg: string | undefined, options: { path?: string; dir?: string; ci?: boolean }) => {
      const success = await runScan({
        path: pathArg ?? options.path ?? options.dir,
        ci: options.ci,
      });
      if (options.ci && !success) {
        process.exit(1);
      }
    },
  );

program
  .command("extract [path]")
  .description("Extract hardcoded strings, wrap with t(), and update catalogs")
  .option("-p, --path <path>", "Directory to process (defaults to current directory)")
  .option("-d, --dir <dir>", "Directory to process (alias for --path)")
  .option("-l, --locales-dir <dir>", "Path to locales directory (defaults to ./locales)")
  .option("--nested", "Generate nested JSON instead of flat keys")
  .option("--split", "Split catalog by component/feature namespace into separate files")
  .option("-f, --framework <framework>", "Framework preset (next-intl | react-i18next)")
  .option("--dry-run", "Preview changes without modifying files on disk")
  .action(
    async (
      pathArg: string | undefined,
      options: {
        path?: string;
        dir?: string;
        localesDir?: string;
        nested?: boolean;
        split?: boolean;
        framework?: "next-intl" | "react-i18next" | "custom";
        dryRun?: boolean;
      },
    ) => {
      await runExtract({
        ...options,
        path: pathArg ?? options.path ?? options.dir,
      });
    },
  );

program
  .command("pseudo [path]")
  .description("Generate pseudo-localized catalog to test layout expansion and string wrapping")
  .option("-p, --path <path>", "Directory to process (defaults to current directory)")
  .option("-d, --dir <dir>", "Directory to process (alias for --path)")
  .option("-l, --locales-dir <dir>", "Path to locales directory (defaults to ./locales)")
  .option("-s, --source-locale <locale>", "Default source locale (defaults to en)")
  .action(
    async (
      pathArg: string | undefined,
      options: { path?: string; dir?: string; localesDir?: string; sourceLocale?: string },
    ) => {
      await runPseudo({
        ...options,
        path: pathArg ?? options.path ?? options.dir,
      });
    },
  );

program
  .command("prune [path]")
  .description("Detect and prune unused translation keys in catalog")
  .option(
    "-p, --path <path>",
    "Source directory to scan for key usage (defaults to current directory)",
  )
  .option("-d, --dir <dir>", "Source directory to scan for key usage (alias for --path)")
  .option("-l, --locales-dir <dir>", "Path to locales directory (defaults to ./locales)")
  .option("-s, --source-locale <locale>", "Default source locale (defaults to en)")
  .option("--fix", "Remove dead keys from catalog files")
  .option("--dry-run", "Preview unused keys without modifying catalogs")
  .action(
    async (
      pathArg: string | undefined,
      options: {
        path?: string;
        dir?: string;
        localesDir?: string;
        sourceLocale?: string;
        fix?: boolean;
        dryRun?: boolean;
      },
    ) => {
      const isDryRun = options.dryRun ?? (options.fix !== undefined ? !options.fix : false);
      await runPrune({
        ...options,
        path: pathArg ?? options.path ?? options.dir,
        dryRun: isDryRun,
      });
    },
  );

program
  .command("types [path]")
  .description(
    "Generate TypeScript definition file (.d.ts) for autocomplete and compile-time key safety",
  )
  .option("-p, --path <path>", "Directory to process (defaults to current directory)")
  .option("-d, --dir <dir>", "Directory to process (alias for --path)")
  .option("-l, --locales-dir <dir>", "Path to locales directory (defaults to ./locales)")
  .option("-s, --source-locale <locale>", "Default source locale (defaults to en)")
  .option("-o, --output <output>", "Output file path (defaults to ./giltflow.d.ts)")
  .action(
    async (
      pathArg: string | undefined,
      options: {
        path?: string;
        dir?: string;
        localesDir?: string;
        sourceLocale?: string;
        output?: string;
      },
    ) => {
      await runTypes({
        ...options,
        path: pathArg ?? options.path ?? options.dir,
      });
    },
  );

program
  .command("validate [path]")
  .description("Validate placeholder variables and ICU syntax in translation files")
  .option("-p, --path <path>", "Directory to process (defaults to current directory)")
  .option("-d, --dir <dir>", "Directory to process (alias for --path)")
  .option("-l, --locales-dir <dir>", "Path to locales directory (defaults to ./locales)")
  .option("-s, --source-locale <locale>", "Default source locale (defaults to en)")
  .option("--ci", "Exit with non-zero code if validation errors are found")
  .action(
    async (
      pathArg: string | undefined,
      options: {
        path?: string;
        dir?: string;
        localesDir?: string;
        sourceLocale?: string;
        ci?: boolean;
      },
    ) => {
      const success = await runValidate({
        ...options,
        path: pathArg ?? options.path ?? options.dir,
      });
      if (options.ci && !success) {
        process.exit(1);
      }
    },
  );

program
  .command("export")
  .description("Export translations to external formats (CSV, XLIFF, TypeScript, JSON)")
  .option("-l, --locales-dir <dir>", "Path to locales directory (defaults to ./locales)")
  .option("-s, --source-locale <locale>", "Source locale (defaults to en)")
  .option("-t, --target-locale <locale>", "Target locale to export alongside source")
  .option("-f, --format <format>", "Export format: csv | xliff | ts | json (defaults to csv)")
  .option("-o, --output <output>", "Target output file path")
  .action(
    async (options: {
      localesDir?: string;
      sourceLocale?: string;
      targetLocale?: string;
      format?: "csv" | "xliff" | "ts" | "json";
      output?: string;
    }) => {
      await runExport(options);
    },
  );

program
  .command("import")
  .description("Import translations from external formats (CSV, XLIFF, JSON)")
  .requiredOption("-i, --input <input>", "Input file path to import (CSV / XLIFF / JSON)")
  .requiredOption("-t, --target-locale <locale>", "Target locale code (e.g. de, ta, es)")
  .option("-l, --locales-dir <dir>", "Path to locales directory (defaults to ./locales)")
  .option("-f, --format <format>", "Input format (csv | xliff | json)")
  .option("--nested", "Merge into nested JSON format")
  .action(
    async (options: {
      input: string;
      targetLocale: string;
      localesDir?: string;
      format?: "csv" | "xliff" | "json";
      nested?: boolean;
    }) => {
      await runImport(options);
    },
  );

program.parse(process.argv);

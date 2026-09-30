import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import pc from "picocolors";

import { DEFAULT_CONFIG, FRAMEWORK_PRESETS, type GiltflowConfig } from "../core/config/types.js";
import { logger } from "../ui/logger.js";

export type PackageManager = "pnpm" | "yarn" | "bun" | "npm";

export interface InitCommandOptions {
  dir?: string;
  path?: string;
  scaffold?: boolean;
}

export async function detectPackageManager(targetDir: string): Promise<PackageManager> {
  const check = async (dir: string, filename: string) => {
    try {
      await stat(join(dir, filename));
      return true;
    } catch {
      return false;
    }
  };

  let currentDir = targetDir;
  for (let depth = 0; depth < 4; depth++) {
    if (await check(currentDir, "pnpm-lock.yaml")) return "pnpm";
    if (await check(currentDir, "yarn.lock")) return "yarn";
    if ((await check(currentDir, "bun.lockb")) || (await check(currentDir, "bun.lock")))
      return "bun";
    if (await check(currentDir, "package-lock.json")) return "npm";

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return "npm";
}

export function formatInstallCommand(pkgManager: PackageManager, packages: string[]): string {
  const pkgStr = packages.join(" ");
  switch (pkgManager) {
    case "pnpm":
      return `pnpm add ${pkgStr}`;
    case "yarn":
      return `yarn add ${pkgStr}`;
    case "bun":
      return `bun add ${pkgStr}`;
    case "npm":
    default:
      return `npm install ${pkgStr}`;
  }
}

export async function runInit(options: string | InitCommandOptions = process.cwd()): Promise<void> {
  logger.banner();
  const targetDir =
    typeof options === "string" ? options : (options.dir ?? options.path ?? process.cwd());
  const shouldScaffold = typeof options === "string" ? true : options.scaffold !== false;

  const configPath = join(targetDir, "giltflow.config.json");
  const pkgPath = join(targetDir, "package.json");

  logger.step("Detecting project framework and dependencies...");

  let framework: GiltflowConfig["framework"] = "next-intl";
  let isMissingRuntime = false;

  try {
    const rawPkg = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(rawPkg) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if ("react-i18next" in deps) {
      framework = "react-i18next";
      logger.info(`Detected ${pc.cyan("react-i18next")} in package.json.`);
    } else if ("next-intl" in deps) {
      framework = "next-intl";
      logger.info(`Detected ${pc.cyan("next-intl")} in package.json.`);
    } else if ("next" in deps) {
      framework = "next-intl";
      isMissingRuntime = true;
      logger.info(`Detected ${pc.cyan("Next.js")}. Preset set to ${pc.cyan("next-intl")}.`);
    } else if ("react" in deps || "react-dom" in deps) {
      framework = "react-i18next";
      isMissingRuntime = true;
      logger.info(`Detected ${pc.cyan("React")}. Preset set to ${pc.cyan("react-i18next")}.`);
    } else {
      isMissingRuntime = true;
      logger.info("Defaulting to next-intl framework preset.");
    }
  } catch {
    isMissingRuntime = true;
    logger.info("No package.json found; defaulting to next-intl preset.");
  }

  const preset = FRAMEWORK_PRESETS[framework];
  const config: GiltflowConfig = {
    ...DEFAULT_CONFIG,
    ...preset,
    framework,
  };

  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");

  // Create locales directory and empty source catalog if missing
  const localesDir = join(targetDir, config.localesDir);
  await mkdir(localesDir, { recursive: true });

  const sourceFile = join(localesDir, `${config.sourceLocale}.json`);
  try {
    await readFile(sourceFile);
  } catch {
    await writeFile(sourceFile, "{\n}\n", "utf-8");
  }

  logger.success(`Created configuration file at ${pc.cyan(configPath)}`);
  logger.success(`Created locales catalog directory at ${pc.cyan(localesDir)}`);

  // Detect if project has a src/ directory
  let hasSrc = false;
  try {
    const srcStat = await stat(join(targetDir, "src"));
    hasSrc = srcStat.isDirectory();
  } catch {
    hasSrc = false;
  }

  // Scaffold starter runtime adapter if requested
  if (shouldScaffold) {
    if (framework === "next-intl") {
      const adapterRel = hasSrc ? "src/i18n/request.ts" : "i18n/request.ts";
      const adapterPath = join(targetDir, adapterRel);
      try {
        await readFile(adapterPath);
      } catch {
        await mkdir(dirname(adapterPath), { recursive: true });
        const importRelative = hasSrc ? "../../locales" : "../locales";
        const content = `import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  const locale = "en";
  return {
    locale,
    messages: (await import("${importRelative}/\${locale}.json")).default,
  };
});
`;
        await writeFile(adapterPath, content, "utf-8");
        logger.success(`Scaffolded Next.js runtime adapter at ${pc.cyan(adapterRel)}`);
      }
    } else {
      const adapterRel = hasSrc ? "src/i18n.ts" : "i18n.ts";
      const adapterPath = join(targetDir, adapterRel);
      try {
        await readFile(adapterPath);
      } catch {
        await mkdir(dirname(adapterPath), { recursive: true });
        const importRelative = hasSrc ? "../locales" : "./locales";
        const content = `import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "${importRelative}/en.json";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
`;
        await writeFile(adapterPath, content, "utf-8");
        logger.success(`Scaffolded React runtime adapter at ${pc.cyan(adapterRel)}`);
      }
    }
  }

  const pkgManager = await detectPackageManager(targetDir);

  if (isMissingRuntime) {
    const requiredPackages =
      framework === "next-intl" ? ["next-intl"] : ["react-i18next", "i18next"];
    const installCmd = formatInstallCommand(pkgManager, requiredPackages);
    logger.warn(`No i18n runtime library detected. Install it with:`);
    logger.info(`  ${pc.green(installCmd)}`);
  }

  logger.done("Initialization complete! Ready for extraction.");
  logger.info(pc.dim("Next steps:"));
  logger.info(pc.dim("  1. Run 'giltflow extract' to wrap raw strings and generate catalogs."));
  logger.info(pc.dim("  2. Run 'giltflow types' to enable TypeScript autocomplete."));
  logger.info(pc.dim("  3. Run 'giltflow validate' in CI/CD to verify placeholder variables."));
}

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GiltflowConfig } from "../../core/config/types.js";
import { detectPackageManager, formatInstallCommand, runInit } from "../init.js";

describe("runInit Command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `giltflow-init-test-${String(Date.now())}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should detect next-intl in package.json and write config", async () => {
    const pkg = {
      name: "my-app",
      dependencies: {
        "next-intl": "^3.0.0",
      },
    };
    await writeFile(join(tempDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");

    await runInit(tempDir);

    const configContent = await readFile(join(tempDir, "giltflow.config.json"), "utf-8");
    const config = JSON.parse(configContent) as GiltflowConfig;

    expect(config.framework).toBe("next-intl");
    expect(config.hookName).toBe("useTranslations");
    expect(config.importSource).toBe("next-intl");
  });

  it("should detect react-i18next in package.json and write config", async () => {
    const pkg = {
      name: "my-app",
      devDependencies: {
        "react-i18next": "^13.0.0",
      },
    };
    await writeFile(join(tempDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");

    await runInit(tempDir);

    const configContent = await readFile(join(tempDir, "giltflow.config.json"), "utf-8");
    const config = JSON.parse(configContent) as GiltflowConfig;

    expect(config.framework).toBe("react-i18next");
    expect(config.hookName).toBe("useTranslation");
    expect(config.importSource).toBe("react-i18next");
  });

  it("should default to next-intl when no package.json exists", async () => {
    await runInit(tempDir);

    const configContent = await readFile(join(tempDir, "giltflow.config.json"), "utf-8");
    const config = JSON.parse(configContent) as GiltflowConfig;

    expect(config.framework).toBe("next-intl");
  });

  it("should detect next in package.json and configure next-intl preset with catalog directory", async () => {
    const pkg = {
      name: "next-app",
      dependencies: { next: "^14.0.0" },
    };
    await writeFile(join(tempDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");

    await runInit(tempDir);

    const configContent = await readFile(join(tempDir, "giltflow.config.json"), "utf-8");
    const config = JSON.parse(configContent) as GiltflowConfig;

    expect(config.framework).toBe("next-intl");
    const enContent = await readFile(join(tempDir, "locales", "en.json"), "utf-8");
    expect(enContent).toBe("{\n}\n");
  });

  it("should detect react in package.json and configure react-i18next preset", async () => {
    const pkg = {
      name: "vite-react-app",
      dependencies: { react: "^18.0.0" },
    };
    await writeFile(join(tempDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");

    await runInit(tempDir);

    const configContent = await readFile(join(tempDir, "giltflow.config.json"), "utf-8");
    const config = JSON.parse(configContent) as GiltflowConfig;

    expect(config.framework).toBe("react-i18next");
  });

  it("should preserve existing en.json if already present", async () => {
    const locales = join(tempDir, "locales");
    await mkdir(locales, { recursive: true });
    await writeFile(join(locales, "en.json"), '{"existing.key":"Existing"}\n', "utf-8");

    await runInit(tempDir);

    const enContent = await readFile(join(locales, "en.json"), "utf-8");
    expect(enContent).toContain("existing.key");
  });

  it("should default to next-intl when package.json contains neither React nor Next.js", async () => {
    const pkg = {
      name: "node-cli-app",
      dependencies: { lodash: "^4.0.0" },
    };
    await writeFile(join(tempDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");

    await runInit(tempDir);

    const configContent = await readFile(join(tempDir, "giltflow.config.json"), "utf-8");
    const config = JSON.parse(configContent) as GiltflowConfig;

    expect(config.framework).toBe("next-intl");
  });

  it("should scaffold runtime adapter into src/ when src/ directory exists", async () => {
    await mkdir(join(tempDir, "src"), { recursive: true });
    const pkg = {
      name: "next-src-app",
      dependencies: { next: "^14.0.0" },
    };
    await writeFile(join(tempDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");

    await runInit(tempDir);

    const adapterContent = await readFile(join(tempDir, "src", "i18n", "request.ts"), "utf-8");
    expect(adapterContent).toContain('import { getRequestConfig } from "next-intl/server";');
    expect(adapterContent).toContain("../../locales");
  });

  it("should scaffold react-i18next adapter into src/ when src/ directory exists", async () => {
    await mkdir(join(tempDir, "src"), { recursive: true });
    const pkg = {
      name: "react-src-app",
      dependencies: { react: "^18.0.0" },
    };
    await writeFile(join(tempDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");

    await runInit(tempDir);

    const adapterContent = await readFile(join(tempDir, "src", "i18n.ts"), "utf-8");
    expect(adapterContent).toContain('import i18n from "i18next";');
    expect(adapterContent).toContain("../locales/en.json");
  });

  it("should skip scaffolding runtime adapter when scaffold is false", async () => {
    const pkg = {
      name: "no-scaffold-app",
      dependencies: { next: "^14.0.0" },
    };
    await writeFile(join(tempDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");

    await runInit({ dir: tempDir, scaffold: false });

    let exists = false;
    try {
      await readFile(join(tempDir, "i18n", "request.ts"));
      exists = true;
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });

  it("should accept path option as an alias for dir", async () => {
    const pkg = {
      name: "alias-app",
      dependencies: { react: "^18.0.0" },
    };
    await writeFile(join(tempDir, "package.json"), JSON.stringify(pkg, null, 2), "utf-8");

    await runInit({ path: tempDir });

    const config = await readFile(join(tempDir, "giltflow.config.json"), "utf-8");
    expect(config).toContain('"framework": "react-i18next"');
  });

  describe("detectPackageManager & formatInstallCommand", () => {
    it("should detect pnpm when pnpm-lock.yaml exists", async () => {
      await writeFile(join(tempDir, "pnpm-lock.yaml"), "lockfileVersion: 5.4");
      const pm = await detectPackageManager(tempDir);
      expect(pm).toBe("pnpm");
      expect(formatInstallCommand(pm, ["next-intl"])).toBe("pnpm add next-intl");
    });

    it("should detect yarn when yarn.lock exists", async () => {
      await writeFile(join(tempDir, "yarn.lock"), "# yarn lock");
      const pm = await detectPackageManager(tempDir);
      expect(pm).toBe("yarn");
      expect(formatInstallCommand(pm, ["next-intl"])).toBe("yarn add next-intl");
    });

    it("should detect bun when bun.lockb exists", async () => {
      await writeFile(join(tempDir, "bun.lockb"), "bun lock");
      const pm = await detectPackageManager(tempDir);
      expect(pm).toBe("bun");
      expect(formatInstallCommand(pm, ["next-intl"])).toBe("bun add next-intl");
    });

    it("should detect npm when package-lock.json exists and format install command", async () => {
      await writeFile(join(tempDir, "package-lock.json"), "{}");
      const pm = await detectPackageManager(tempDir);
      expect(pm).toBe("npm");
      expect(formatInstallCommand(pm, ["next-intl"])).toBe("npm install next-intl");
    });

    it("should detect pnpm when lockfile is in parent directory (monorepo setup)", async () => {
      const childDir = join(tempDir, "packages", "sub-app");
      await mkdir(childDir, { recursive: true });
      await writeFile(join(tempDir, "pnpm-lock.yaml"), "lockfileVersion: 5.4");

      const pm = await detectPackageManager(childDir);
      expect(pm).toBe("pnpm");
    });
  });
});

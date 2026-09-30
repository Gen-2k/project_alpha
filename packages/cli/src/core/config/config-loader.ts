import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { DEFAULT_CONFIG, FRAMEWORK_PRESETS, type GiltflowConfig } from "./types.js";

const CONFIG_FILENAME = "giltflow.config.json";

/**
 * Loads project configuration from giltflow.config.json, falling back to defaults and framework presets.
 */
export async function loadConfig(rootDir: string = process.cwd()): Promise<GiltflowConfig> {
  const configPath = join(rootDir, CONFIG_FILENAME);
  let userConfig: Partial<GiltflowConfig> = {};

  try {
    const raw = await readFile(configPath, "utf-8");
    userConfig = JSON.parse(raw) as Partial<GiltflowConfig>;
  } catch {
    // If no config file exists, return defaults
    return DEFAULT_CONFIG;
  }

  const framework = userConfig.framework ?? DEFAULT_CONFIG.framework;
  const preset =
    framework in FRAMEWORK_PRESETS
      ? FRAMEWORK_PRESETS[framework as keyof typeof FRAMEWORK_PRESETS]
      : {};

  return {
    ...DEFAULT_CONFIG,
    ...preset,
    ...userConfig,
  };
}

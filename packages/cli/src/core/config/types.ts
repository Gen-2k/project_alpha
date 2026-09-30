export type SupportedFramework = "next-intl" | "react-i18next" | "custom";

export interface GiltflowConfig {
  framework: SupportedFramework;
  hookName: string;
  serverHookName?: string;
  importSource: string;
  serverImportSource?: string;
  sourceLocale: string;
  targetLocales: string[];
  localesDir: string;
  nested: boolean;
  include: string[];
  exclude: string[];
}

export const FRAMEWORK_PRESETS: Record<"next-intl" | "react-i18next", Partial<GiltflowConfig>> = {
  "next-intl": {
    framework: "next-intl",
    hookName: "useTranslations",
    serverHookName: "getTranslations",
    importSource: "next-intl",
    serverImportSource: "next-intl/server",
    nested: false,
  },
  "react-i18next": {
    framework: "react-i18next",
    hookName: "useTranslation",
    importSource: "react-i18next",
    nested: false,
  },
};

export const DEFAULT_CONFIG: GiltflowConfig = {
  framework: "next-intl",
  hookName: "useTranslations",
  serverHookName: "getTranslations",
  importSource: "next-intl",
  serverImportSource: "next-intl/server",
  sourceLocale: "en",
  targetLocales: ["de", "es", "ja"],
  localesDir: "./locales",
  nested: false,
  include: ["src/**/*.{tsx,jsx}", "app/**/*.{tsx,jsx}"],
  exclude: ["**/*.spec.tsx", "**/*.test.tsx", "**/node_modules/**"],
};

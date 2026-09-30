export interface CatalogOptions {
  nested?: boolean;
}

/**
 * Recursively sorts the keys of an object alphabetically for deterministic Git diffs.
 */
export function sortObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();

  for (const key of keys) {
    const val = obj[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      sorted[key] = sortObjectKeys(val as Record<string, unknown>);
    } else {
      sorted[key] = val;
    }
  }

  return sorted;
}

/**
 * Converts dot-delimited flat keys ("header.welcome") into a nested object hierarchy ({ header: { welcome: "" } }).
 */
export function unflattenObject(flat: Record<string, string>): Record<string, unknown> {
  const root: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part) {
        if (!(part in current) || typeof current[part] !== "object") {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      current[lastPart] = value;
    }
  }

  return root;
}

/**
 * Non-destructively merges newly extracted translation entries into an existing catalog.
 * Existing translations are NEVER overwritten.
 */
export function mergeCatalog(
  existingCatalog: Record<string, unknown>,
  newEntries: Record<string, string>,
  options: CatalogOptions = {},
): Record<string, unknown> {
  const targetEntries = options.nested ? unflattenObject(newEntries) : newEntries;

  function deepMerge(
    base: Record<string, unknown>,
    incoming: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...base };

    for (const [key, incomingVal] of Object.entries(incoming)) {
      if (!(key in result)) {
        result[key] = incomingVal;
      } else if (
        typeof result[key] === "object" &&
        result[key] !== null &&
        typeof incomingVal === "object" &&
        incomingVal !== null
      ) {
        result[key] = deepMerge(
          result[key] as Record<string, unknown>,
          incomingVal as Record<string, unknown>,
        );
      }
      // If key already exists as a string value, leave existing untouched
    }

    return result;
  }

  return deepMerge(existingCatalog, targetEntries);
}

/**
 * Serializes a translation catalog into formatted JSON with sorted keys.
 */
export function serializeCatalog(catalog: Record<string, unknown>): string {
  const sorted = sortObjectKeys(catalog);
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

/**
 * Recursively flattens nested catalog object keys into dot-separated paths.
 */
export function flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const flattened: Record<string, string> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(flattened, flattenObject(value as Record<string, unknown>, fullPath));
    } else {
      flattened[fullPath] = String(value);
    }
  }

  return flattened;
}

/**
 * Splits a flat catalog by top-level namespace prefix (e.g. `settings_view.title` -> namespace `settings_view`).
 */
export function splitCatalogByNamespace(
  catalog: Record<string, string>,
  options: { stripNamespacePrefix?: boolean } = {},
): Record<string, Record<string, string>> {
  const namespaces: Record<string, Record<string, string>> = {};

  for (const [fullKey, value] of Object.entries(catalog)) {
    const dotIdx = fullKey.indexOf(".");
    const ns = dotIdx !== -1 ? fullKey.slice(0, dotIdx) : "common";
    const subKey =
      options.stripNamespacePrefix && dotIdx !== -1 ? fullKey.slice(dotIdx + 1) : fullKey;

    namespaces[ns] ??= {};
    namespaces[ns][subKey] = value;
  }

  return namespaces;
}

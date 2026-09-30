/**
 * Generates a clean, human-readable i18n key from source text and optional component context.
 * E.g., "Welcome to Dashboard" in Header -> "header.welcome_to_dashboard"
 */
export function generateKey(
  text: string,
  componentName?: string,
  existingKeys = new Set<string>(),
): string {
  let baseKey: string;

  const pluralMatch = /^\{([a-zA-Z0-9_$]+),\s*plural,/i.exec(text);
  if (pluralMatch?.[1]) {
    const rawVar = pluralMatch[1];
    const snakeVar = rawVar.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
    baseKey = snakeVar === "count" ? "count_plural" : `${snakeVar}_count`;
  } else {
    // Strip ICU tokens like {name} or {count} before generating slug
    const clean = text.replace(/\{[a-zA-Z0-9_$]+\}/g, "").trim();

    const words = clean
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .slice(0, 5);

    baseKey = words.join("_");
    if (!baseKey) {
      baseKey = "text";
    }
  }

  if (componentName) {
    const compPrefix = componentName.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
    baseKey = `${compPrefix}.${baseKey}`;
  }

  let uniqueKey = baseKey;
  let counter = 1;
  while (existingKeys.has(uniqueKey)) {
    uniqueKey = `${baseKey}_${String(counter)}`;
    counter += 1;
  }

  existingKeys.add(uniqueKey);
  return uniqueKey;
}

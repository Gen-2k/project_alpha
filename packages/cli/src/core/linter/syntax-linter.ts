import { parse as parseIcu } from "@formatjs/icu-messageformat-parser";

export type LintErrorCode =
  "MISSING_VARIABLE" | "EXTRA_VARIABLE" | "UNMATCHED_TAGS" | "INVALID_ICU";

export interface LintError {
  key: string;
  sourceText: string;
  targetText: string;
  code: LintErrorCode;
  message: string;
}

export interface LintResult {
  isValid: boolean;
  errors: LintError[];
}

/**
 * Extracts all {variable} tokens from a string, ignoring ICU syntax keywords.
 */
export function extractPlaceholders(text: string): Set<string> {
  const matches = text.match(/\{([a-zA-Z0-9_$]+)[^}]*\}/g);
  const placeholders = new Set<string>();

  if (!matches) {
    return placeholders;
  }

  for (const match of matches) {
    // Extract base token before comma or space (e.g. {count, plural, ...} -> count)
    const tokenMatch = /^\{([a-zA-Z0-9_$]+)/.exec(match);
    if (tokenMatch?.[1]) {
      placeholders.add(tokenMatch[1]);
    }
  }

  return placeholders;
}

/**
 * Extracts and balances HTML-like tags (<bdi>, <b>, </b>, etc.).
 */
export function validateTagBalance(text: string): boolean {
  const tagMatches = [...text.matchAll(/<(\/?)([a-zA-Z0-9-]+)[^>]*(\/?)>/g)];
  if (tagMatches.length === 0) {
    return true;
  }

  const stack: string[] = [];
  for (const match of tagMatches) {
    const isSelfClosing = match[3] === "/" || match[0].endsWith("/>");
    if (isSelfClosing) {
      continue;
    }

    const isClosing = match[1] === "/";
    const tagName = (match[2] ?? "").toLowerCase();

    if (isClosing) {
      if (stack.length === 0 || stack[stack.length - 1] !== tagName) {
        return false;
      }
      stack.pop();
    } else {
      stack.push(tagName);
    }
  }

  return stack.length === 0;
}

/**
 * Validates a single translation pair (source text vs target translated text).
 */
export function lintTranslation(key: string, sourceText: string, targetText: string): LintError[] {
  const errors: LintError[] = [];

  // 1. Placeholder verification
  const sourceTokens = extractPlaceholders(sourceText);
  const targetTokens = extractPlaceholders(targetText);

  for (const srcToken of sourceTokens) {
    if (!targetTokens.has(srcToken)) {
      errors.push({
        key,
        sourceText,
        targetText,
        code: "MISSING_VARIABLE",
        message: `Missing placeholder token '{${srcToken}}' in translation.`,
      });
    }
  }

  for (const tgtToken of targetTokens) {
    if (!sourceTokens.has(tgtToken)) {
      errors.push({
        key,
        sourceText,
        targetText,
        code: "EXTRA_VARIABLE",
        message: `Unexpected placeholder token '{${tgtToken}}' in translation that does not exist in source.`,
      });
    }
  }

  // 2. Tag balance verification
  if (!validateTagBalance(targetText)) {
    errors.push({
      key,
      sourceText,
      targetText,
      code: "UNMATCHED_TAGS",
      message: "Mismatched or unclosed HTML/JSX tag pairs in translation.",
    });
  }

  // 3. ICU syntax parsing
  try {
    parseIcu(targetText);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Malformed ICU MessageFormat syntax";
    errors.push({
      key,
      sourceText,
      targetText,
      code: "INVALID_ICU",
      message: `Invalid ICU syntax: ${errorMsg}`,
    });
  }

  return errors;
}

/**
 * Validates an entire target catalog against the source catalog.
 */
export function lintCatalog(
  sourceCatalog: Record<string, string>,
  targetCatalog: Record<string, string>,
): LintResult {
  const allErrors: LintError[] = [];

  for (const [key, sourceText] of Object.entries(sourceCatalog)) {
    const targetText = targetCatalog[key];
    if (!targetText) {
      continue;
    }

    const errors = lintTranslation(key, sourceText, targetText);
    allErrors.push(...errors);
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

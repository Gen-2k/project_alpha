export const IGNORED_JSX_ELEMENTS = new Set([
  "code",
  "pre",
  "script",
  "style",
  "svg",
  "path",
  "circle",
  "rect",
  "line",
  "noscript",
  "kbd",
]);

export const TRANSLATABLE_ATTRIBUTES = new Set([
  "placeholder",
  "title",
  "aria-label",
  "aria-placeholder",
  "aria-roledescription",
  "alt",
  "label",
]);

const URL_REGEX = /^(?:https?:\/\/|\/|#|mailto:|tel:)/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEMVER_REGEX = /^v?\d+(?:\.\d+)+(?:-[a-z0-9.]+)?$/i;
const FILE_PATH_OR_EXT_REGEX = /\.(?:png|jpe?g|gif|svg|webp|ico|css|js|ts|json)$/i;
const HEX_COLOR_REGEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const ONLY_PUNCTUATION_OR_NUMBERS_REGEX = /^[\d\s.,/#!$%^&*;:{}=\-_`~()|<>+[\]\\?@'"]+$/;

/**
 * Determines whether a given text string represents translatable natural language.
 */
export function isTranslatableText(text: string): boolean {
  const trimmed = text.trim();

  if (!trimmed || trimmed.length < 2) {
    return false;
  }

  if (ONLY_PUNCTUATION_OR_NUMBERS_REGEX.test(trimmed)) {
    return false;
  }

  if (HEX_COLOR_REGEX.test(trimmed)) {
    return false;
  }

  if (URL_REGEX.test(trimmed) || EMAIL_REGEX.test(trimmed) || SEMVER_REGEX.test(trimmed)) {
    return false;
  }

  if (FILE_PATH_OR_EXT_REGEX.test(trimmed)) {
    return false;
  }

  // Must contain at least one letter character
  return /\p{L}/u.test(trimmed);
}

const ACCENT_MAP: Record<string, string> = {
  a: "à",
  b: "ƀ",
  c: "č",
  d: "đ",
  e: "é",
  f: "ƒ",
  g: "ĝ",
  h: "ĥ",
  i: "î",
  j: "ĵ",
  k: "ķ",
  l: "ĺ",
  m: "ɱ",
  n: "ñ",
  o: "ő",
  p: "þ",
  q: "q",
  r: "ř",
  s: "š",
  t: "ť",
  u: "û",
  v: "ṽ",
  w: "ŵ",
  x: "ẋ",
  y: "ý",
  z: "ž",
  A: "À",
  B: "Ɓ",
  C: "Č",
  D: "Đ",
  E: "É",
  F: "Ƒ",
  G: "Ĝ",
  H: "Ĥ",
  I: "Î",
  J: "Ĵ",
  K: "Ķ",
  L: "Ĺ",
  M: "M",
  N: "Ñ",
  O: "Ő",
  P: "Þ",
  Q: "Q",
  R: "Ř",
  S: "Š",
  T: "Ť",
  U: "Û",
  V: "Ṽ",
  W: "Ŵ",
  X: "Ẋ",
  Y: "Ý",
  Z: "Ž",
};

/**
 * Transforms plain text with accented lookalikes while preserving tokens and tags.
 */
function transformTextPart(text: string): string {
  return text
    .split("")
    .map((char) => ACCENT_MAP[char] ?? char)
    .join("");
}

/**
 * Generates a pseudo-localized string with 40% length expansion and bracket wrappers.
 * Safely preserves {variable} placeholders and HTML/JSX tags.
 */
export function pseudoLocalize(text: string): string {
  // Tokenize string to protect {placeholders} and <tags>
  const tokens: { type: "text" | "protected"; content: string }[] = [];
  const regex = /(\{[^{}]+\}|<[^<>]+>)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        content: text.slice(lastIndex, match.index),
      });
    }

    tokens.push({
      type: "protected",
      content: match[0],
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  // Transform only the translatable text segments
  const transformed = tokens
    .map((t) => (t.type === "text" ? transformTextPart(t.content) : t.content))
    .join("");

  // Calculate 40% expansion padding
  const expansionLength = Math.max(3, Math.round(text.length * 0.4));
  const padding = " " + "~".repeat(expansionLength);

  return `[!! ${transformed}${padding} !!]`;
}

/**
 * Transforms an entire translation catalog into a pseudo-localized test catalog.
 */
export function pseudoLocalizeCatalog(catalog: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(catalog)) {
    if (typeof val === "string") {
      result[key] = pseudoLocalize(val);
    } else if (typeof val === "object" && val !== null) {
      result[key] = pseudoLocalizeCatalog(val as Record<string, unknown>);
    }
  }

  return result;
}

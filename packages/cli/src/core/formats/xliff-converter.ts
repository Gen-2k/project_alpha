/**
 * Escapes special XML characters for safe inclusion in XLIFF.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Unescapes special XML entities back to plain text.
 */
function unescapeXml(str: string): string {
  return str
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

/**
 * Converts translation catalogs into standard XLIFF 1.2 XML format.
 */
export function catalogToXliff(
  sourceCatalog: Record<string, string>,
  targetCatalog: Record<string, string> = {},
  sourceLang = "en",
  targetLang = "target",
): string {
  const sortedKeys = Object.keys(sourceCatalog).sort();
  const transUnits = sortedKeys
    .map((key) => {
      const source = escapeXml(sourceCatalog[key] ?? "");
      const target = escapeXml(targetCatalog[key] ?? "");
      return `      <trans-unit id="${escapeXml(key)}">
        <source>${source}</source>
        <target>${target}</target>
      </trans-unit>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="${sourceLang}" target-language="${targetLang}" datatype="plaintext" original="giltflow">
    <body>
${transUnits}
    </body>
  </file>
</xliff>
`;
}

/**
 * Parses an XLIFF 1.2 XML document into a translation catalog (key -> target or source).
 */
export function xliffToCatalog(xliffContent: string): Record<string, string> {
  const catalog: Record<string, string> = {};

  const unitRegex = /<trans-unit\s+id="([^"]*)"[\s\S]*?<\/trans-unit>/g;
  let match: RegExpExecArray | null;

  while ((match = unitRegex.exec(xliffContent)) !== null) {
    const rawUnit = match[0];
    const key = unescapeXml(match[1] ?? "");
    if (!key) {
      continue;
    }

    const targetMatch = /<target[^>]*>([\s\S]*?)<\/target>/i.exec(rawUnit);
    const sourceMatch = /<source[^>]*>([\s\S]*?)<\/source>/i.exec(rawUnit);
    const targetVal = targetMatch?.[1]?.trim();
    const sourceVal = sourceMatch?.[1]?.trim() ?? "";
    const val = targetVal && targetVal.length > 0 ? (targetMatch?.[1] ?? "") : sourceVal;

    catalog[key] = unescapeXml(val);
  }

  return catalog;
}

/**
 * Escapes a field according to RFC 4180 CSV specifications.
 */
function escapeCsv(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Converts a translation catalog (and optional target translations) into CSV format.
 */
export function catalogToCsv(
  sourceCatalog: Record<string, string>,
  targetCatalog: Record<string, string> = {},
): string {
  const rows: string[] = ['"Key","Source","Translation"'];

  const sortedKeys = Object.keys(sourceCatalog).sort();
  for (const key of sortedKeys) {
    const sourceVal = sourceCatalog[key] ?? "";
    const targetVal = targetCatalog[key] ?? "";
    rows.push(`${escapeCsv(key)},${escapeCsv(sourceVal)},${escapeCsv(targetVal)}`);
  }

  return `${rows.join("\n")}\n`;
}

/**
 * Parses an RFC 4180 CSV string into an array of row tokens.
 */
function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i] ?? "";
    const nextChar = csv[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      currentRow.push(currentField);
      currentField = "";
    } else if (char === "\r") {
      if (nextChar === "\n") {
        i++;
      }
      currentRow.push(currentField);
      currentField = "";
      if (currentRow.length > 0 && currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else if (char === "\n") {
      currentRow.push(currentField);
      currentField = "";
      if (currentRow.length > 0 && currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses a CSV file into a translation catalog (key -> translation, or source fallback).
 */
export function csvToCatalog(csvContent: string): Record<string, string> {
  const rows = parseCsvRows(csvContent);
  const catalog: Record<string, string> = {};

  if (rows.length === 0) {
    return catalog;
  }

  // Find column indices from header
  const header = rows[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const keyIdx = header.indexOf("key");
  const targetColIdx = header.indexOf("translation");
  const targetIdx = targetColIdx !== -1 ? targetColIdx : header.indexOf("target");
  const sourceIdx = header.indexOf("source");

  const startRow = keyIdx !== -1 ? 1 : 0;
  const actualKeyIdx = keyIdx !== -1 ? keyIdx : 0;
  const actualValIdx = targetIdx !== -1 ? targetIdx : sourceIdx !== -1 ? sourceIdx : 1;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length <= actualKeyIdx) {
      continue;
    }

    const key = row[actualKeyIdx]?.trim();
    if (!key) {
      continue;
    }

    const targetVal = row[actualValIdx]?.trim();
    const sourceVal = sourceIdx !== -1 ? row[sourceIdx]?.trim() : "";

    // Use translation if present, otherwise fallback to source
    catalog[key] = (targetVal && targetVal.length > 0 ? targetVal : sourceVal) ?? "";
  }

  return catalog;
}

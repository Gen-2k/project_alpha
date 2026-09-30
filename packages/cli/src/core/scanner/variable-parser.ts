import * as t from "@babel/types";

export interface ExtractedVariable {
  token: string;
  rawExpression: string;
}

export interface ParsedTemplateResult {
  text: string;
  variables: ExtractedVariable[];
}

/**
 * Derives a clean, readable token name for use in ICU placeholders.
 * E.g., `user.profile.name` -> `name`, `items.length` -> `count`
 */
export function sanitizeTokenName(rawExpression: string, existingTokens: Set<string>): string {
  let baseName = "value";

  if (rawExpression.includes(".")) {
    const parts = rawExpression.split(".");
    const lastPart = parts[parts.length - 1]?.trim();
    if (lastPart === "length") {
      baseName = "count";
    } else if (lastPart && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(lastPart)) {
      baseName = lastPart;
    }
  } else if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(rawExpression)) {
    baseName = rawExpression;
  }

  // Ensure unique token name in case of duplicates
  let uniqueToken = baseName;
  let counter = 1;
  while (existingTokens.has(uniqueToken)) {
    uniqueToken = `${baseName}${String(counter)}`;
    counter += 1;
  }

  existingTokens.add(uniqueToken);
  return uniqueToken;
}

/**
 * Converts a Babel AST node representing an expression into its raw string form.
 */
function nodeToExpressionString(node: t.Node): string {
  if (t.isIdentifier(node)) {
    return node.name;
  }
  if (t.isMemberExpression(node)) {
    const objectStr = nodeToExpressionString(node.object);
    const propStr = t.isIdentifier(node.property)
      ? node.property.name
      : t.isStringLiteral(node.property)
        ? node.property.value
        : "prop";
    return `${objectStr}.${propStr}`;
  }
  if (t.isNumericLiteral(node)) {
    return String(node.value);
  }
  if (t.isStringLiteral(node)) {
    return node.value;
  }
  return "param";
}

/**
 * Parses a TemplateLiteral node (`Hello ${user.name}!`) into an ICU-compatible string and variable mapping.
 */
export function parseTemplateLiteral(node: t.TemplateLiteral): ParsedTemplateResult | null {
  const variables: ExtractedVariable[] = [];
  const existingTokens = new Set<string>();
  let combinedText = "";

  for (let i = 0; i < node.quasis.length; i++) {
    const quasi = node.quasis[i];
    if (quasi) {
      combinedText += quasi.value.raw;
    }

    if (i < node.expressions.length) {
      const expr = node.expressions[i];
      if (expr && !t.isTSType(expr)) {
        const rawExpr = nodeToExpressionString(expr);
        const token = sanitizeTokenName(rawExpr, existingTokens);
        variables.push({ token, rawExpression: rawExpr });
        combinedText += `{${token}}`;
      }
    }
  }

  const trimmedText = combinedText.trim();
  if (!trimmedText) {
    return null;
  }

  // Ensure the template literal actually contains human-readable words in its static parts,
  // rather than merely concatenating variables with punctuation (e.g. `${a}. ${b}`).
  const hasTranslatableTextInQuasis = node.quasis.some((q) => /\p{L}/u.test(q.value.raw));
  if (!hasTranslatableTextInQuasis) {
    return null;
  }

  return {
    text: trimmedText,
    variables,
  };
}

/**
 * Flattens a string concatenation binary expression tree ("Hello " + user.name + "!").
 */
export function parseBinaryConcatenation(node: t.BinaryExpression): ParsedTemplateResult | null {
  if (node.operator !== "+") {
    return null;
  }

  const collectStrings = (n: t.Node): string[] => {
    if (t.isStringLiteral(n)) return [n.value];
    if (t.isBinaryExpression(n) && n.operator === "+") {
      return [...collectStrings(n.left), ...collectStrings(n.right)];
    }
    return [];
  };
  const stringLiterals = collectStrings(node);
  if (!stringLiterals.some((s) => /\p{L}/u.test(s))) {
    return null;
  }

  const variables: ExtractedVariable[] = [];
  const existingTokens = new Set<string>();

  function collectNodes(n: t.Node): { type: "str" | "expr"; val: string }[] {
    if (t.isBinaryExpression(n) && n.operator === "+") {
      return [...collectNodes(n.left), ...collectNodes(n.right)];
    }
    if (t.isStringLiteral(n)) {
      return [{ type: "str", val: n.value }];
    }
    return [{ type: "expr", val: nodeToExpressionString(n) }];
  }

  const segments = collectNodes(node);
  let hasTranslatableText = false;
  let text = "";

  for (const seg of segments) {
    if (seg.type === "str") {
      text += seg.val;
      if (seg.val.trim().length > 0) {
        hasTranslatableText = true;
      }
    } else {
      const token = sanitizeTokenName(seg.val, existingTokens);
      variables.push({ token, rawExpression: seg.val });
      text += `{${token}}`;
    }
  }

  if (!hasTranslatableText || !text.trim()) {
    return null;
  }

  return {
    text: text.trim(),
    variables,
  };
}

/**
 * Parses a conditional ternary expression representing pluralization
 * (e.g. `count === 1 ? "1 item" : `${count} items`` or `count === 1 ? "item" : "items"`).
 */
export function parseTernaryPlural(node: t.ConditionalExpression): ParsedTemplateResult | null {
  if (!t.isBinaryExpression(node.test)) {
    return null;
  }

  const { left, operator, right } = node.test;
  if (operator !== "===" && operator !== "==") {
    return null;
  }

  let countExpr: t.Node | null = null;
  if (t.isNumericLiteral(right) && right.value === 1) {
    countExpr = left;
  } else if (t.isNumericLiteral(left) && left.value === 1) {
    countExpr = right;
  }

  if (!countExpr) {
    return null;
  }

  const rawCountExpr = nodeToExpressionString(countExpr);
  const token = rawCountExpr.includes(".") ? "count" : rawCountExpr;

  // Extract consequent text (singular)
  let oneText: string | null = null;
  if (t.isStringLiteral(node.consequent)) {
    oneText = node.consequent.value.trim();
  } else if (t.isTemplateLiteral(node.consequent)) {
    const res = parseTemplateLiteral(node.consequent);
    if (res) {
      oneText = res.text;
    }
  }

  // Extract alternate text (plural)
  let otherText: string | null = null;
  if (t.isStringLiteral(node.alternate)) {
    otherText = node.alternate.value.trim();
  } else if (t.isTemplateLiteral(node.alternate)) {
    const res = parseTemplateLiteral(node.alternate);
    if (res) {
      otherText = res.text;
    }
  }

  if (!oneText || !otherText) {
    return null;
  }

  const icuPlural = `{${token}, plural, one {${oneText}} other {${otherText}}}`;
  return {
    text: icuPlural,
    variables: [{ token, rawExpression: rawCountExpr }],
  };
}

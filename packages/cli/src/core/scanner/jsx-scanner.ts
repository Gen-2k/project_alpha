import { basename } from "node:path";

import { parse } from "@babel/parser";
import babelTraverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";

import {
  IGNORED_JSX_ELEMENTS,
  isTranslatableText,
  TRANSLATABLE_ATTRIBUTES,
} from "./ignore-rules.js";
import type { ExtractedString, ScanResult } from "./types.js";
import {
  parseBinaryConcatenation,
  parseTemplateLiteral,
  parseTernaryPlural,
} from "./variable-parser.js";

type TraverseFn = (
  parent: t.Node,
  opts: { noScope?: boolean; enter: (path: NodePath) => void },
) => void;

interface NestedModule {
  default?: TraverseFn | { default?: TraverseFn };
}

const traverseModule = babelTraverse as unknown as TraverseFn | NestedModule;

export function resolveTraverse(mod: unknown = traverseModule): TraverseFn {
  if (typeof mod === "function") {
    return mod as TraverseFn;
  }

  const firstLevel = (mod as NestedModule | undefined)?.default;
  if (typeof firstLevel === "function") {
    return firstLevel;
  }

  if (firstLevel && typeof firstLevel === "object" && "default" in firstLevel) {
    const secondLevel = firstLevel.default;
    if (typeof secondLevel === "function") {
      return secondLevel;
    }
  }

  throw new Error("Unable to resolve callable @babel/traverse function");
}

const traverse = resolveTraverse();

/**
 * Normalizes multi-line JSX text into a clean single string while preserving spacing between words.
 */
function normalizeJsxText(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ");
}

function unwrapRenderFunction(expr: t.Expression): t.Function | null {
  if (t.isArrowFunctionExpression(expr) || t.isFunctionExpression(expr)) {
    return expr;
  }
  if (t.isCallExpression(expr)) {
    const firstArg = expr.arguments[0];
    if (firstArg && t.isExpression(firstArg)) {
      return unwrapRenderFunction(firstArg);
    }
  }
  return null;
}

function hasMixedInlineChildren(children: t.JSXElement["children"]): boolean {
  const containerElements = children.filter((child) => {
    if (t.isJSXElement(child)) {
      return child.children.length > 0;
    }
    return false;
  });

  const textNodes = children.filter(
    (child) => t.isJSXText(child) && normalizeJsxText(child.value).length > 0,
  );

  return containerElements.length > 0 && textNodes.length > 1;
}

/**
 * Finds the enclosing PascalCase React component name for a JSX node,
 * safely ignoring nested helper functions or event handlers (e.g. `copyEnvToClipboard`).
 */
function findEnclosingComponentName(jsxPath: NodePath, defaultName: string): string {
  let current: NodePath | null = jsxPath;
  let fallbackName: string | undefined;

  while (current) {
    if (current.isFunctionDeclaration()) {
      const id = current.node.id;
      if (id) {
        if (/^[A-Z]/.test(id.name)) {
          return id.name;
        }
        fallbackName ??= id.name;
      }
    } else if (current.isVariableDeclarator()) {
      const id = current.node.id;
      const init = current.node.init;
      const fn = init ? unwrapRenderFunction(init) : null;
      if (t.isIdentifier(id) && fn) {
        if (/^[A-Z]/.test(id.name)) {
          return id.name;
        }
        fallbackName ??= id.name;
      }
    } else if (current.isExportDefaultDeclaration()) {
      const decl = current.node.declaration;
      let fn: t.Function | null = null;
      if (
        t.isFunctionDeclaration(decl) ||
        t.isArrowFunctionExpression(decl) ||
        t.isFunctionExpression(decl)
      ) {
        fn = decl;
      } else if (t.isCallExpression(decl)) {
        fn = unwrapRenderFunction(decl);
      }
      if (fn && "id" in decl && decl.id && /^[A-Z]/.test(decl.id.name)) {
        return decl.id.name;
      }
    }
    current = current.parentPath;
  }

  return fallbackName && /^[A-Z]/.test(fallbackName) ? fallbackName : defaultName;
}

/**
 * Scans React/JSX/TSX source code and extracts translatable raw strings.
 */
export function scanJsx(code: string, filePath = "unknown.tsx"): ScanResult {
  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript", "decorators-legacy"],
      errorRecovery: true,
    });
  } catch {
    return {
      filePath,
      strings: [],
      hasClientDirective: false,
    };
  }

  const hasClientDirective = ast.program.directives.some(
    (directive) => directive.value.value === "use client",
  );

  const rawBase = basename(filePath).replace(/\.[^.]+$/, "");
  const fileDefaultComponent = rawBase === "index" ? "common" : rawBase;

  const strings: ExtractedString[] = [];

  try {
    traverse(ast, {
      noScope: true,
      enter(path: NodePath) {
        if (path.isJSXElement()) {
          const opening = path.node.openingElement;
          let tagName = "";

          if (t.isJSXIdentifier(opening.name)) {
            tagName = opening.name.name.toLowerCase();
          }

          if (IGNORED_JSX_ELEMENTS.has(tagName)) {
            path.skip();
            return;
          }

          const componentName = findEnclosingComponentName(path, fileDefaultComponent);

          // 1. Scan JSX Attributes
          for (const attr of opening.attributes) {
            if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) {
              continue;
            }

            const attrName = attr.name.name;
            if (!TRANSLATABLE_ATTRIBUTES.has(attrName)) {
              continue;
            }

            if (t.isStringLiteral(attr.value)) {
              const rawValue = attr.value.value;
              if (isTranslatableText(rawValue)) {
                const line = attr.loc?.start.line ?? 1;
                const column = attr.loc?.start.column ?? 0;
                strings.push({
                  id: `${filePath}:${String(line)}:${String(column)}`,
                  text: rawValue,
                  line,
                  column,
                  sourceType: "jsx-attribute",
                  attributeName: attrName,
                  componentName,
                });
              }
            } else if (t.isJSXExpressionContainer(attr.value)) {
              const expr = attr.value.expression;
              if (t.isTemplateLiteral(expr)) {
                const parsed = parseTemplateLiteral(expr);
                if (parsed && isTranslatableText(parsed.text)) {
                  const line = attr.loc?.start.line ?? 1;
                  const column = attr.loc?.start.column ?? 0;
                  strings.push({
                    id: `${filePath}:${String(line)}:${String(column)}`,
                    text: parsed.text,
                    line,
                    column,
                    sourceType: "jsx-attribute",
                    attributeName: attrName,
                    componentName,
                    variables: parsed.variables,
                  });
                }
              }
            }
          }

          // 2. Scan direct JSX children (JSXText, TemplateLiteral, BinaryExpression, TernaryPlural)
          const isMixed = hasMixedInlineChildren(path.node.children);
          for (const child of path.node.children) {
            if (t.isJSXText(child)) {
              if (isMixed) {
                continue;
              }
              const cleanedText = normalizeJsxText(child.value);
              if (isTranslatableText(cleanedText)) {
                const line = child.loc?.start.line ?? 1;
                const column = child.loc?.start.column ?? 0;
                strings.push({
                  id: `${filePath}:${String(line)}:${String(column)}`,
                  text: cleanedText,
                  line,
                  column,
                  sourceType: "jsx-text",
                  componentName,
                });
              }
            } else if (t.isJSXExpressionContainer(child)) {
              const expr = child.expression;
              if (t.isTemplateLiteral(expr)) {
                const parsed = parseTemplateLiteral(expr);
                if (parsed && isTranslatableText(parsed.text)) {
                  const line = child.loc?.start.line ?? 1;
                  const column = child.loc?.start.column ?? 0;
                  strings.push({
                    id: `${filePath}:${String(line)}:${String(column)}`,
                    text: parsed.text,
                    line,
                    column,
                    sourceType: "jsx-expression",
                    componentName,
                    variables: parsed.variables,
                  });
                }
              } else if (t.isBinaryExpression(expr)) {
                const parsed = parseBinaryConcatenation(expr);
                if (parsed && isTranslatableText(parsed.text)) {
                  const line = child.loc?.start.line ?? 1;
                  const column = child.loc?.start.column ?? 0;
                  strings.push({
                    id: `${filePath}:${String(line)}:${String(column)}`,
                    text: parsed.text,
                    line,
                    column,
                    sourceType: "jsx-expression",
                    componentName,
                    variables: parsed.variables,
                  });
                }
              } else if (t.isConditionalExpression(expr)) {
                const parsed = parseTernaryPlural(expr);
                if (parsed) {
                  const line = child.loc?.start.line ?? 1;
                  const column = child.loc?.start.column ?? 0;
                  strings.push({
                    id: `${filePath}:${String(line)}:${String(column)}`,
                    text: parsed.text,
                    line,
                    column,
                    sourceType: "jsx-expression",
                    componentName,
                    variables: parsed.variables,
                  });
                } else {
                  const scanBranch = (branch: t.Expression) => {
                    if (t.isStringLiteral(branch) && isTranslatableText(branch.value)) {
                      const line = branch.loc?.start.line ?? 1;
                      const column = branch.loc?.start.column ?? 0;
                      strings.push({
                        id: `${filePath}:${String(line)}:${String(column)}`,
                        text: branch.value,
                        line,
                        column,
                        sourceType: "jsx-expression",
                        componentName,
                      });
                    } else if (t.isTemplateLiteral(branch)) {
                      const parsedTmpl = parseTemplateLiteral(branch);
                      if (parsedTmpl && isTranslatableText(parsedTmpl.text)) {
                        const line = branch.loc?.start.line ?? 1;
                        const column = branch.loc?.start.column ?? 0;
                        strings.push({
                          id: `${filePath}:${String(line)}:${String(column)}`,
                          text: parsedTmpl.text,
                          line,
                          column,
                          sourceType: "jsx-expression",
                          componentName,
                          variables: parsedTmpl.variables,
                        });
                      }
                    } else if (t.isConditionalExpression(branch)) {
                      scanBranch(branch.consequent);
                      scanBranch(branch.alternate);
                    }
                  };
                  scanBranch(expr.consequent);
                  scanBranch(expr.alternate);
                }
              }
            }
          }
        } else if (path.isVariableDeclarator()) {
          const compName = findEnclosingComponentName(path, fileDefaultComponent);
          if (!compName || !/^[A-Z]/.test(compName)) {
            return;
          }

          const isMultiWordTranslatable = (text: string) => {
            const trimmed = text.trim();
            return (
              (/\s+/.test(trimmed) || trimmed.endsWith("...") || trimmed.endsWith("!")) &&
              isTranslatableText(trimmed)
            );
          };

          const scanExpr = (expr: t.Expression | null | undefined) => {
            if (!expr) return;
            if (t.isStringLiteral(expr) && isMultiWordTranslatable(expr.value)) {
              const line = expr.loc?.start.line ?? 1;
              const column = expr.loc?.start.column ?? 0;
              strings.push({
                id: `${filePath}:${String(line)}:${String(column)}`,
                text: expr.value,
                line,
                column,
                sourceType: "jsx-expression",
                componentName: compName,
              });
            } else if (t.isTemplateLiteral(expr)) {
              const parsed = parseTemplateLiteral(expr);
              if (parsed && isMultiWordTranslatable(parsed.text)) {
                const line = expr.loc?.start.line ?? 1;
                const column = expr.loc?.start.column ?? 0;
                strings.push({
                  id: `${filePath}:${String(line)}:${String(column)}`,
                  text: parsed.text,
                  line,
                  column,
                  sourceType: "jsx-expression",
                  componentName: compName,
                  variables: parsed.variables,
                });
              }
            } else if (t.isConditionalExpression(expr)) {
              scanExpr(expr.consequent);
              scanExpr(expr.alternate);
            } else if (t.isLogicalExpression(expr)) {
              if (expr.operator === "??" || expr.operator === "||") {
                scanExpr(expr.right);
              }
            }
          };

          scanExpr(path.node.init);
        }
      },
    });
  } catch {
    return {
      filePath,
      hasClientDirective,
      strings,
    };
  }

  return {
    filePath,
    hasClientDirective,
    strings,
  };
}

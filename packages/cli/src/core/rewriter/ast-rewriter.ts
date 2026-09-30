import { basename } from "node:path";

import babelGenerator from "@babel/generator";
import { parse, parseExpression } from "@babel/parser";
import babelTraverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";

import {
  IGNORED_JSX_ELEMENTS,
  isTranslatableText,
  TRANSLATABLE_ATTRIBUTES,
} from "../scanner/ignore-rules.js";
import {
  parseBinaryConcatenation,
  parseTemplateLiteral,
  parseTernaryPlural,
} from "../scanner/variable-parser.js";
import { generateKey } from "./key-naming.js";

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

type GeneratorFn = (ast: t.Node, opts?: Record<string, unknown>, code?: string) => { code: string };

interface NestedGeneratorModule {
  default?: GeneratorFn | { default?: GeneratorFn };
}

const generatorModule = babelGenerator as unknown as GeneratorFn | NestedGeneratorModule;

export function resolveGenerator(mod: unknown = generatorModule): GeneratorFn {
  if (typeof mod === "function") {
    return mod as GeneratorFn;
  }
  const firstLevel = (mod as NestedGeneratorModule | undefined)?.default;
  if (typeof firstLevel === "function") {
    return firstLevel;
  }
  if (firstLevel && typeof firstLevel === "object" && "default" in firstLevel) {
    const secondLevel = firstLevel.default;
    if (typeof secondLevel === "function") {
      return secondLevel;
    }
  }
  throw new Error("Unable to resolve callable @babel/generator function");
}

const generate = resolveGenerator();

export interface RewriteOptions {
  framework?: "next-intl" | "react-i18next" | "custom";
  hookName?: string;
  serverHookName?: string;
  importSource?: string;
  serverImportSource?: string;
  filePath?: string;
}

export interface RewriteResult {
  code: string;
  extractedEntries: Record<string, string>;
  hasClientDirective: boolean;
}

/**
 * Creates a t('key', { param1: expr1 }) AST call expression node.
 */
function createTranslationCall(
  key: string,
  variables: { token: string; rawExpression: string }[] = [],
): t.CallExpression {
  const args: t.Expression[] = [t.stringLiteral(key)];

  if (variables.length > 0) {
    const props = variables.map((v) => {
      let valueExpr: t.Expression;
      try {
        valueExpr = parseExpression(v.rawExpression, {
          plugins: ["typescript"],
        });
      } catch {
        valueExpr = t.identifier(v.token);
      }

      return t.objectProperty(t.identifier(v.token), valueExpr);
    });

    args.push(t.objectExpression(props));
  }

  return t.callExpression(t.identifier("t"), args);
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
    (child) =>
      t.isJSXText(child) &&
      child.value
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .join(" ").length > 0,
  );

  return containerElements.length > 0 && textNodes.length > 1;
}

interface EnclosingComponentInfo {
  name: string;
  block: t.BlockStatement;
  fnNode?: t.Function;
}

/**
 * Finds the enclosing PascalCase React component function and its block statement,
 * safely skipping nested helper functions and event handlers (e.g. `copyEnvToClipboard`).
 */
function findEnclosingComponent(
  jsxPath: NodePath,
  defaultName: string,
): EnclosingComponentInfo | null {
  let current: NodePath | null = jsxPath;
  let topFunctionBlock: t.BlockStatement | null = null;
  let topFunctionName: string | undefined;
  let topFnNode: t.Function | undefined;

  while (current) {
    if (current.isFunctionDeclaration()) {
      const id = current.node.id;
      if (id && /^[A-Z]/.test(id.name)) {
        return { name: id.name, block: current.node.body, fnNode: current.node };
      }
      if (!topFunctionBlock) {
        topFunctionBlock = current.node.body;
        topFunctionName = id?.name;
        topFnNode = current.node;
      }
    } else if (current.isVariableDeclarator()) {
      const id = current.node.id;
      const init = current.node.init;
      const fn = init ? unwrapRenderFunction(init) : null;
      if (t.isIdentifier(id) && fn) {
        if (!t.isBlockStatement(fn.body)) {
          fn.body = t.blockStatement([t.returnStatement(fn.body)]);
        }
        if (/^[A-Z]/.test(id.name)) {
          return { name: id.name, block: fn.body, fnNode: fn };
        }
        if (!topFunctionBlock) {
          topFunctionBlock = fn.body;
          topFunctionName = id.name;
          topFnNode = fn;
        }
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
      if (fn) {
        if (!t.isBlockStatement(fn.body)) {
          fn.body = t.blockStatement([t.returnStatement(fn.body)]);
        }
        const declName =
          "id" in decl && decl.id && t.isIdentifier(decl.id) ? decl.id.name : defaultName;
        return { name: declName, block: fn.body, fnNode: fn };
      }
    }
    current = current.parentPath;
  }

  if (topFunctionBlock) {
    const finalName =
      topFunctionName && /^[A-Z]/.test(topFunctionName) ? topFunctionName : defaultName;
    return { name: finalName, block: topFunctionBlock, fnNode: topFnNode };
  }

  return null;
}

/**
 * Rewrites React JSX code, replacing raw strings with t('key') and injecting framework translation hooks.
 */
export function rewriteJsx(code: string, options: RewriteOptions = {}): RewriteResult {
  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript", "decorators-legacy"],
      errorRecovery: true,
    });
  } catch {
    return {
      code,
      extractedEntries: {},
      hasClientDirective: false,
    };
  }

  const hasClientDirective = ast.program.directives.some((d) => d.value.value === "use client");
  const hasClientHooks =
    /use(?:State|Effect|Ref|Memo|Callback|Context|Reducer|Transition|Id|LayoutEffect)\s*\(/.test(
      code,
    );

  const framework = options.framework ?? "next-intl";
  const isReactI18next = framework === "react-i18next";
  const isClientComponent = hasClientDirective || hasClientHooks || isReactI18next;

  const clientHook = options.hookName ?? (isReactI18next ? "useTranslation" : "useTranslations");
  const serverHook = options.serverHookName ?? "getTranslations";
  const clientImportSource =
    options.importSource ?? (isReactI18next ? "react-i18next" : "next-intl");
  const serverImportSource = options.serverImportSource ?? "next-intl/server";

  const rawBase = options.filePath
    ? basename(options.filePath).replace(/\.[^.]+$/, "")
    : "component";
  const fileDefaultComponent = rawBase === "index" ? "common" : rawBase;

  const extractedEntries: Record<string, string> = {};
  const existingKeys = new Set<string>();
  const modifiedComponents = new Map<t.BlockStatement, EnclosingComponentInfo>();

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

          const compInfo = findEnclosingComponent(path, fileDefaultComponent);
          const compName = compInfo?.name ?? fileDefaultComponent;

          // 1. Transform translatable attributes
          for (const attr of opening.attributes) {
            if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) {
              continue;
            }

            const attrName = attr.name.name;
            if (!TRANSLATABLE_ATTRIBUTES.has(attrName)) {
              continue;
            }

            if (t.isStringLiteral(attr.value)) {
              const raw = attr.value.value;
              if (isTranslatableText(raw)) {
                const key = generateKey(raw, compName, existingKeys);
                extractedEntries[key] = raw;

                const tCall = createTranslationCall(key);
                attr.value = t.jsxExpressionContainer(tCall);

                if (compInfo) {
                  modifiedComponents.set(compInfo.block, compInfo);
                }
              }
            } else if (t.isJSXExpressionContainer(attr.value)) {
              const expr = attr.value.expression;
              if (t.isTemplateLiteral(expr)) {
                const parsed = parseTemplateLiteral(expr);
                if (parsed && isTranslatableText(parsed.text)) {
                  const key = generateKey(parsed.text, compName, existingKeys);
                  extractedEntries[key] = parsed.text;

                  const tCall = createTranslationCall(key, parsed.variables);
                  attr.value = t.jsxExpressionContainer(tCall);

                  if (compInfo) {
                    modifiedComponents.set(compInfo.block, compInfo);
                  }
                }
              } else if (t.isBinaryExpression(expr)) {
                const parsed = parseBinaryConcatenation(expr);
                if (parsed && isTranslatableText(parsed.text)) {
                  const key = generateKey(parsed.text, compName, existingKeys);
                  extractedEntries[key] = parsed.text;

                  const tCall = createTranslationCall(key, parsed.variables);
                  attr.value = t.jsxExpressionContainer(tCall);

                  if (compInfo) {
                    modifiedComponents.set(compInfo.block, compInfo);
                  }
                }
              }
            }
          }

          // 2. Transform children (JSXText, TemplateLiteral, BinaryExpression, TernaryPlural)
          const isMixed = hasMixedInlineChildren(path.node.children);
          const newChildren: typeof path.node.children = [];

          for (const child of path.node.children) {
            if (t.isJSXText(child)) {
              if (isMixed) {
                newChildren.push(child);
                continue;
              }
              const raw = child.value
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter((l) => l.length > 0)
                .join(" ");

              if (isTranslatableText(raw)) {
                const key = generateKey(raw, compName, existingKeys);
                extractedEntries[key] = raw;

                const tCall = createTranslationCall(key);
                newChildren.push(t.jsxExpressionContainer(tCall));

                if (compInfo) {
                  modifiedComponents.set(compInfo.block, compInfo);
                }
              } else {
                newChildren.push(child);
              }
            } else if (t.isJSXExpressionContainer(child)) {
              const expr = child.expression;
              if (t.isTemplateLiteral(expr)) {
                const parsed = parseTemplateLiteral(expr);
                if (parsed && isTranslatableText(parsed.text)) {
                  const key = generateKey(parsed.text, compName, existingKeys);
                  extractedEntries[key] = parsed.text;

                  const tCall = createTranslationCall(key, parsed.variables);
                  newChildren.push(t.jsxExpressionContainer(tCall));

                  if (compInfo) {
                    modifiedComponents.set(compInfo.block, compInfo);
                  }
                  continue;
                }
              } else if (t.isBinaryExpression(expr)) {
                const parsed = parseBinaryConcatenation(expr);
                if (parsed && isTranslatableText(parsed.text)) {
                  const key = generateKey(parsed.text, compName, existingKeys);
                  extractedEntries[key] = parsed.text;

                  const tCall = createTranslationCall(key, parsed.variables);
                  newChildren.push(t.jsxExpressionContainer(tCall));

                  if (compInfo) {
                    modifiedComponents.set(compInfo.block, compInfo);
                  }
                  continue;
                }
              } else if (t.isConditionalExpression(expr)) {
                const parsed = parseTernaryPlural(expr);
                if (parsed) {
                  const key = generateKey(parsed.text, compName, existingKeys);
                  extractedEntries[key] = parsed.text;

                  const tCall = createTranslationCall(key, parsed.variables);
                  newChildren.push(t.jsxExpressionContainer(tCall));

                  if (compInfo) {
                    modifiedComponents.set(compInfo.block, compInfo);
                  }
                  continue;
                } else {
                  const rewriteBranch = (branch: t.Expression): t.Expression => {
                    if (t.isStringLiteral(branch) && isTranslatableText(branch.value)) {
                      const key = generateKey(branch.value, compName, existingKeys);
                      extractedEntries[key] = branch.value;
                      if (compInfo) {
                        modifiedComponents.set(compInfo.block, compInfo);
                      }
                      return createTranslationCall(key);
                    }
                    if (t.isTemplateLiteral(branch)) {
                      const parsedTmpl = parseTemplateLiteral(branch);
                      if (parsedTmpl && isTranslatableText(parsedTmpl.text)) {
                        const key = generateKey(parsedTmpl.text, compName, existingKeys);
                        extractedEntries[key] = parsedTmpl.text;
                        if (compInfo) {
                          modifiedComponents.set(compInfo.block, compInfo);
                        }
                        return createTranslationCall(key, parsedTmpl.variables);
                      }
                    }
                    if (t.isConditionalExpression(branch)) {
                      branch.consequent = rewriteBranch(branch.consequent);
                      branch.alternate = rewriteBranch(branch.alternate);
                      return branch;
                    }
                    return branch;
                  };

                  expr.consequent = rewriteBranch(expr.consequent);
                  expr.alternate = rewriteBranch(expr.alternate);
                  newChildren.push(child);
                  continue;
                }
              }
              newChildren.push(child);
            } else {
              newChildren.push(child);
            }
          }

          path.node.children = newChildren;
        } else if (path.isVariableDeclarator()) {
          const compInfo = findEnclosingComponent(path, fileDefaultComponent);
          if (!compInfo?.name || !/^[A-Z]/.test(compInfo.name)) {
            return;
          }

          const compName = compInfo.name;
          const isMultiWordTranslatable = (text: string) => {
            const trimmed = text.trim();
            return (
              (/\s+/.test(trimmed) || trimmed.endsWith("...") || trimmed.endsWith("!")) &&
              isTranslatableText(trimmed)
            );
          };

          const rewriteExpr = (expr: t.Expression): t.Expression => {
            if (t.isStringLiteral(expr) && isMultiWordTranslatable(expr.value)) {
              const key = generateKey(expr.value, compName, existingKeys);
              extractedEntries[key] = expr.value;
              modifiedComponents.set(compInfo.block, compInfo);
              return createTranslationCall(key);
            }
            if (t.isTemplateLiteral(expr)) {
              const parsed = parseTemplateLiteral(expr);
              if (parsed && isMultiWordTranslatable(parsed.text)) {
                const key = generateKey(parsed.text, compName, existingKeys);
                extractedEntries[key] = parsed.text;
                modifiedComponents.set(compInfo.block, compInfo);
                return createTranslationCall(key, parsed.variables);
              }
            }
            if (t.isConditionalExpression(expr)) {
              expr.consequent = rewriteExpr(expr.consequent);
              expr.alternate = rewriteExpr(expr.alternate);
              return expr;
            }
            if (t.isLogicalExpression(expr)) {
              if (expr.operator === "??" || expr.operator === "||") {
                expr.right = rewriteExpr(expr.right);
              }
              return expr;
            }
            return expr;
          };

          if (path.node.init) {
            path.node.init = rewriteExpr(path.node.init);
          }
        }
      },
    });
  } catch {
    return {
      code,
      extractedEntries: {},
      hasClientDirective,
    };
  }

  // If no strings were extracted, return original code unmodified
  if (Object.keys(extractedEntries).length === 0) {
    return {
      code,
      extractedEntries: {},
      hasClientDirective,
    };
  }

  // 3. Inject hook declaration into enclosing component block
  for (const compInfo of modifiedComponents.values()) {
    const block = compInfo.block;
    const hasExistingT = block.body.some((stmt) => {
      if (t.isVariableDeclaration(stmt)) {
        return stmt.declarations.some(
          (decl) =>
            (t.isIdentifier(decl.id) && decl.id.name === "t") ||
            (t.isObjectPattern(decl.id) &&
              decl.id.properties.some(
                (p) => t.isObjectProperty(p) && t.isIdentifier(p.key) && p.key.name === "t",
              )),
        );
      }
      return false;
    });

    if (!hasExistingT) {
      if (isReactI18next) {
        // const { t } = useTranslation();
        const hookCall = t.callExpression(t.identifier(clientHook), []);
        const hookDecl = t.variableDeclaration("const", [
          t.variableDeclarator(
            t.objectPattern([t.objectProperty(t.identifier("t"), t.identifier("t"), false, true)]),
            hookCall,
          ),
        ]);
        block.body.unshift(hookDecl);
      } else {
        // const t = useTranslations(); or const t = await getTranslations();
        if (!isClientComponent && compInfo.fnNode) {
          compInfo.fnNode.async = true;
        }
        const hookCall = isClientComponent
          ? t.callExpression(t.identifier(clientHook), [])
          : t.awaitExpression(t.callExpression(t.identifier(serverHook), []));

        const hookDecl = t.variableDeclaration("const", [
          t.variableDeclarator(t.identifier("t"), hookCall),
        ]);
        block.body.unshift(hookDecl);
      }
    }
  }

  // 4. Inject framework import if not already present
  const targetImportSource = isClientComponent ? clientImportSource : serverImportSource;
  const targetImportMethod = isClientComponent ? clientHook : serverHook;

  const hasImport = ast.program.body.some(
    (stmt) => t.isImportDeclaration(stmt) && stmt.source.value === targetImportSource,
  );

  if (!hasImport) {
    const importDecl = t.importDeclaration(
      [t.importSpecifier(t.identifier(targetImportMethod), t.identifier(targetImportMethod))],
      t.stringLiteral(targetImportSource),
    );

    let insertIndex = 0;
    while (
      insertIndex < ast.program.body.length &&
      t.isImportDeclaration(ast.program.body[insertIndex])
    ) {
      insertIndex++;
    }

    ast.program.body.splice(insertIndex, 0, importDecl);
  }

  const generated = generate(ast, {
    retainLines: false,
    compact: false,
    jsescOption: { minimal: true },
  });

  return {
    code: generated.code,
    extractedEntries,
    hasClientDirective,
  };
}

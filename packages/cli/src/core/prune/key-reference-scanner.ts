import { parse } from "@babel/parser";
import babelTraverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";

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
 * Scans JavaScript / TypeScript code to find all actively referenced i18n keys (e.g. t('key.name')).
 */
export function findReferencedKeys(code: string): Set<string> {
  const referencedKeys = new Set<string>();

  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript", "decorators-legacy"],
      errorRecovery: true,
    });
  } catch {
    return referencedKeys;
  }

  try {
    traverse(ast, {
      noScope: true,
      enter(path: NodePath) {
        // 1. Match t('key') or t("key") or t(`key`)
        if (path.isCallExpression()) {
          const callee = path.node.callee;
          let isTranslationCall = false;

          if (t.isIdentifier(callee) && callee.name === "t") {
            isTranslationCall = true;
          } else if (
            t.isMemberExpression(callee) &&
            t.isIdentifier(callee.property) &&
            callee.property.name === "t"
          ) {
            isTranslationCall = true;
          }

          if (isTranslationCall && path.node.arguments.length > 0) {
            const firstArg = path.node.arguments[0];
            if (t.isStringLiteral(firstArg)) {
              referencedKeys.add(firstArg.value);
            } else if (t.isTemplateLiteral(firstArg)) {
              if (firstArg.quasis.length === 1) {
                const raw = firstArg.quasis[0]?.value.raw;
                if (raw) {
                  referencedKeys.add(raw);
                }
              } else if (firstArg.quasis.length > 1) {
                const prefix = firstArg.quasis[0]?.value.raw;
                if (prefix && prefix.length > 0) {
                  referencedKeys.add(`${prefix}*`);
                }
              }
            }
          }
        }

        // 2. Match <Trans id="key" /> or <FormattedMessage id="key" />
        if (path.isJSXElement()) {
          const opening = path.node.openingElement;
          for (const attr of opening.attributes) {
            if (
              t.isJSXAttribute(attr) &&
              t.isJSXIdentifier(attr.name) &&
              (attr.name.name === "id" || attr.name.name === "i18nKey") &&
              t.isStringLiteral(attr.value)
            ) {
              referencedKeys.add(attr.value.value);
            }
          }
        }
      },
    });
  } catch {
    return referencedKeys;
  }

  return referencedKeys;
}

/**
 * Compares catalog keys against actively referenced code keys to identify obsolete/dead keys.
 */
export function identifyObsoleteKeys(catalogKeys: string[], activeKeys: Set<string>): string[] {
  const wildcardPrefixes: string[] = [];
  for (const key of activeKeys) {
    if (key.endsWith("*")) {
      wildcardPrefixes.push(key.slice(0, -1));
    }
  }

  return catalogKeys.filter((key) => {
    if (activeKeys.has(key)) {
      return false;
    }
    for (const prefix of wildcardPrefixes) {
      if (key.startsWith(prefix)) {
        return false;
      }
    }
    return true;
  });
}

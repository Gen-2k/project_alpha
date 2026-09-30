import type { ExtractedVariable } from "./variable-parser.js";

export type StringSourceType = "jsx-text" | "jsx-attribute" | "jsx-expression";

export interface ExtractedString {
  id: string;
  text: string;
  line: number;
  column: number;
  sourceType: StringSourceType;
  attributeName?: string;
  componentName?: string;
  variables?: ExtractedVariable[];
}

export interface ScanResult {
  filePath: string;
  hasClientDirective: boolean;
  strings: ExtractedString[];
}

export type { ExtractedVariable };

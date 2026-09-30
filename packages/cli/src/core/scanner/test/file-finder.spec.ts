import * as fsPromises from "node:fs/promises";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findJsxFiles } from "../file-finder.js";

describe("findJsxFiles", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "giltflow-finder-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  it("finds .tsx, .jsx, .ts, and .js source files", async () => {
    await writeFile(join(tempDir, "Button.tsx"), "export const Button = () => <button />;");
    await writeFile(join(tempDir, "Card.jsx"), "export const Card = () => <div />;");
    await writeFile(join(tempDir, "utils.ts"), "export const sum = (a, b) => a + b;");
    await writeFile(join(tempDir, "helpers.js"), "module.exports = {};");

    const files = await findJsxFiles(tempDir);
    expect(files).toHaveLength(4);
    expect(files.some((f) => f.endsWith("Button.tsx"))).toBe(true);
    expect(files.some((f) => f.endsWith("Card.jsx"))).toBe(true);
    expect(files.some((f) => f.endsWith("utils.ts"))).toBe(true);
    expect(files.some((f) => f.endsWith("helpers.js"))).toBe(true);
  });

  it("handles single file target path directly", async () => {
    const filePath = join(tempDir, "SingleComponent.tsx");
    await writeFile(filePath, "export const Single = () => <div>Hello</div>;");

    const singleResult = await findJsxFiles(filePath);
    expect(singleResult).toEqual([filePath]);

    const ignoredFile = join(tempDir, "SingleComponent.spec.tsx");
    await writeFile(ignoredFile, "test()");
    const ignoredResult = await findJsxFiles(ignoredFile);
    expect(ignoredResult).toEqual([]);
  });

  it("returns empty array for non-existent path", async () => {
    const nonExistent = join(tempDir, "does-not-exist");
    const result = await findJsxFiles(nonExistent);
    expect(result).toEqual([]);
  });

  it("ignores tests, declaration files, and configs", async () => {
    await writeFile(join(tempDir, "App.tsx"), "export const App = () => null;");
    await writeFile(join(tempDir, "App.spec.tsx"), "test()");
    await writeFile(join(tempDir, "App.test.ts"), "test()");
    await writeFile(join(tempDir, "types.d.ts"), "declare module 'foo'");
    await writeFile(join(tempDir, "vite.config.ts"), "export default {}");
    await writeFile(join(tempDir, "tailwind.config.js"), "module.exports = {}");

    const files = await findJsxFiles(tempDir);
    expect(files).toHaveLength(1);
    expect(files[0]?.endsWith("App.tsx")).toBe(true);
  });

  it("ignores node_modules, dist, and build directories", async () => {
    const nodeModules = join(tempDir, "node_modules");
    await mkdir(nodeModules, { recursive: true });
    await writeFile(join(nodeModules, "pkg.js"), "code");

    const srcDir = join(tempDir, "src");
    await mkdir(srcDir, { recursive: true });
    await writeFile(join(srcDir, "index.ts"), "code");

    const files = await findJsxFiles(tempDir);
    expect(files).toHaveLength(1);
    expect(files[0]?.endsWith("index.ts")).toBe(true);
  });

  it("handles readdir and stat errors gracefully during directory traversal", async () => {
    const subDir = join(tempDir, "sub");
    await mkdir(subDir, { recursive: true });
    await writeFile(join(subDir, "Component.tsx"), "export const Component = () => null;");

    let readdirCalls = 0;
    const files1 = await findJsxFiles(tempDir, {
      readdir: async (p) => {
        readdirCalls++;
        if (readdirCalls === 2) {
          throw new Error("EACCES: permission denied");
        }
        return fsPromises.readdir(p);
      },
    });
    expect(Array.isArray(files1)).toBe(true);

    let statCalls = 0;
    const files2 = await findJsxFiles(tempDir, {
      stat: async (p) => {
        statCalls++;
        if (statCalls === 2) {
          throw new Error("EPERM: operation not permitted");
        }
        return fsPromises.stat(p);
      },
    });
    expect(Array.isArray(files2)).toBe(true);
  });
});

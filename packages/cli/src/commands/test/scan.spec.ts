import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runScan } from "../scan.js";

describe("runScan Command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `giltflow-scan-test-${String(Date.now())}`);
    await mkdir(tempDir, { recursive: true });
    process.exitCode = undefined;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    process.exitCode = undefined;
  });

  it("should return true when no candidate files are present", async () => {
    const success = await runScan({ path: tempDir });
    expect(success).toBe(true);
  });

  it("should return true when all components are already internationalized", async () => {
    const componentCode = `
      export function Button() {
        return <button>{t("btn.submit")}</button>;
      }
    `;
    await writeFile(join(tempDir, "Button.tsx"), componentCode, "utf-8");

    const success = await runScan({ path: tempDir });
    expect(success).toBe(true);
  });

  it("should discover hardcoded strings and return true in non-CI mode", async () => {
    const componentCode = `
      export function Banner() {
        return <div>Welcome to our application!</div>;
      }
    `;
    await writeFile(join(tempDir, "Banner.tsx"), componentCode, "utf-8");

    const success = await runScan({ path: tempDir, ci: false });
    expect(success).toBe(true);
    expect(process.exitCode).toBeUndefined();
  });

  it("should fail and set exitCode to 1 in CI mode when strings are found", async () => {
    const componentCode = `
      export function Banner() {
        return <div>Welcome to our application!</div>;
      }
    `;
    await writeFile(join(tempDir, "Banner.tsx"), componentCode, "utf-8");

    const success = await runScan({ path: tempDir, ci: true });
    expect(success).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it("should run with default parameters when no options are provided", async () => {
    const success = await runScan();
    expect(typeof success).toBe("boolean");
  });
});

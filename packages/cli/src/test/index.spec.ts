import { describe, expect, it } from "vitest";

import { CLI_NAME, CLI_VERSION } from "../index.js";

describe("CLI entrypoint constants", () => {
  it("should export correct CLI name and version", () => {
    expect(CLI_NAME).toBe("giltflow");
    expect(CLI_VERSION).toBe("0.1.0");
  });
});

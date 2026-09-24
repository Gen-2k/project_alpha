import type { Db } from "@repo/database/client";
import { describe, expect, it } from "vitest";

import { HealthController } from "../health.controller.js";
import { HealthService } from "../health.service.js";

describe("HealthController", () => {
  const fakeDb = {
    execute: () => Promise.resolve([]),
  } as unknown as Db;
  const controller = new HealthController(new HealthService(fakeDb));

  describe("status", () => {
    it("should return the service status", async () => {
      await expect(controller.status()).resolves.toMatchObject({ status: "ok" });
    });
  });

  describe("live", () => {
    it("should return liveness info", () => {
      expect(controller.live()).toMatchObject({ status: "ok" });
    });
  });

  describe("ready", () => {
    it("should return readiness info", async () => {
      await expect(controller.ready()).resolves.toMatchObject({ status: "ok" });
    });
  });
});

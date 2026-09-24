import type { Db } from "@repo/database/client";
import { describe, expect, it } from "vitest";

import { HealthService } from "../health.service.js";

function fakeDb(throws = false): Db {
  return {
    execute: () => {
      if (throws) return Promise.reject(new Error("db down"));
      return Promise.resolve([]);
    },
  } as unknown as Db;
}

describe("HealthService", () => {
  describe("liveness", () => {
    it("should report liveness with uptime and version", () => {
      const liveness = new HealthService(fakeDb()).liveness();
      expect(liveness).toMatchObject({
        status: "ok",
        version: "0.0.0",
      });
      expect(typeof liveness.uptimeSeconds).toBe("number");
    });
  });

  describe("ready", () => {
    it("should report ok when database is reachable", async () => {
      const ready = await new HealthService(fakeDb()).ready();
      expect(ready).toEqual({
        status: "ok",
        database: "up",
      });
    });

    it("should throw ServiceUnavailableException when database is down", async () => {
      await expect(new HealthService(fakeDb(true)).ready()).rejects.toThrow();
    });
  });

  describe("status", () => {
    it("should report ok with database up", async () => {
      const status = await new HealthService(fakeDb()).status();
      expect(status).toMatchObject({
        status: "ok",
        version: "0.0.0",
        database: "up",
      });
    });

    it("should report degraded with database down instead of throwing", async () => {
      const status = await new HealthService(fakeDb(true)).status();
      expect(status).toMatchObject({ status: "degraded", database: "down" });
    });
  });
});

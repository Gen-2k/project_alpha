import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { HealthService } from "./health.service.js";

describe("HealthService", () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  describe("status", () => {
    it("should report ok with version and uptime", () => {
      expect(service.status()).toMatchObject({ status: "ok", version: "0.0.0" });
    });
  });

  describe("echo", () => {
    it("should echo the message back", () => {
      expect(service.echo("hello")).toEqual({ echo: "hello" });
    });
  });
});

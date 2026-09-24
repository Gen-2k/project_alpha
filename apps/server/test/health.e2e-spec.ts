import type { INestApplication } from "@nestjs/common";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, it } from "vitest";

import { AppModule } from "../src/app.module.js";

describe("Health (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("/health (GET)", () => {
    return request(app.getHttpServer())
      .get("/health")
      .expect(200)
      .expect(({ body }) => {
        if (body.status !== "ok") throw new Error("expected status ok");
      });
  });

  it("/health/echo (POST) echoes valid bodies", () => {
    return request(app.getHttpServer())
      .post("/health/echo")
      .send({ message: "hello" })
      .expect(201)
      .expect(({ body }) => {
        if (body.echo !== "hello") throw new Error("expected echo back");
      });
  });

  it("/health/echo (POST) rejects invalid bodies", () => {
    return request(app.getHttpServer()).post("/health/echo").send({ message: "" }).expect(400);
  });

  afterEach(async () => {
    await app.close();
  });
});

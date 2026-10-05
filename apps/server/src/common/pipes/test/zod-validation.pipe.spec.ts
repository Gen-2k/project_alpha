import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ZodValidationPipe } from "../zod-validation.pipe.js";

const schema = z.object({ name: z.string().min(1) });

describe("ZodValidationPipe", () => {
  const pipe = new ZodValidationPipe(schema);

  it("should pass valid values through untouched", () => {
    expect(pipe.transform({ name: "ada" })).toEqual({ name: "ada" });
  });

  it("should throw BadRequestException with field paths for invalid values", () => {
    try {
      pipe.transform({ name: "" });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        message: string;
        issues: { path: string; message: string }[];
      };
      expect(response.message).toBe("Validation failed");
      expect(response.issues[0]?.path).toBe("name");
    }
  });

  it("should pass param values through untouched without validation", () => {
    expect(pipe.transform("some-uuid-id", { type: "param", metatype: String, data: "id" })).toBe(
      "some-uuid-id",
    );
  });
});

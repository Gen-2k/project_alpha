import type { PipeTransform } from "@nestjs/common";
import { BadRequestException, Injectable } from "@nestjs/common";
import type { ZodType } from "zod";

// Zod equivalent of the class-validator ValidationPipe: attach per-route
// with `@UsePipes(new ZodValidationPipe(schema))`. Schemas can later move
// verbatim into packages/validation and serve frontend forms too.
@Injectable()
export class ZodValidationPipe implements PipeTransform<unknown, unknown> {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}

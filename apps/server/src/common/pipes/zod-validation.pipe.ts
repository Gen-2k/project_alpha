import type { ArgumentMetadata, PipeTransform } from "@nestjs/common";
import { BadRequestException, Injectable } from "@nestjs/common";
import type { ZodType } from "zod";

// Zod equivalent of the class-validator ValidationPipe: attach per-route
// with `@Body(new ZodValidationPipe(schema))` (or @Query). Method-level
// @UsePipes applies to every param, so this pipe skips `param` metadata —
// validate `:id` params explicitly with ParseUUIDPipe / a param schema.
// Schemas can later move verbatim into packages/validation and serve
// frontend forms too.
@Injectable()
export class ZodValidationPipe implements PipeTransform<unknown, unknown> {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, metadata?: ArgumentMetadata): unknown {
    if (metadata?.type === "param") {
      return value;
    }

    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        code: "VALIDATION_FAILED",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}

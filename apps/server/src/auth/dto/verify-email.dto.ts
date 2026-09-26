import { ApiProperty } from "@nestjs/swagger";
import type { VerifyEmailDto as IVerifyEmailDto } from "@repo/validation/auth";

export class VerifyEmailDto implements IVerifyEmailDto {
  @ApiProperty({
    example: "4a9f82d1c6e047b8a3e9c2d1b5a8f7e6",
    description: "Cryptographic email verification token received via email",
  })
  token!: string;
}

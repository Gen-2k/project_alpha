import { ApiProperty } from "@nestjs/swagger";
import type { ResendVerificationDto as IResendVerificationDto } from "@repo/validation/auth";

export class ResendVerificationDto implements IResendVerificationDto {
  @ApiProperty({
    example: "ada@example.com",
    description: "Account email address to resend verification instructions to",
    format: "email",
  })
  email!: string;
}

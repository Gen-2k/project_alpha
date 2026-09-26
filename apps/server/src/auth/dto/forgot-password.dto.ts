import { ApiProperty } from "@nestjs/swagger";
import type { ForgotPasswordDto as IForgotPasswordDto } from "@repo/validation/auth";

export class ForgotPasswordDto implements IForgotPasswordDto {
  @ApiProperty({
    example: "ada@example.com",
    description: "Registered email address to request password reset link",
    format: "email",
  })
  email!: string;
}

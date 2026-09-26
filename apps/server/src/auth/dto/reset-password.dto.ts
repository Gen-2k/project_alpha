import { ApiProperty } from "@nestjs/swagger";
import type { ResetPasswordDto as IResetPasswordDto } from "@repo/validation/auth";

export class ResetPasswordDto implements IResetPasswordDto {
  @ApiProperty({
    example: "a1b2c3d4e5f6...32-byte-hex-token",
    description: "Password reset token received via email",
  })
  token!: string;

  @ApiProperty({
    example: "fresh-strong-password-123",
    description: "New password (8 to 72 characters)",
  })
  newPassword!: string;
}

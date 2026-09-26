import { ApiProperty } from "@nestjs/swagger";
import type { UpdatePasswordDto as IUpdatePasswordDto } from "@repo/validation/auth";

export class UpdatePasswordDto implements IUpdatePasswordDto {
  @ApiProperty({
    example: "current-password-123",
    description: "Existing account password",
  })
  currentPassword!: string;

  @ApiProperty({
    example: "fresh-strong-password-456",
    description: "New password (must differ from current password)",
  })
  newPassword!: string;
}

import { ApiProperty } from "@nestjs/swagger";
import type { RegisterDto as IRegisterDto } from "@repo/validation/auth";

export class RegisterDto implements IRegisterDto {
  @ApiProperty({
    example: "ada@example.com",
    description: "Unique email address (max 255 chars, auto-normalized to lowercase)",
    format: "email",
  })
  email!: string;

  @ApiProperty({
    example: "correct-horse-battery-staple",
    description: "Account password (8 to 72 characters)",
    minLength: 8,
    maxLength: 72,
  })
  password!: string;
}

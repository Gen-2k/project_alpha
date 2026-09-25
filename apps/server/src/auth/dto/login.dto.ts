import { ApiProperty } from "@nestjs/swagger";
import type { LoginDto as ILoginDto } from "@repo/validation/auth";

export class LoginDto implements ILoginDto {
  @ApiProperty({
    example: "ada@example.com",
    description: "Registered email address",
    format: "email",
  })
  email!: string;

  @ApiProperty({
    example: "correct-horse-battery-staple",
    description: "Account password",
  })
  password!: string;
}

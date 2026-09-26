import { ApiProperty } from "@nestjs/swagger";
import type {
  DeleteAccountDto as IDeleteAccountDto,
  DeleteAccountResponseDto as IDeleteAccountResponseDto,
} from "@repo/validation/auth";

export class DeleteAccountDto implements IDeleteAccountDto {
  @ApiProperty({
    example: "correct-horse-battery-staple",
    description: "Current account password to confirm deletion",
  })
  password!: string;
}

export class DeleteAccountResponseDto implements IDeleteAccountResponseDto {
  @ApiProperty({
    example: true,
    description: "Confirms user account and associated sessions have been permanently deleted",
  })
  deleted!: true;

  @ApiProperty({
    example: "Your account and all associated data have been permanently deleted.",
    description: "Confirmation message",
  })
  message!: string;
}

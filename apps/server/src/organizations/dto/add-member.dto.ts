import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  AddMemberDto as IAddMemberDto,
  OrganizationRole,
} from "@repo/validation/organizations";

export class AddMemberDto implements IAddMemberDto {
  @ApiProperty({
    example: "colleague@example.com",
    description: "Email address of the user to add as an organization member",
    format: "email",
  })
  email!: string;

  @ApiPropertyOptional({
    example: "developer",
    enum: ["owner", "admin", "project_manager", "developer", "reviewer", "translator", "viewer"],
    default: "developer",
    description: "Role to assign within the organization",
  })
  role: OrganizationRole = "developer";
}

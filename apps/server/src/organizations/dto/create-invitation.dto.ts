import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { CreateInvitationDto, OrganizationRole } from "@repo/validation/organizations";

export class CreateInvitationDtoClass implements CreateInvitationDto {
  @ApiProperty({
    example: "colleague@example.com",
    description: "Email address of the team member to invite",
  })
  email!: string;

  @ApiPropertyOptional({
    enum: ["owner", "admin", "project_manager", "developer", "reviewer", "translator", "viewer"],
    default: "developer",
    description: "Role to assign to the invited user within the organization",
  })
  role!: OrganizationRole;
}

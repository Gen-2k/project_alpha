import { ApiProperty } from "@nestjs/swagger";
import type {
  OrganizationRole,
  UpdateMemberRoleDto as IUpdateMemberRoleDto,
} from "@repo/validation/organizations";

export class UpdateMemberRoleDto implements IUpdateMemberRoleDto {
  @ApiProperty({
    example: "admin",
    enum: ["owner", "admin", "project_manager", "developer", "reviewer", "translator", "viewer"],
    description: "New role to assign to the organization member",
  })
  role!: OrganizationRole;
}

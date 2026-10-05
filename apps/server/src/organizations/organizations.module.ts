import { Module } from "@nestjs/common";

import { UsersModule } from "../users/users.module.js";
import { OrgMembershipGuard } from "./guards/org-membership.guard.js";
import { OrganizationsController } from "./organizations.controller.js";
import { OrganizationsService } from "./organizations.service.js";

@Module({
  imports: [UsersModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgMembershipGuard],
  exports: [OrganizationsService, OrgMembershipGuard],
})
export class OrganizationsModule {}

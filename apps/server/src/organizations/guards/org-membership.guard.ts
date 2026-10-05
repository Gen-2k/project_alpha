import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { OrganizationRole } from "@repo/validation/organizations";

import { OrganizationsService } from "../organizations.service.js";
import type { OrgAuthenticatedRequest } from "../organizations.types.js";
import { ROLE_HIERARCHY } from "../organizations.types.js";
import { ORG_ROLES_KEY } from "./org-role.decorator.js";

@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<OrgAuthenticatedRequest>();
    const rawOrgId = req.params.id ?? req.params.organizationId;
    const orgId = typeof rawOrgId === "string" ? rawOrgId : undefined;

    if (!orgId) {
      return true;
    }

    if (!req.user.sub) {
      throw new ForbiddenException("Authentication is required");
    }

    const membership = await this.organizationsService.getMembership(orgId, req.user.sub);
    if (!membership) {
      throw new ForbiddenException("You do not have access to this organization");
    }

    const requiredRoles = this.reflector.getAllAndOverride<OrganizationRole[] | undefined>(
      ORG_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles && requiredRoles.length > 0) {
      const userLevel = ROLE_HIERARCHY[membership.role];
      const minRequiredLevel = Math.min(...requiredRoles.map((r) => ROLE_HIERARCHY[r]));
      if (userLevel < minRequiredLevel) {
        throw new ForbiddenException("You do not have sufficient permissions in this organization");
      }
    }

    req.orgMembership = membership;
    return true;
  }
}

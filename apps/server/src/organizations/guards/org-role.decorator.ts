import { SetMetadata } from "@nestjs/common";
import type { OrganizationRole } from "@repo/validation/organizations";

export const ORG_ROLES_KEY = "orgRoles";
export const RequireOrgRole = (...roles: OrganizationRole[]) => SetMetadata(ORG_ROLES_KEY, roles);

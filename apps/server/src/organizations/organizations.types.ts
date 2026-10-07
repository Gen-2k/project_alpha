import type { OrganizationMemberDto, OrganizationRole } from "@repo/validation/organizations";

import type { AuthenticatedRequest } from "../auth/auth.types.js";

export const ROLE_HIERARCHY: Record<OrganizationRole, number> = {
  owner: 50,
  admin: 40,
  project_manager: 30,
  developer: 20,
  reviewer: 15,
  translator: 10,
  viewer: 5,
};

// Single source for invitation expiry: the service sets expiresAt from this
// and MailService derives the matching display value from the same constant.
export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export interface OrgAuthenticatedRequest extends AuthenticatedRequest {
  orgMembership?: OrganizationMemberDto;
}

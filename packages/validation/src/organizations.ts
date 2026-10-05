import { emailSchema, nameSchema, passwordSchema } from "@repo/validation/auth";
import { z } from "zod";

export const organizationRoles = [
  "owner",
  "admin",
  "project_manager",
  "developer",
  "reviewer",
  "translator",
  "viewer",
] as const;

export type OrganizationRole = (typeof organizationRoles)[number];

export const orgRoleSchema = z.enum(organizationRoles);

export const orgSlugSchema = z
  .string({ error: "Slug is required" })
  .trim()
  .toLowerCase()
  .min(3, "Slug must be at least 3 characters long")
  .max(64, "Slug must not exceed 64 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug must contain only lowercase alphanumeric characters and single hyphens",
  );

export const orgNameSchema = z
  .string({ error: "Organization name is required" })
  .trim()
  .min(1, "Organization name is required")
  .max(100, "Organization name must not exceed 100 characters");

export const createOrganizationSchema = z.object({
  name: orgNameSchema,
  slug: orgSlugSchema.optional(),
});

export type CreateOrganizationDto = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z
  .object({
    name: orgNameSchema.optional(),
    slug: orgSlugSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
  });

export type UpdateOrganizationDto = z.infer<typeof updateOrganizationSchema>;

export const addMemberSchema = z.object({
  email: emailSchema,
  role: orgRoleSchema.default("developer"),
});

export type AddMemberDto = z.infer<typeof addMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: orgRoleSchema,
});

export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleSchema>;

export const createInvitationSchema = z.object({
  email: emailSchema,
  role: orgRoleSchema.default("developer"),
});

export type CreateInvitationDto = z.infer<typeof createInvitationSchema>;

export const acceptInvitationSchema = z.object({
  token: z
    .string({ error: "Invitation token is required" })
    .trim()
    .min(32, "Invalid invitation token")
    .max(128, "Invalid invitation token"),
  name: nameSchema.optional(),
  password: passwordSchema.optional(),
});

export type AcceptInvitationDto = z.infer<typeof acceptInvitationSchema>;

// Outward DTO interfaces
export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  planTier: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationMemberDto {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  user?: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface UserOrganizationMembershipDto {
  organization: OrganizationDto;
  role: OrganizationRole;
}

export interface OrganizationInvitationDto {
  id: string;
  organizationId: string;
  email: string;
  role: OrganizationRole;
  invitedByUserId: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvitationDetailsDto {
  organizationId: string;
  organizationName: string;
  email: string;
  role: OrganizationRole;
  inviterName: string | null;
  inviterEmail: string;
  expiresAt: Date;
}

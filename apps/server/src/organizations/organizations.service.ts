import { createHash, randomBytes } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Db } from "@repo/database/client";
import { DB } from "@repo/database/client";
import {
  organizationInvitations,
  organizationMembers,
  organizations,
  users,
} from "@repo/database/schema";
import type {
  AddMemberDto,
  CreateInvitationDto,
  CreateOrganizationDto,
  InvitationDetailsDto,
  OrganizationDto,
  OrganizationInvitationDto,
  OrganizationMemberDto,
  OrganizationRole,
  UpdateOrganizationDto,
  UserOrganizationMembershipDto,
} from "@repo/validation/organizations";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";

import { MailService } from "../mail/mail.service.js";
import { UsersService } from "../users/users.service.js";
import { ROLE_HIERARCHY } from "./organizations.types.js";

const safeOrgColumns = {
  id: organizations.id,
  name: organizations.name,
  slug: organizations.slug,
  planTier: organizations.planTier,
  createdAt: organizations.createdAt,
  updatedAt: organizations.updatedAt,
};

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length >= 3 ? base : `org-${randomBytes(3).toString("hex")}`;
}

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly usersService: UsersService,
    private readonly mailService?: MailService,
  ) {}

  async create(userId: string, input: CreateOrganizationDto): Promise<OrganizationDto> {
    const slug = input.slug ? input.slug.toLowerCase().trim() : slugify(input.name);

    return this.db.transaction(async (tx) => {
      try {
        const [org] = await tx
          .insert(organizations)
          .values({
            name: input.name,
            slug,
          })
          .returning(safeOrgColumns);

        if (!org) {
          throw new Error("Failed to create organization record");
        }

        await tx.insert(organizationMembers).values({
          organizationId: org.id,
          userId,
          role: "owner",
        });

        return org;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException("An organization with this slug already exists");
        }
        throw error;
      }
    });
  }

  async listForUser(userId: string): Promise<UserOrganizationMembershipDto[]> {
    const rows = await this.db
      .select({
        organization: safeOrgColumns,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(eq(organizationMembers.userId, userId));

    return rows;
  }

  async findById(organizationId: string): Promise<OrganizationDto | undefined> {
    const [row] = await this.db
      .select(safeOrgColumns)
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    return row;
  }

  async findBySlug(slug: string): Promise<OrganizationDto | undefined> {
    const [row] = await this.db
      .select(safeOrgColumns)
      .from(organizations)
      .where(eq(organizations.slug, slug));
    return row;
  }

  async getMembership(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberDto | undefined> {
    const [row] = await this.db
      .select({
        id: organizationMembers.id,
        organizationId: organizationMembers.organizationId,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        createdAt: organizationMembers.createdAt,
        updatedAt: organizationMembers.updatedAt,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      );
    return row;
  }

  async update(organizationId: string, input: UpdateOrganizationDto): Promise<OrganizationDto> {
    try {
      const [updated] = await this.db
        .update(organizations)
        .set({
          ...input,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, organizationId))
        .returning(safeOrgColumns);

      if (!updated) {
        throw new NotFoundException("Organization not found");
      }

      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("An organization with this slug already exists");
      }
      throw error;
    }
  }

  async delete(organizationId: string): Promise<void> {
    const existing = await this.findById(organizationId);
    if (!existing) {
      throw new NotFoundException("Organization not found");
    }
    await this.db.delete(organizations).where(eq(organizations.id, organizationId));
  }

  async listMembers(organizationId: string): Promise<OrganizationMemberDto[]> {
    const rows = await this.db
      .select({
        id: organizationMembers.id,
        organizationId: organizationMembers.organizationId,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        createdAt: organizationMembers.createdAt,
        updatedAt: organizationMembers.updatedAt,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, organizationId));

    return rows;
  }

  async addMember(
    organizationId: string,
    dto: AddMemberDto,
    actorRole?: OrganizationRole,
    actorUserId?: string,
  ): Promise<OrganizationMemberDto> {
    if (actorRole && ROLE_HIERARCHY[actorRole] <= ROLE_HIERARCHY[dto.role]) {
      throw new ForbiddenException(
        `You cannot assign a role (${dto.role}) equal to or higher than your own (${actorRole})`,
      );
    }

    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new NotFoundException("No user found with the provided email address");
    }

    const existing = await this.getMembership(organizationId, user.id);
    if (existing) {
      throw new ConflictException("User is already a member of this organization");
    }

    const [member] = await this.db
      .insert(organizationMembers)
      .values({
        organizationId,
        userId: user.id,
        role: dto.role,
      })
      .returning({
        id: organizationMembers.id,
        organizationId: organizationMembers.organizationId,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        createdAt: organizationMembers.createdAt,
        updatedAt: organizationMembers.updatedAt,
      });

    if (!member) {
      throw new Error("Failed to create membership record");
    }

    if (this.mailService) {
      try {
        const org = await this.findById(organizationId);
        if (org) {
          const actor = actorUserId ? await this.usersService.findById(actorUserId) : undefined;
          await this.mailService.sendMemberAddedNotification(user.email, {
            organizationName: org.name,
            adderName: actor?.name,
            role: dto.role,
          });
        }
      } catch (err) {
        this.logger.warn(`Failed to dispatch member added notification: ${String(err)}`);
      }
    }

    return {
      ...member,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    newRole: OrganizationRole,
    actorRole?: OrganizationRole,
  ): Promise<OrganizationMemberDto> {
    return this.db.transaction(async (tx) => {
      const [member] = await tx
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.id, memberId),
            eq(organizationMembers.organizationId, organizationId),
          ),
        );

      if (!member) {
        throw new NotFoundException("Organization member not found");
      }

      if (actorRole) {
        if (ROLE_HIERARCHY[actorRole] <= ROLE_HIERARCHY[member.role]) {
          throw new ForbiddenException(
            `You cannot modify a member whose role (${member.role}) is equal to or higher than your own (${actorRole})`,
          );
        }
        if (ROLE_HIERARCHY[actorRole] <= ROLE_HIERARCHY[newRole]) {
          throw new ForbiddenException(
            `You cannot assign a role (${newRole}) equal to or higher than your own (${actorRole})`,
          );
        }
      }

      if (member.role === "owner" && newRole !== "owner") {
        const owners = await tx
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, organizationId),
              eq(organizationMembers.role, "owner"),
            ),
          )
          .for("update");

        if (owners.length <= 1) {
          throw new BadRequestException("Cannot demote the only owner of the organization");
        }
      }

      const [updated] = await tx
        .update(organizationMembers)
        .set({
          role: newRole,
          updatedAt: new Date(),
        })
        .where(eq(organizationMembers.id, memberId))
        .returning({
          id: organizationMembers.id,
          organizationId: organizationMembers.organizationId,
          userId: organizationMembers.userId,
          role: organizationMembers.role,
          createdAt: organizationMembers.createdAt,
          updatedAt: organizationMembers.updatedAt,
        });

      if (!updated) {
        throw new NotFoundException("Failed to update organization member");
      }

      const user = await this.usersService.findById(updated.userId);

      return {
        ...updated,
        user: user
          ? {
              id: user.id,
              email: user.email,
              name: user.name,
              avatarUrl: user.avatarUrl,
            }
          : undefined,
      };
    });
  }

  async removeMember(
    organizationId: string,
    memberId: string,
    actorRole?: OrganizationRole,
    isSelf = false,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [member] = await tx
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.id, memberId),
            eq(organizationMembers.organizationId, organizationId),
          ),
        );

      if (!member) {
        throw new NotFoundException("Organization member not found");
      }

      if (!isSelf && actorRole && ROLE_HIERARCHY[actorRole] <= ROLE_HIERARCHY[member.role]) {
        throw new ForbiddenException(
          `You cannot remove a member whose role (${member.role}) is equal to or higher than your own (${actorRole})`,
        );
      }

      if (member.role === "owner") {
        const owners = await tx
          .select({ id: organizationMembers.id })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, organizationId),
              eq(organizationMembers.role, "owner"),
            ),
          )
          .for("update");

        if (owners.length <= 1) {
          throw new BadRequestException(
            "Cannot remove the only owner of the organization. Transfer ownership or delete the organization instead.",
          );
        }
      }

      await tx.delete(organizationMembers).where(eq(organizationMembers.id, memberId));
    });
  }

  async createInvitation(
    organizationId: string,
    actorUserId: string,
    actorRole: OrganizationRole,
    input: CreateInvitationDto,
  ): Promise<OrganizationInvitationDto> {
    if (ROLE_HIERARCHY[actorRole] <= ROLE_HIERARCHY[input.role]) {
      throw new ForbiddenException(
        `You cannot invite a member with a role (${input.role}) equal to or higher than your own (${actorRole})`,
      );
    }

    const org = await this.findById(organizationId);
    if (!org) {
      throw new NotFoundException("Organization not found");
    }

    const existingUser = await this.usersService.findByEmail(input.email);
    if (existingUser) {
      const [existingMember] = await this.db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.userId, existingUser.id),
          ),
        );
      if (existingMember) {
        throw new ConflictException("User is already a member of this organization");
      }
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [existingInvite] = await this.db
      .select()
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.organizationId, organizationId),
          eq(organizationInvitations.email, input.email),
          isNull(organizationInvitations.acceptedAt),
        ),
      );

    let invitation: OrganizationInvitationDto;
    if (existingInvite) {
      const [updated] = await this.db
        .update(organizationInvitations)
        .set({
          role: input.role,
          tokenHash,
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(organizationInvitations.id, existingInvite.id))
        .returning();
      if (!updated) {
        throw new Error("Failed to update invitation");
      }
      invitation = updated;
    } else {
      const [created] = await this.db
        .insert(organizationInvitations)
        .values({
          organizationId,
          email: input.email,
          role: input.role,
          invitedByUserId: actorUserId,
          tokenHash,
          expiresAt,
        })
        .returning();
      if (!created) {
        throw new Error("Failed to create invitation");
      }
      invitation = created;
    }

    if (this.mailService) {
      const inviter = await this.usersService.findById(actorUserId);
      try {
        await this.mailService.sendOrganizationInvitationEmail(input.email, {
          organizationName: org.name,
          inviterName: inviter?.name,
          inviterEmail: inviter?.email ?? "An administrator",
          role: input.role,
          rawToken,
          expiresInDays: 7,
        });
      } catch (err) {
        this.logger.warn(`Failed to dispatch organization invitation email: ${String(err)}`);
      }
    }

    return invitation;
  }

  async listInvitations(organizationId: string): Promise<OrganizationInvitationDto[]> {
    return this.db
      .select()
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.organizationId, organizationId),
          isNull(organizationInvitations.acceptedAt),
          gt(organizationInvitations.expiresAt, new Date()),
        ),
      );
  }

  async revokeInvitation(organizationId: string, invitationId: string): Promise<void> {
    const [invite] = await this.db
      .select()
      .from(organizationInvitations)
      .where(
        and(
          eq(organizationInvitations.id, invitationId),
          eq(organizationInvitations.organizationId, organizationId),
        ),
      );

    if (!invite) {
      throw new NotFoundException("Invitation not found");
    }

    await this.db
      .delete(organizationInvitations)
      .where(eq(organizationInvitations.id, invitationId));
  }

  async getInvitationByToken(rawToken: string): Promise<InvitationDetailsDto> {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const [row] = await this.db
      .select({
        organizationId: organizationInvitations.organizationId,
        organizationName: organizations.name,
        email: organizationInvitations.email,
        role: organizationInvitations.role,
        inviterName: users.name,
        inviterEmail: users.email,
        expiresAt: organizationInvitations.expiresAt,
      })
      .from(organizationInvitations)
      .innerJoin(organizations, eq(organizations.id, organizationInvitations.organizationId))
      .innerJoin(users, eq(users.id, organizationInvitations.invitedByUserId))
      .where(
        and(
          eq(organizationInvitations.tokenHash, tokenHash),
          isNull(organizationInvitations.acceptedAt),
          gt(organizationInvitations.expiresAt, new Date()),
        ),
      );

    if (!row) {
      throw new NotFoundException("Invitation is invalid or has expired");
    }

    return row;
  }

  async acceptInvitation(
    rawToken: string,
    input: { name?: string; password?: string },
    currentUserId?: string,
  ): Promise<{ organizationId: string; message: string }> {
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    return this.db.transaction(async (tx) => {
      const [invite] = await tx
        .select()
        .from(organizationInvitations)
        .where(
          and(
            eq(organizationInvitations.tokenHash, tokenHash),
            isNull(organizationInvitations.acceptedAt),
            gt(organizationInvitations.expiresAt, new Date()),
          ),
        )
        .for("update");

      if (!invite) {
        throw new BadRequestException(
          "Invitation is invalid, has expired, or has already been accepted",
        );
      }

      let userIdToJoin: string;

      if (currentUserId) {
        const authUser = await this.usersService.findById(currentUserId);
        if (!authUser) {
          throw new NotFoundException("User not found");
        }
        if (authUser.email.toLowerCase() !== invite.email.toLowerCase()) {
          throw new ForbiddenException(
            `This invitation was sent to ${invite.email}, but you are signed in as ${authUser.email}`,
          );
        }
        userIdToJoin = authUser.id;
      } else {
        const existingUser = await this.usersService.findByEmailWithHash(invite.email);
        if (existingUser) {
          if (!input.password) {
            throw new BadRequestException(
              "An account with this email already exists. Please provide your password to accept the invitation.",
            );
          }
          const valid = await bcrypt.compare(input.password, existingUser.passwordHash);
          if (!valid) {
            throw new UnauthorizedException("The password provided is incorrect");
          }
          userIdToJoin = existingUser.id;
        } else {
          if (!input.password) {
            throw new BadRequestException("Password is required to create your account");
          }
          const passwordHash = await bcrypt.hash(input.password, 10);
          const newUser = await this.usersService.create(
            {
              email: invite.email,
              passwordHash,
              name: input.name ?? null,
              emailVerifiedAt: new Date(),
            },
            tx,
          );
          userIdToJoin = newUser.id;
        }
      }

      const [alreadyMember] = await tx
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, invite.organizationId),
            eq(organizationMembers.userId, userIdToJoin),
          ),
        );

      if (!alreadyMember) {
        await tx.insert(organizationMembers).values({
          organizationId: invite.organizationId,
          userId: userIdToJoin,
          role: invite.role,
        });
      }

      await tx
        .update(organizationInvitations)
        .set({ acceptedAt: new Date(), updatedAt: new Date() })
        .where(eq(organizationInvitations.id, invite.id));

      return {
        organizationId: invite.organizationId,
        message: "Invitation accepted successfully",
      };
    });
  }
}

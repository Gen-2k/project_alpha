import {
  acceptInvitationSchema,
  addMemberSchema,
  createInvitationSchema,
  createOrganizationSchema,
  orgNameSchema,
  orgRoleSchema,
  orgSlugSchema,
  updateMemberRoleSchema,
  updateOrganizationSchema,
} from "@repo/validation/organizations";
import { describe, expect, it } from "vitest";

describe("orgRoleSchema", () => {
  it("accepts all valid organization roles", () => {
    expect(orgRoleSchema.safeParse("owner").success).toBe(true);
    expect(orgRoleSchema.safeParse("admin").success).toBe(true);
    expect(orgRoleSchema.safeParse("project_manager").success).toBe(true);
    expect(orgRoleSchema.safeParse("developer").success).toBe(true);
    expect(orgRoleSchema.safeParse("reviewer").success).toBe(true);
    expect(orgRoleSchema.safeParse("translator").success).toBe(true);
    expect(orgRoleSchema.safeParse("viewer").success).toBe(true);
  });

  it("rejects invalid roles", () => {
    expect(orgRoleSchema.safeParse("linguist").success).toBe(false);
    expect(orgRoleSchema.safeParse("superadmin").success).toBe(false);
    expect(orgRoleSchema.safeParse("guest").success).toBe(false);
    expect(orgRoleSchema.safeParse("").success).toBe(false);
  });
});

describe("orgSlugSchema", () => {
  it("accepts valid URL-safe slugs", () => {
    expect(orgSlugSchema.safeParse("acme-corp").success).toBe(true);
    expect(orgSlugSchema.safeParse("team-alpha-123").success).toBe(true);
    expect(orgSlugSchema.safeParse("giltflow").success).toBe(true);
  });

  it("lowercases and trims slugs", () => {
    const result = orgSlugSchema.safeParse("  Acme-Corp  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("acme-corp");
    }
  });

  it("rejects invalid slugs", () => {
    expect(orgSlugSchema.safeParse("ab").success).toBe(false); // < 3 chars
    expect(orgSlugSchema.safeParse("acme--corp").success).toBe(false); // double hyphen
    expect(orgSlugSchema.safeParse("-acme").success).toBe(false); // leading hyphen
    expect(orgSlugSchema.safeParse("acme-").success).toBe(false); // trailing hyphen
    expect(orgSlugSchema.safeParse("acme corp").success).toBe(false); // space
    expect(orgSlugSchema.safeParse("x".repeat(65)).success).toBe(false); // > 64 chars
  });
});

describe("orgNameSchema", () => {
  it("accepts valid organization names and trims whitespace", () => {
    const result = orgNameSchema.safeParse("  Acme Corporation  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("Acme Corporation");
    }
  });

  it("rejects empty names or names exceeding 100 chars", () => {
    expect(orgNameSchema.safeParse("").success).toBe(false);
    expect(orgNameSchema.safeParse("   ").success).toBe(false);
    expect(orgNameSchema.safeParse("a".repeat(101)).success).toBe(false);
  });
});

describe("createOrganizationSchema", () => {
  it("accepts valid payload with name and optional slug", () => {
    expect(createOrganizationSchema.safeParse({ name: "Acme Corp" }).success).toBe(true);
    expect(
      createOrganizationSchema.safeParse({ name: "Acme Corp", slug: "acme-corp" }).success,
    ).toBe(true);
  });

  it("rejects invalid payload", () => {
    expect(createOrganizationSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createOrganizationSchema.safeParse({}).success).toBe(false);
    expect(createOrganizationSchema.safeParse({ name: "Acme", slug: "invalid slug" }).success).toBe(
      false,
    );
  });
});

describe("updateOrganizationSchema", () => {
  it("accepts partial updates", () => {
    expect(updateOrganizationSchema.safeParse({ name: "New Name" }).success).toBe(true);
    expect(updateOrganizationSchema.safeParse({ slug: "new-slug" }).success).toBe(true);
    expect(updateOrganizationSchema.safeParse({ name: "New Name", slug: "new-slug" }).success).toBe(
      true,
    );
  });

  it("rejects empty update payload", () => {
    expect(updateOrganizationSchema.safeParse({}).success).toBe(false);
  });
});

describe("addMemberSchema", () => {
  it("accepts valid email and defaults role to developer", () => {
    const result = addMemberSchema.safeParse({ email: "  colleague@example.com  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("colleague@example.com");
      expect(result.data.role).toBe("developer");
    }
  });

  it("accepts explicit role", () => {
    const result = addMemberSchema.safeParse({
      email: "pm@example.com",
      role: "project_manager",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("project_manager");
    }
  });

  it("rejects invalid email or role", () => {
    expect(addMemberSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(addMemberSchema.safeParse({ email: "valid@example.com", role: "fake" }).success).toBe(
      false,
    );
  });
});

describe("updateMemberRoleSchema", () => {
  it("accepts valid roles and rejects invalid ones", () => {
    expect(updateMemberRoleSchema.safeParse({ role: "admin" }).success).toBe(true);
    expect(updateMemberRoleSchema.safeParse({ role: "fake" }).success).toBe(false);
    expect(updateMemberRoleSchema.safeParse({}).success).toBe(false);
  });
});

describe("createInvitationSchema", () => {
  it("accepts valid email and defaults role to developer", () => {
    const result = createInvitationSchema.safeParse({ email: "  INVITEE@example.com  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("invitee@example.com");
      expect(result.data.role).toBe("developer");
    }
  });

  it("accepts valid email and custom role", () => {
    const result = createInvitationSchema.safeParse({
      email: "translator@example.com",
      role: "translator",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe("translator");
    }
  });

  it("rejects invalid email or role", () => {
    expect(createInvitationSchema.safeParse({ email: "bad-email" }).success).toBe(false);
    expect(
      createInvitationSchema.safeParse({ email: "valid@example.com", role: "superadmin" }).success,
    ).toBe(false);
  });
});

describe("acceptInvitationSchema", () => {
  const validToken = "a".repeat(64);

  it("accepts valid token alone", () => {
    const result = acceptInvitationSchema.safeParse({ token: validToken });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token).toBe(validToken);
    }
  });

  it("accepts valid token with name and password matching auth pattern", () => {
    const result = acceptInvitationSchema.safeParse({
      token: validToken,
      name: "Bob Builder",
      password: "correct-horse-battery-staple",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Bob Builder");
      expect(result.data.password).toBe("correct-horse-battery-staple");
    }
  });

  it("rejects invalid token or password outside 8-72 char boundary", () => {
    expect(acceptInvitationSchema.safeParse({ token: "short" }).success).toBe(false);
    expect(
      acceptInvitationSchema.safeParse({
        token: validToken,
        password: "short", // less than 8 chars
      }).success,
    ).toBe(false);
    expect(
      acceptInvitationSchema.safeParse({
        token: validToken,
        password: "a".repeat(73), // exceeds 72 chars
      }).success,
    ).toBe(false);
  });
});

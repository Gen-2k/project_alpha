import { randomBytes } from "node:crypto";

// Single home for tiny helpers previously copy-pasted per service.
// Dependency-free on purpose: any module can import this without cycles.

// Postgres unique-violation code: the check-then-insert race is closed by
// the constraint, so concurrent inserts report 409 instead of 500.
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

// URL-safe slug with a per-domain fallback prefix when the name has no
// usable characters (e.g. "!!!" -> "org-a1b2c3").
export function slugify(name: string, fallbackPrefix = "org"): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length >= 3 ? base : `${fallbackPrefix}-${randomBytes(3).toString("hex")}`;
}

// Pathname without query string. Tokens travel as `?token=`, so logging and
// error bodies must never echo `url` verbatim — use this instead.
export function requestPathname(url: unknown): string {
  return typeof url === "string" ? (url.split("?")[0] ?? "/") || "/" : "/";
}

// Strict UUID shape check for route params guarded outside ParseUUIDPipe
// (the guard runs before pipes on some paths). Accepts any UUID version.
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

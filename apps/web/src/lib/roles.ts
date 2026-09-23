import type { UserRole } from "@prisma/client";

/**
 * Client-safe role helpers — do not import auth/env/prisma here.
 * Server session checks live in `@/lib/rbac`.
 */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export const ROLE_OPTIONS: ReadonlyArray<{ value: UserRole }> = [
  { value: "SUPER_ADMIN" },
  { value: "HR" },
  { value: "DEPT_LEADER" },
  { value: "EMPLOYEE" },
];

export function isManagerRole(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "HR";
}

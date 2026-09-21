import { auth } from "@/auth";
import type { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { ApiError } from "./api";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as SessionUser;
}

/** API context: require an authenticated user, optionally with one of the given roles. */
export async function requireApiUser(roles?: UserRole[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "UNAUTHENTICATED");
  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    throw new ApiError(403, "FORBIDDEN");
  }
  return user;
}

/** Page context: require an authenticated user, optionally with one of the given roles; redirect otherwise. */
export async function requirePageUser(roles?: UserRole[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (roles && roles.length > 0 && !roles.includes(user.role)) redirect("/tasks");
  return user;
}

/** Whether the role is a management-side role (HR / super admin). */
export function isManagerRole(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "HR";
}

// Role options for selectors; display labels are resolved via the
// `roles.<ROLE>` i18n keys (never hard-code role names).
export const ROLE_OPTIONS: ReadonlyArray<{ value: UserRole }> = [
  { value: "SUPER_ADMIN" },
  { value: "HR" },
  { value: "DEPT_LEADER" },
  { value: "EMPLOYEE" },
];

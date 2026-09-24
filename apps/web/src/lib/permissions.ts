/**
 * Platform IAM — permission catalog + authorize().
 * RolePermission rows are seeded; runtime checks prefer DB, fall back to catalog.
 */

import { ApiError } from "@/lib/api";
import type { AuthActor } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

export type PermissionCode = `${string}.${string}`;

export const PERMISSION_CATALOG: Array<{
  action: string;
  resource: string;
  description: string;
}> = [
  { action: "template.create", resource: "template", description: "Create templates" },
  { action: "template.read", resource: "template", description: "Read templates" },
  { action: "template.publish", resource: "template", description: "Publish templates" },
  { action: "task.create", resource: "task", description: "Create signing tasks" },
  { action: "task.read", resource: "task", description: "Read signing tasks" },
  { action: "task.approve", resource: "task", description: "Approve signing tasks" },
  { action: "task.sign", resource: "task", description: "Sign / seal tasks" },
  { action: "envelope.create", resource: "envelope", description: "Create envelopes" },
  { action: "envelope.read", resource: "envelope", description: "Read envelopes" },
  { action: "envelope.send", resource: "envelope", description: "Send envelopes" },
  { action: "envelope.void", resource: "envelope", description: "Void envelopes" },
  { action: "seal.manage", resource: "seal", description: "Manage seals" },
  { action: "audit.read", resource: "audit", description: "Read audit logs" },
  { action: "account.manage", resource: "account", description: "Manage accounts" },
  { action: "admin.settings", resource: "admin", description: "System settings" },
];

/** Default role → permission action list (resource implied by action prefix). */
export const ROLE_PERMISSION_ACTIONS: Record<UserRole, string[]> = {
  SUPER_ADMIN: PERMISSION_CATALOG.map((p) => p.action),
  HR: [
    "template.create",
    "template.read",
    "template.publish",
    "task.create",
    "task.read",
    "task.approve",
    "envelope.create",
    "envelope.read",
    "envelope.send",
    "envelope.void",
    "seal.manage",
    "audit.read",
    "account.manage",
  ],
  DEPT_LEADER: ["template.read", "task.read", "task.approve", "envelope.read"],
  EMPLOYEE: ["template.read", "task.read", "task.sign", "envelope.read"],
};

function roleFromActor(actor: AuthActor): UserRole | null {
  if (actor.kind === "apiKey") {
    if (actor.scopes.includes("*") || actor.scopes.includes("SUPER_ADMIN")) return "SUPER_ADMIN";
    if (actor.scopes.includes("HR") || actor.scopes.some((s) => s.startsWith("tasks:"))) return "HR";
    return null;
  }
  return actor.role;
}

/** Sync authorize against catalog (no DB). Used in tests and as fallback. */
export function authorizeRole(role: UserRole, action: string): boolean {
  const allowed = ROLE_PERMISSION_ACTIONS[role];
  return allowed?.includes(action) ?? false;
}

export async function authorize(actor: AuthActor, action: string): Promise<boolean> {
  if (actor.kind === "apiKey" && (actor.scopes.includes("*") || actor.scopes.includes("admin:write"))) {
    return true;
  }
  const role = roleFromActor(actor);
  if (!role) return false;

  try {
    const hit = await prisma.rolePermission.findFirst({
      where: { roleName: role, permission: { action } },
      select: { id: true },
    });
    if (hit) return true;
    // Empty matrix → fall back to catalog so fresh DBs still work before seed.
    const any = await prisma.permission.count();
    if (any === 0) return authorizeRole(role, action);
    return false;
  } catch {
    return authorizeRole(role, action);
  }
}

export async function requirePermission(actor: AuthActor, action: string): Promise<void> {
  const ok = await authorize(actor, action);
  if (!ok) throw new ApiError(403, "FORBIDDEN");
}

/** Upsert catalog + role mappings (idempotent). */
export async function seedPermissionMatrix(): Promise<void> {
  for (const p of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { action_resource: { action: p.action, resource: p.resource } },
      update: { description: p.description },
      create: { action: p.action, resource: p.resource, description: p.description },
    });
  }

  const all = await prisma.permission.findMany();
  const byAction = new Map(all.map((p) => [p.action, p.id]));

  for (const role of Object.keys(ROLE_PERMISSION_ACTIONS) as UserRole[]) {
    const actions = ROLE_PERMISSION_ACTIONS[role];
    for (const action of actions) {
      const permissionId = byAction.get(action);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleName_permissionId: { roleName: role, permissionId } },
        update: {},
        create: { roleName: role, permissionId },
      });
    }
  }
}

export async function listPermissionMatrix(): Promise<
  Array<{ role: UserRole; permissions: Array<{ action: string; resource: string; description: string | null }> }>
> {
  const roles: UserRole[] = ["SUPER_ADMIN", "HR", "DEPT_LEADER", "EMPLOYEE"];
  const rows = await prisma.rolePermission.findMany({
    include: { permission: true },
  });
  return roles.map((role) => ({
    role,
    permissions: rows
      .filter((r) => r.roleName === role)
      .map((r) => ({
        action: r.permission.action,
        resource: r.permission.resource,
        description: r.permission.description,
      })),
  }));
}

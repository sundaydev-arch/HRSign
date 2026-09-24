import { describe, expect, it } from "vitest";
import { authorizeRole, ROLE_PERMISSION_ACTIONS } from "@/lib/permissions";

describe("permissions catalog", () => {
  it("SUPER_ADMIN has all catalog actions", () => {
    expect(ROLE_PERMISSION_ACTIONS.SUPER_ADMIN.length).toBeGreaterThan(10);
    expect(authorizeRole("SUPER_ADMIN", "admin.settings")).toBe(true);
  });

  it("EMPLOYEE can sign but not void envelopes", () => {
    expect(authorizeRole("EMPLOYEE", "task.sign")).toBe(true);
    expect(authorizeRole("EMPLOYEE", "envelope.void")).toBe(false);
  });

  it("HR can manage accounts and templates", () => {
    expect(authorizeRole("HR", "account.manage")).toBe(true);
    expect(authorizeRole("HR", "template.publish")).toBe(true);
  });
});

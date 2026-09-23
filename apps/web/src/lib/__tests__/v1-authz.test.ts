import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import type { AuthActor } from "@/lib/api-auth";
import {
  assertEnvelopeAccess,
  assertV1Roles,
  envelopeAccessWhere,
  V1_HR_ROLES,
} from "@/lib/v1-authz-rules";

function session(role: "SUPER_ADMIN" | "HR" | "EMPLOYEE" | "DEPT_LEADER", id = "u1"): AuthActor {
  return {
    kind: "session",
    id,
    email: `${id}@test.local`,
    name: id,
    role,
  };
}

describe("v1-authz envelope scoping", () => {
  it("HR sees only own envelopes", () => {
    expect(envelopeAccessWhere(session("HR", "hr1"))).toEqual({ createdBy: "hr1" });
  });

  it("SUPER_ADMIN sees all", () => {
    expect(envelopeAccessWhere(session("SUPER_ADMIN"))).toEqual({});
  });

  it("API key sees all", () => {
    const actor: AuthActor = {
      kind: "apiKey",
      apiKeyId: "k1",
      name: "ci",
      scopes: ["*"],
      userId: "admin1",
      role: "SUPER_ADMIN",
    };
    expect(envelopeAccessWhere(actor)).toEqual({});
  });

  it("assertEnvelopeAccess blocks other HR", () => {
    expect(() => assertEnvelopeAccess(session("HR", "hr1"), { createdBy: "hr2" })).toThrow(
      ApiError,
    );
  });

  it("assertEnvelopeAccess allows own", () => {
    expect(() => assertEnvelopeAccess(session("HR", "hr1"), { createdBy: "hr1" })).not.toThrow();
  });

  it("assertV1Roles rejects EMPLOYEE for HR surfaces", () => {
    expect(() => assertV1Roles(session("EMPLOYEE"), V1_HR_ROLES)).toThrow(ApiError);
  });

  it("assertV1Roles allows HR", () => {
    expect(() => assertV1Roles(session("HR"), V1_HR_ROLES)).not.toThrow();
  });
});

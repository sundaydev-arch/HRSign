import { describe, it, expect } from "vitest";
import {
  canTransitionSigning,
  assertSigningTransition,
  isSigningTerminal,
  validSigningTargets,
  SigningTransitionError,
  type SigningStatus,
} from "../signing";

describe("SigningStatus state machine", () => {
  describe("legal transitions", () => {
    it("NOT_STARTED → IN_PROGRESS is legal", () => {
      expect(canTransitionSigning("NOT_STARTED", "IN_PROGRESS")).toBe(true);
    });

    it("NOT_STARTED → EXPIRED is legal (the task expires before starting)", () => {
      expect(canTransitionSigning("NOT_STARTED", "EXPIRED")).toBe(true);
    });

    it("IN_PROGRESS → COMPLETED is legal", () => {
      expect(canTransitionSigning("IN_PROGRESS", "COMPLETED")).toBe(true);
    });

    it("IN_PROGRESS → DECLINED is legal", () => {
      expect(canTransitionSigning("IN_PROGRESS", "DECLINED")).toBe(true);
    });

    it("IN_PROGRESS → EXPIRED is legal", () => {
      expect(canTransitionSigning("IN_PROGRESS", "EXPIRED")).toBe(true);
    });

    it("IN_PROGRESS → REVOKED is legal", () => {
      expect(canTransitionSigning("IN_PROGRESS", "REVOKED")).toBe(true);
    });

    it("COMPLETED → REVOKED is legal (special case, e.g. legal invalidation)", () => {
      expect(canTransitionSigning("COMPLETED", "REVOKED")).toBe(true);
    });
  });

  describe("illegal transitions", () => {
    it("NOT_STARTED → COMPLETED is illegal (must go through IN_PROGRESS)", () => {
      expect(canTransitionSigning("NOT_STARTED", "COMPLETED")).toBe(false);
    });

    it("NOT_STARTED → REVOKED is illegal (requires IN_PROGRESS or COMPLETED first)", () => {
      expect(canTransitionSigning("NOT_STARTED", "REVOKED")).toBe(false);
    });

    it("IN_PROGRESS → NOT_STARTED is illegal (irreversible)", () => {
      expect(canTransitionSigning("IN_PROGRESS", "NOT_STARTED")).toBe(false);
    });

    it("COMPLETED → IN_PROGRESS is illegal (terminal is irreversible; only REVOKED is allowed)", () => {
      expect(canTransitionSigning("COMPLETED", "IN_PROGRESS")).toBe(false);
    });

    it("DECLINED → IN_PROGRESS is illegal (terminal state)", () => {
      expect(canTransitionSigning("DECLINED", "IN_PROGRESS")).toBe(false);
    });

    it("EXPIRED → IN_PROGRESS is illegal (terminal state)", () => {
      expect(canTransitionSigning("EXPIRED", "IN_PROGRESS")).toBe(false);
    });

    it("REVOKED → IN_PROGRESS is illegal (terminal state)", () => {
      expect(canTransitionSigning("REVOKED", "IN_PROGRESS")).toBe(false);
    });

    it("DECLINED → COMPLETED is illegal (no transitions between terminal states)", () => {
      expect(canTransitionSigning("DECLINED", "COMPLETED")).toBe(false);
    });

    it("self-transition IN_PROGRESS → IN_PROGRESS is illegal", () => {
      expect(canTransitionSigning("IN_PROGRESS", "IN_PROGRESS")).toBe(false);
    });
  });

  describe("assertSigningTransition", () => {
    it("does not throw for a legal transition", () => {
      expect(() =>
        assertSigningTransition("IN_PROGRESS", "COMPLETED"),
      ).not.toThrow();
    });

    it("throws SigningTransitionError for an illegal transition", () => {
      try {
        assertSigningTransition("DECLINED", "IN_PROGRESS");
        throw new Error("Expected SigningTransitionError to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(SigningTransitionError);
        const err = e as SigningTransitionError;
        expect(err.from).toBe("DECLINED");
        expect(err.to).toBe("IN_PROGRESS");
      }
    });
  });

  describe("isSigningTerminal", () => {
    it("NOT_STARTED is not terminal", () => {
      expect(isSigningTerminal("NOT_STARTED")).toBe(false);
    });

    it("IN_PROGRESS is not terminal", () => {
      expect(isSigningTerminal("IN_PROGRESS")).toBe(false);
    });

    it("COMPLETED is not terminal (it can be REVOKED)", () => {
      expect(isSigningTerminal("COMPLETED")).toBe(false);
    });

    const terminals: SigningStatus[] = ["DECLINED", "EXPIRED", "REVOKED"];
    it.each(terminals)("%s is terminal", (status) => {
      expect(isSigningTerminal(status)).toBe(true);
    });
  });

  describe("validSigningTargets", () => {
    it("NOT_STARTED can transition to IN_PROGRESS / EXPIRED", () => {
      expect(validSigningTargets("NOT_STARTED").sort()).toEqual([
        "EXPIRED",
        "IN_PROGRESS",
      ]);
    });

    it("IN_PROGRESS can transition to COMPLETED / DECLINED / EXPIRED / REVOKED", () => {
      expect(validSigningTargets("IN_PROGRESS").sort()).toEqual([
        "COMPLETED",
        "DECLINED",
        "EXPIRED",
        "REVOKED",
      ]);
    });

    it("COMPLETED can only transition to REVOKED", () => {
      expect(validSigningTargets("COMPLETED")).toEqual(["REVOKED"]);
    });

    it("DECLINED has no legal targets", () => {
      expect(validSigningTargets("DECLINED")).toEqual([]);
    });

    it("EXPIRED has no legal targets", () => {
      expect(validSigningTargets("EXPIRED")).toEqual([]);
    });

    it("REVOKED has no legal targets", () => {
      expect(validSigningTargets("REVOKED")).toEqual([]);
    });
  });
});

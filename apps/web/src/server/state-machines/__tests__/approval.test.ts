import { describe, it, expect } from "vitest";
import {
  canTransitionApproval,
  assertApprovalTransition,
  isApprovalTerminal,
  validApprovalTargets,
  ApprovalTransitionError,
  type ApprovalStatus,
} from "../approval";

describe("ApprovalStatus state machine", () => {
  describe("legal transitions", () => {
    it("DRAFT → PENDING is legal", () => {
      expect(canTransitionApproval("DRAFT", "PENDING")).toBe(true);
    });

    it("PENDING → APPROVED is legal", () => {
      expect(canTransitionApproval("PENDING", "APPROVED")).toBe(true);
    });

    it("PENDING → REJECTED is legal", () => {
      expect(canTransitionApproval("PENDING", "REJECTED")).toBe(true);
    });

    it("PENDING → WITHDRAWN is legal", () => {
      expect(canTransitionApproval("PENDING", "WITHDRAWN")).toBe(true);
    });
  });

  describe("illegal transitions", () => {
    it("DRAFT → APPROVED is illegal (must go through PENDING)", () => {
      expect(canTransitionApproval("DRAFT", "APPROVED")).toBe(false);
    });

    it("DRAFT → REJECTED is illegal", () => {
      expect(canTransitionApproval("DRAFT", "REJECTED")).toBe(false);
    });

    it("DRAFT → WITHDRAWN is illegal (a draft can only enter PENDING)", () => {
      expect(canTransitionApproval("DRAFT", "WITHDRAWN")).toBe(false);
    });

    it("APPROVED → PENDING is illegal (terminal states are irreversible)", () => {
      expect(canTransitionApproval("APPROVED", "PENDING")).toBe(false);
    });

    it("REJECTED → PENDING is illegal (terminal states are irreversible)", () => {
      expect(canTransitionApproval("REJECTED", "PENDING")).toBe(false);
    });

    it("WITHDRAWN → PENDING is illegal (terminal states are irreversible)", () => {
      expect(canTransitionApproval("WITHDRAWN", "PENDING")).toBe(false);
    });

    it("self-transition DRAFT → DRAFT is illegal", () => {
      expect(canTransitionApproval("DRAFT", "DRAFT")).toBe(false);
    });

    it("PENDING → DRAFT is illegal (a submission cannot be unsubmitted)", () => {
      expect(canTransitionApproval("PENDING", "DRAFT")).toBe(false);
    });
  });

  describe("assertApprovalTransition", () => {
    it("does not throw for a legal transition", () => {
      expect(() =>
        assertApprovalTransition("DRAFT", "PENDING"),
      ).not.toThrow();
    });

    it("throws ApprovalTransitionError for an illegal transition", () => {
      try {
        assertApprovalTransition("DRAFT", "APPROVED");
        throw new Error("Expected ApprovalTransitionError to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(ApprovalTransitionError);
        const err = e as ApprovalTransitionError;
        expect(err.from).toBe("DRAFT");
        expect(err.to).toBe("APPROVED");
        expect(err.message).toContain("DRAFT");
        expect(err.message).toContain("APPROVED");
      }
    });
  });

  describe("isApprovalTerminal", () => {
    it("DRAFT is not terminal", () => {
      expect(isApprovalTerminal("DRAFT")).toBe(false);
    });

    it("PENDING is not terminal", () => {
      expect(isApprovalTerminal("PENDING")).toBe(false);
    });

    const terminals: ApprovalStatus[] = ["APPROVED", "REJECTED", "WITHDRAWN"];
    it.each(terminals)("%s is terminal", (status) => {
      expect(isApprovalTerminal(status)).toBe(true);
    });
  });

  describe("validApprovalTargets", () => {
    it("DRAFT can only transition to PENDING", () => {
      expect(validApprovalTargets("DRAFT")).toEqual(["PENDING"]);
    });

    it("PENDING can transition to APPROVED / REJECTED / WITHDRAWN", () => {
      expect(validApprovalTargets("PENDING").sort()).toEqual([
        "APPROVED",
        "REJECTED",
        "WITHDRAWN",
      ]);
    });

    it("APPROVED has no legal targets", () => {
      expect(validApprovalTargets("APPROVED")).toEqual([]);
    });

    it("REJECTED has no legal targets", () => {
      expect(validApprovalTargets("REJECTED")).toEqual([]);
    });

    it("WITHDRAWN has no legal targets", () => {
      expect(validApprovalTargets("WITHDRAWN")).toEqual([]);
    });
  });

  describe("transition table completeness", () => {
    // Spec 16: the full state-machine transition matrix must be tested.
    it("covers every legal transition", () => {
      const allStatuses: ApprovalStatus[] = [
        "DRAFT",
        "PENDING",
        "APPROVED",
        "REJECTED",
        "WITHDRAWN",
      ];
      // For every status, validate at least one target or confirm none exist.
      for (const from of allStatuses) {
        const targets = validApprovalTargets(from);
        // Every declared target must be transitionable.
        for (const to of targets) {
          expect(canTransitionApproval(from, to)).toBe(true);
        }
      }
    });
  });
});

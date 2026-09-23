import { describe, it, expect } from "vitest";
import {
  canTransitionSigner,
  assertSignerTransition,
  isSignerTerminal,
  validSignerTargets,
  canSignerAct,
  areAllSignersSigned,
  hasSignerDeclined,
  computeSigningStatus,
  SignerTransitionError,
  type SignerScheduleInput,
} from "../signer";

describe("SignerStatus state machine", () => {
  describe("legal transitions", () => {
    it("PENDING → VIEWED is legal", () => {
      expect(canTransitionSigner("PENDING", "VIEWED")).toBe(true);
    });

    it("PENDING → SIGNED is legal (sign directly)", () => {
      expect(canTransitionSigner("PENDING", "SIGNED")).toBe(true);
    });

    it("PENDING → DECLINED is legal (decline directly)", () => {
      expect(canTransitionSigner("PENDING", "DECLINED")).toBe(true);
    });

    it("VIEWED → SIGNED is legal", () => {
      expect(canTransitionSigner("VIEWED", "SIGNED")).toBe(true);
    });

    it("VIEWED → DECLINED is legal", () => {
      expect(canTransitionSigner("VIEWED", "DECLINED")).toBe(true);
    });
  });

  describe("illegal transitions", () => {
    it("SIGNED → PENDING is illegal (terminal state)", () => {
      expect(canTransitionSigner("SIGNED", "PENDING")).toBe(false);
    });

    it("DECLINED → VIEWED is illegal (terminal state)", () => {
      expect(canTransitionSigner("DECLINED", "VIEWED")).toBe(false);
    });

    it("SIGNED → VIEWED is illegal (between terminal states)", () => {
      expect(canTransitionSigner("SIGNED", "VIEWED")).toBe(false);
    });

    it("VIEWED → PENDING is illegal (irreversible)", () => {
      expect(canTransitionSigner("VIEWED", "PENDING")).toBe(false);
    });

    it("self-transition PENDING → PENDING is illegal", () => {
      expect(canTransitionSigner("PENDING", "PENDING")).toBe(false);
    });
  });

  describe("assertSignerTransition", () => {
    it("does not throw for a legal transition", () => {
      expect(() => assertSignerTransition("PENDING", "VIEWED")).not.toThrow();
    });

    it("throws SignerTransitionError for an illegal transition", () => {
      try {
        assertSignerTransition("SIGNED", "PENDING");
        throw new Error("Expected SignerTransitionError to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(SignerTransitionError);
        const err = e as SignerTransitionError;
        expect(err.from).toBe("SIGNED");
        expect(err.to).toBe("PENDING");
      }
    });
  });

  describe("isSignerTerminal", () => {
    it("PENDING is not terminal", () => {
      expect(isSignerTerminal("PENDING")).toBe(false);
    });

    it("VIEWED is not terminal", () => {
      expect(isSignerTerminal("VIEWED")).toBe(false);
    });

    it("SIGNED is terminal", () => {
      expect(isSignerTerminal("SIGNED")).toBe(true);
    });

    it("DECLINED is terminal", () => {
      expect(isSignerTerminal("DECLINED")).toBe(true);
    });
  });

  describe("validSignerTargets", () => {
    it("PENDING can transition to VIEWED / SIGNED / DECLINED", () => {
      expect(validSignerTargets("PENDING").sort()).toEqual([
        "DECLINED",
        "SIGNED",
        "VIEWED",
      ]);
    });

    it("VIEWED can transition to SIGNED / DECLINED", () => {
      expect(validSignerTargets("VIEWED").sort()).toEqual([
        "DECLINED",
        "SIGNED",
      ]);
    });

    it("SIGNED has no legal targets", () => {
      expect(validSignerTargets("SIGNED")).toEqual([]);
    });

    it("DECLINED has no legal targets", () => {
      expect(validSignerTargets("DECLINED")).toEqual([]);
    });
  });
});

// ============================================================
// Sequential / parallel flow scheduling (spec 3.3)
// ============================================================

describe("canSignerAct scheduling", () => {
  const signers: SignerScheduleInput[] = [
    { id: "s1", order: 1, status: "PENDING" },
    { id: "s2", order: 2, status: "PENDING" },
    { id: "s3", order: 3, status: "PENDING" },
  ];

  describe("SEQUENTIAL", () => {
    it("the PENDING signer with order=1 can act", () => {
      expect(canSignerAct("SEQUENTIAL", signers[0]!, signers)).toBe(true);
    });

    it("the PENDING signer with order=2 cannot act before order=1 finishes", () => {
      expect(canSignerAct("SEQUENTIAL", signers[1]!, signers)).toBe(false);
    });

    it("after order=1 is SIGNED, order=2 can act", () => {
      const afterFirst: SignerScheduleInput[] = [
        { id: "s1", order: 1, status: "SIGNED" },
        { id: "s2", order: 2, status: "PENDING" },
        { id: "s3", order: 3, status: "PENDING" },
      ];
      expect(canSignerAct("SEQUENTIAL", afterFirst[1]!, afterFirst)).toBe(true);
    });

    it("after order=1 is SIGNED, order=3 still cannot act", () => {
      const afterFirst: SignerScheduleInput[] = [
        { id: "s1", order: 1, status: "SIGNED" },
        { id: "s2", order: 2, status: "PENDING" },
        { id: "s3", order: 3, status: "PENDING" },
      ];
      expect(canSignerAct("SEQUENTIAL", afterFirst[2]!, afterFirst)).toBe(false);
    });

    it("signers in a terminal state cannot act", () => {
      const terminal: SignerScheduleInput[] = [
        { id: "s1", order: 1, status: "SIGNED" },
        { id: "s2", order: 2, status: "DECLINED" },
      ];
      expect(canSignerAct("SEQUENTIAL", terminal[0]!, terminal)).toBe(false);
      expect(canSignerAct("SEQUENTIAL", terminal[1]!, terminal)).toBe(false);
    });
  });

  describe("PARALLEL", () => {
    it("all non-terminal signers can act simultaneously", () => {
      expect(canSignerAct("PARALLEL", signers[0]!, signers)).toBe(true);
      expect(canSignerAct("PARALLEL", signers[1]!, signers)).toBe(true);
      expect(canSignerAct("PARALLEL", signers[2]!, signers)).toBe(true);
    });

    it("signers in a terminal state cannot act", () => {
      const mixed: SignerScheduleInput[] = [
        { id: "s1", order: 1, status: "SIGNED" },
        { id: "s2", order: 2, status: "PENDING" },
      ];
      expect(canSignerAct("PARALLEL", mixed[0]!, mixed)).toBe(false);
      expect(canSignerAct("PARALLEL", mixed[1]!, mixed)).toBe(true);
    });
  });
});

describe("areAllSignersSigned", () => {
  it("returns false for an empty list", () => {
    expect(areAllSignersSigned([])).toBe(false);
  });

  it("returns false when only some are SIGNED", () => {
    expect(
      areAllSignersSigned([
        { id: "s1", order: 1, status: "SIGNED" },
        { id: "s2", order: 2, status: "PENDING" },
      ]),
    ).toBe(false);
  });

  it("returns true when all are SIGNED", () => {
    expect(
      areAllSignersSigned([
        { id: "s1", order: 1, status: "SIGNED" },
        { id: "s2", order: 2, status: "SIGNED" },
      ]),
    ).toBe(true);
  });
});

describe("hasSignerDeclined", () => {
  it("returns false when nobody DECLINED", () => {
    expect(
      hasSignerDeclined([
        { id: "s1", order: 1, status: "SIGNED" },
        { id: "s2", order: 2, status: "PENDING" },
      ]),
    ).toBe(false);
  });

  it("returns true when someone DECLINED", () => {
    expect(
      hasSignerDeclined([
        { id: "s1", order: 1, status: "SIGNED" },
        { id: "s2", order: 2, status: "DECLINED" },
      ]),
    ).toBe(true);
  });
});

describe("computeSigningStatus", () => {
  it("all SIGNED → COMPLETED", () => {
    const result = computeSigningStatus(
      [
        { id: "s1", order: 1, status: "SIGNED" },
        { id: "s2", order: 2, status: "SIGNED" },
      ],
      "IN_PROGRESS",
    );
    expect(result).toBe("COMPLETED");
  });

  it("any DECLINED → DECLINED", () => {
    const result = computeSigningStatus(
      [
        { id: "s1", order: 1, status: "SIGNED" },
        { id: "s2", order: 2, status: "DECLINED" },
      ],
      "IN_PROGRESS",
    );
    expect(result).toBe("DECLINED");
  });

  it("some PENDING → IN_PROGRESS", () => {
    const result = computeSigningStatus(
      [
        { id: "s1", order: 1, status: "SIGNED" },
        { id: "s2", order: 2, status: "PENDING" },
      ],
      "IN_PROGRESS",
    );
    expect(result).toBe("IN_PROGRESS");
  });

  it("an empty list keeps the current status", () => {
    const result = computeSigningStatus([], "NOT_STARTED");
    expect(result).toBe("NOT_STARTED");
  });
});

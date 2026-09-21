/**
 * ApprovalStatus state machine (spec 3.3).
 *
 * DRAFT → PENDING → APPROVED | REJECTED | WITHDRAWN
 *
 * - Independent from SigningStatus
 * - APPROVED / REJECTED / WITHDRAWN are terminal states
 * - The transition table is defined centrally; illegal transitions throw
 *   ApprovalTransitionError
 * - Unit tests: __tests__/approval.test.ts
 */

export type ApprovalStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN";

/** Legal state-transition table. */
const APPROVAL_TRANSITIONS = [
  ["DRAFT", "PENDING"],
  ["PENDING", "APPROVED"],
  ["PENDING", "REJECTED"],
  ["PENDING", "WITHDRAWN"],
] as const;

/** Terminal state set. */
const APPROVAL_TERMINAL = new Set<ApprovalStatus>([
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
]);

/** Check whether a state transition is legal. */
export function canTransitionApproval(
  from: ApprovalStatus,
  to: ApprovalStatus,
): boolean {
  if (from === to) return false;
  return APPROVAL_TRANSITIONS.some(
    ([f, t]) => f === from && t === to,
  );
}

/** Assert that a state transition is legal; throw otherwise. */
export function assertApprovalTransition(
  from: ApprovalStatus,
  to: ApprovalStatus,
): void {
  if (!canTransitionApproval(from, to)) {
    throw new ApprovalTransitionError(from, to);
  }
}

/** Whether the status is terminal. */
export function isApprovalTerminal(status: ApprovalStatus): boolean {
  return APPROVAL_TERMINAL.has(status);
}

/** List the legal target states for a given status. */
export function validApprovalTargets(from: ApprovalStatus): ApprovalStatus[] {
  return APPROVAL_TRANSITIONS.filter(([f]) => f === from).map(
    ([, t]) => t,
  );
}

/** Error raised on an illegal state transition. */
export class ApprovalTransitionError extends Error {
  readonly from: ApprovalStatus;
  readonly to: ApprovalStatus;

  constructor(from: ApprovalStatus, to: ApprovalStatus) {
    super(`Illegal approval state transition: ${from} → ${to}`);
    this.name = "ApprovalTransitionError";
    this.from = from;
    this.to = to;
  }
}

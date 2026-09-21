/**
 * SigningStatus state machine (spec 3.3).
 *
 * NOT_STARTED → IN_PROGRESS → COMPLETED | DECLINED | EXPIRED | REVOKED
 * Also allowed: NOT_STARTED → EXPIRED, COMPLETED → REVOKED
 *
 * - Independent from ApprovalStatus
 * - DECLINED / EXPIRED / REVOKED are terminal states
 * - COMPLETED can be REVOKED in special circumstances (e.g. legal invalidation)
 * - Company sealing requires ApprovalStatus = APPROVED (enforced by the
 *   business layer, not inside this state machine)
 */

export type SigningStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DECLINED"
  | "EXPIRED"
  | "REVOKED";

/** Legal state-transition table. */
const SIGNING_TRANSITIONS = [
  ["NOT_STARTED", "IN_PROGRESS"],
  ["NOT_STARTED", "EXPIRED"],
  ["IN_PROGRESS", "COMPLETED"],
  ["IN_PROGRESS", "DECLINED"],
  ["IN_PROGRESS", "EXPIRED"],
  ["IN_PROGRESS", "REVOKED"],
  ["COMPLETED", "REVOKED"],
] as const;

/** Terminal state set. */
const SIGNING_TERMINAL = new Set<SigningStatus>([
  "DECLINED",
  "EXPIRED",
  "REVOKED",
]);

/** Check whether a state transition is legal. */
export function canTransitionSigning(
  from: SigningStatus,
  to: SigningStatus,
): boolean {
  if (from === to) return false;
  return SIGNING_TRANSITIONS.some(
    ([f, t]) => f === from && t === to,
  );
}

/** Assert that a state transition is legal; throw otherwise. */
export function assertSigningTransition(
  from: SigningStatus,
  to: SigningStatus,
): void {
  if (!canTransitionSigning(from, to)) {
    throw new SigningTransitionError(from, to);
  }
}

/** Whether the status is terminal. */
export function isSigningTerminal(status: SigningStatus): boolean {
  return SIGNING_TERMINAL.has(status);
}

/** List the legal target states for a given status. */
export function validSigningTargets(from: SigningStatus): SigningStatus[] {
  return SIGNING_TRANSITIONS.filter(([f]) => f === from).map(
    ([, t]) => t,
  );
}

/** Error raised on an illegal state transition. */
export class SigningTransitionError extends Error {
  readonly from: SigningStatus;
  readonly to: SigningStatus;

  constructor(from: SigningStatus, to: SigningStatus) {
    super(`Illegal signing state transition: ${from} → ${to}`);
    this.name = "SigningTransitionError";
    this.from = from;
    this.to = to;
  }
}

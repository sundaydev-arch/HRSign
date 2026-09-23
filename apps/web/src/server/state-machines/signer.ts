/**
 * Signer state machine (spec 3.3).
 *
 * PENDING → VIEWED → SIGNED | DECLINED
 * Also allowed: PENDING → SIGNED, PENDING → DECLINED (acting without viewing)
 *
 * - Sequential flow: a signer can act only when their turn comes
 *   (order == current order)
 * - Parallel flow: all signers may act simultaneously
 * - Terminal states: SIGNED / DECLINED
 */

export type SignerStatus =
  | "PENDING"
  | "VIEWED"
  | "SIGNED"
  | "DECLINED";

/** Legal state-transition table. */
const SIGNER_TRANSITIONS = [
  ["PENDING", "VIEWED"],
  ["PENDING", "SIGNED"],
  ["PENDING", "DECLINED"],
  ["VIEWED", "SIGNED"],
  ["VIEWED", "DECLINED"],
] as const;

/** Terminal state set. */
const SIGNER_TERMINAL = new Set<SignerStatus>(["SIGNED", "DECLINED"]);

/** Check whether a state transition is legal. */
export function canTransitionSigner(
  from: SignerStatus,
  to: SignerStatus,
): boolean {
  if (from === to) return false;
  return SIGNER_TRANSITIONS.some(
    ([f, t]) => f === from && t === to,
  );
}

/** Assert that a state transition is legal; throw otherwise. */
export function assertSignerTransition(
  from: SignerStatus,
  to: SignerStatus,
): void {
  if (!canTransitionSigner(from, to)) {
    throw new SignerTransitionError(from, to);
  }
}

/** Whether the status is terminal. */
export function isSignerTerminal(status: SignerStatus): boolean {
  return SIGNER_TERMINAL.has(status);
}

/** List the legal target states for a given status. */
export function validSignerTargets(from: SignerStatus): SignerStatus[] {
  return SIGNER_TRANSITIONS.filter(([f]) => f === from).map(([, t]) => t);
}

/** Error raised on an illegal state transition. */
export class SignerTransitionError extends Error {
  readonly from: SignerStatus;
  readonly to: SignerStatus;

  constructor(from: SignerStatus, to: SignerStatus) {
    super(`Illegal signer state transition: ${from} → ${to}`);
    this.name = "SignerTransitionError";
    this.from = from;
    this.to = to;
  }
}

// ============================================================
// Sequential / parallel flow scheduling
// ============================================================

export type SigningFlowType = "SEQUENTIAL" | "PARALLEL";

/**
 * Minimal signer shape used for scheduling decisions. Aligned with the Prisma
 * Signer model structure but does not depend on Prisma directly.
 */
export interface SignerScheduleInput {
  id: string;
  order: number;
  status: SignerStatus;
}

/**
 * Determine whether the given signer may act in the current task flow.
 *
 * Sequential: only signers whose order equals the current order and who are
 * not in a terminal state may act.
 * Parallel: every non-terminal signer may act at the same time.
 */
export function canSignerAct(
  flowType: SigningFlowType,
  signer: SignerScheduleInput,
  allSigners: readonly SignerScheduleInput[],
): boolean {
  // Signers already in a terminal state cannot act again.
  if (isSignerTerminal(signer.status)) return false;

  if (flowType === "PARALLEL") {
    return true;
  }

  // SEQUENTIAL: find the smallest active (non-terminal) order.
  const activeOrders = allSigners
    .filter((s) => !isSignerTerminal(s.status))
    .map((s) => s.order);
  const currentOrder = Math.min(...activeOrders);

  return signer.order === currentOrder;
}

/** Whether every signer of the task is SIGNED. */
export function areAllSignersSigned(
  allSigners: readonly SignerScheduleInput[],
): boolean {
  if (allSigners.length === 0) return false;
  return allSigners.every((s) => s.status === "SIGNED");
}

/** Whether any signer DECLINED (blocks further signing). */
export function hasSignerDeclined(
  allSigners: readonly SignerScheduleInput[],
): boolean {
  return allSigners.some((s) => s.status === "DECLINED");
}

/**
 * Compute the target SigningStatus from the current list of signer statuses.
 *
 * - All SIGNED → COMPLETED
 * - Any DECLINED → DECLINED
 * - All terminal but not all SIGNED → DECLINED (defensive)
 * - Otherwise stays IN_PROGRESS (or NOT_STARTED if it has not begun)
 */
export function computeSigningStatus(
  allSigners: readonly SignerScheduleInput[],
  current: import("./signing").SigningStatus,
): import("./signing").SigningStatus {
  if (allSigners.length === 0) return current;
  if (hasSignerDeclined(allSigners)) return "DECLINED";
  if (areAllSignersSigned(allSigners)) return "COMPLETED";
  return "IN_PROGRESS";
}

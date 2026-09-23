---
name: state-machines
description: Use for any transition of approval, signing, or signer status (approve/reject/sign/decline/expire/revoke/sequential-sign round). Status may change only via transition tables; defines transaction boundaries, independence of the two machines, and where company-seal-requires-approval is enforced.
---

# Skill 02: Dual state machines (approval and signing are separate)

## When to use

- Change approve/reject/sign/expire/revoke logic
- Add a task operation (e.g. withdraw, transfer sign)
- Decide whether a given signer can act now

## State space (authoritative definitions in [schema.prisma](../../../prisma/schema.prisma); transition rules in [state-machines/](../../../src/server/state-machines))

- **ApprovalStatus**: DRAFT → PENDING → APPROVED | REJECTED | WITHDRAWN
- **SigningStatus**: NOT_STARTED → IN_PROGRESS → COMPLETED | DECLINED | EXPIRED | REVOKED
- **Signer**: PENDING → VIEWED → SIGNED | DECLINED
- SignerRole: APPROVER (approver) / COMPANY_SEAL (company seal) / PERSONAL_SIGNATURE (personal sign). Deprecated enums COMPANY_SIGNER/REJECTED/WAITING must not reappear.

## Hard rules

1. **Legal transitions live only in the transition tables** (approval.ts / signing.ts / signer.ts). Route handlers must not write bare jumps like `if (status===...) status='...'`; illegal transitions throw from the state machine.
2. **Company seal requires prior approval**: COMPANY_SEAL is allowed only when ApprovalStatus=APPROVED (double-checked in signing.ts and the sign route).
3. An approval pass must complete in **one transaction**: Signer PENDING→SIGNED + write ApprovalRecord (including fromStatus/toStatus/ip/userAgent); only when the last APPROVER passes does the task become APPROVED and SigningStatus NOT_STARTED→IN_PROGRESS. See [approve/route.ts](../../../src/app/api/tasks/[id]/approve/route.ts).
4. Reject: Signer→DECLINED and write declinedReason/declinedAt; task approvalStatus=REJECTED, signingStatus=NOT_STARTED.
5. **Sequential-sign rounds** use `getCurrentSigners()` in [tasks.ts](../../../src/lib/tasks.ts); parallel sign allows all current signers. canSign/canApprove must include "state machine allows + it is this person's turn + task not expired".
6. Expiry always goes through `expireDueTasks()` (currently lazy; if a queue is added later, business routes should not need new eligibility logic).
7. Signing complete: the task is COMPLETED only after every required Signer is SIGNED; write usedAt immediately after a successful external-token POST.
8. Changing a transition table requires adding/updating unit tests (`__tests__/`, currently 91 cases); illegal paths need assertions.

## Standard steps

1. Add transition and predicate functions in the matching state-machine file and add tests first (red → green)
2. Routes only call state-machine functions; do not inline rules
3. Multi-table writes use `prisma.$transaction`
4. `pnpm test` (vitest) and tsc all green

## Do not

- ❌ Directly update status fields in a route for convenience
- ❌ Merge approval and signing into one status field
- ❌ Only grey out frontend buttons without backend checks (frontend is display control only)
- ❌ Delete or skip ApprovalRecord rows

## Done when

- [ ] New transitions have unit tests in the table (at least one legal and one illegal)
- [ ] Multi-table changes are in a transaction; IP/UA/reason fields are written
- [ ] Sequential and parallel sign paths are both verified
- [ ] Frontend canXxx matches backend predicates

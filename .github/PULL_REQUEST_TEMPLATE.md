<!--
Thanks for contributing! Replace the placeholder sections below.
Keep PRs small and focused on one logical change.
See CONTRIBUTING.md for the full checklist.
-->

## Summary

- What does this PR change?
- Why is it needed (link the issue, e.g. Closes #123)?

## Type of change

- [ ] feat (new functionality)
- [ ] fix (bug fix)
- [ ] refactor (no behavior change)
- [ ] docs / test / build / chore
- [ ] Breaking change (explain impact + migration)

## Implementation notes

- Key files/modules touched:
- Schema or API changes? If yes, describe shape + migration:
- New dependencies? Justification, size/risk, alternatives: **none / ...**

## How it was tested

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (new tests added where required)
- [ ] `pnpm build` passes
- [ ] Manual verification steps:
  1.
  2.
- [ ] `node scripts/check-i18n-keys.mjs` passes (if `messages/` changed; both `zh-CN` and `en` updated)
- [ ] `node scripts/e2e-smoke.mjs` run (for API/flow changes)

## Screenshots (UI changes)

| Before | After |
| --- | --- |
| | |

## Checklist

- [ ] No `any`; zod validates all new boundaries/Json columns
- [ ] PDF modifications are server-side only; new file versions are non-overwriting with SHA-256
- [ ] Backend authorization and state-machine rules enforced (not UI-only)
- [ ] No hard-coded user-facing strings; ICU used for variables/plurals
- [ ] Backend errors return codes, not localized text; audit logs store action codes
- [ ] English comments for new/modified code
- [ ] No unrelated reformatting; no changes to `.env` / pinned config without approval

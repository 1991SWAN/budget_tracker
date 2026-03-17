# Auth Session Stability

- Slug: `auth-session-stability`
- Status: `Completed`
- Created: `2026-03-17`
- Last updated: `2026-03-17`

## Current Summary

- Project initialized after app-state flow cleanup as the next sequential effort.
- The main risk was `AuthContext` calling `localStorage.clear()` during logout, which could wipe unrelated origin storage.
- The project replaced that with scoped SmartPenny storage cleanup and centralized auth/session storage constants.

## Decisions

- Keep the cleanup bounded to SmartPenny-prefixed keys instead of trying to infer and delete every possible third-party storage entry on the origin.
- Share logout/session constants between `AuthContext` and `useLoginController` to keep the concurrent-login message path aligned.
- Reuse `dbClient` directly in auth code instead of the compatibility aggregator.

## Progress Log

- `2026-03-17`: Project memory initialized.
- `2026-03-17`: Confirmed the logout path still used `localStorage.clear()` and identified it as the smallest high-value auth stability fix.
- `2026-03-17`: Added `utils/authStorage.ts` with scoped storage cleanup and shared auth/session constants.
- `2026-03-17`: Updated `AuthContext` and `useLoginController` to use the new utility/constants and re-ran verification successfully.

## Changed Files

- `docs/projects/auth-session-stability/plan.md`
- `docs/projects/auth-session-stability/context-notes.md`
- `docs/projects/auth-session-stability/checklist.md`
- `contexts/AuthContext.tsx`
- `hooks/useLoginController.ts`
- `utils/authStorage.ts`
- `tests/authStorage.test.ts`

## Blockers

- None.

## Next Step

- Project complete. Continue the sequential backlog with the next project or a newly chosen feature project.

## Handoff Notes

- Final verification for this project: targeted auth storage tests passed, `npm test` passed (`10 files / 52 tests`), and `npm run build` passed on `2026-03-17`.
- `localStorage.clear()` is no longer used in the logout path; SmartPenny-prefixed keys are removed explicitly instead.

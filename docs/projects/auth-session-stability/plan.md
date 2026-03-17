# Auth Session Stability

- Slug: `auth-session-stability`
- Status: `Completed`
- Created: `2026-03-17`
- Last updated: `2026-03-17`

## Goal

- Prevent logout from wiping unrelated browser storage while keeping SmartPenny session cleanup explicit and testable.

## Scope

- Replace `localStorage.clear()` in the auth flow with scoped SmartPenny storage cleanup.
- Centralize auth/session storage constants used by auth logout and login messaging.
- Add targeted tests for the new storage cleanup utility.

## Non-goals

- Reworking concurrent-session semantics or realtime session takeover logic.
- Adding full AuthContext integration tests in this bounded pass.
- Inferring or force-clearing every possible third-party auth storage key on the origin.

## Deliverables

- Project memory for auth session stability work.
- Scoped auth storage cleanup utility and auth constant definitions.
- Updated auth/login code paths and passing utility tests.

## Implementation Plan

- Phase 1: Extract auth/session storage constants and a scoped cleanup helper.
- Phase 2: Apply the helper in `AuthContext` and shared constants in `useLoginController`.
- Phase 3: Add targeted tests and verify the full suite/build.

## Validation Plan

- Run targeted tests for the new auth storage utility.
- Run `npm test` and `npm run build` after the auth cleanup lands.
- Confirm the logout path no longer calls `localStorage.clear()`.

## Risks / Open Questions

- This bounded project intentionally cleans only SmartPenny-prefixed storage keys; any Supabase auth-token fallback cleanup beyond `supabase.auth.signOut()` can be handled in a future follow-up if needed.

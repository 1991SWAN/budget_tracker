# Data Layer Separation

- Slug: `data-layer-separation`
- Status: `Completed`
- Created: `2026-03-17`
- Last updated: `2026-03-17`

## Goal

- Reduce hook-level coupling to the omnibus `SupabaseService` object by switching hooks to direct domain-service imports while preserving behavior and current service APIs.

## Scope

- Replace `SupabaseService` usage in hooks with direct imports from the relevant domain service modules.
- Keep `supabase` client access on explicit low-level paths by importing it from `dbClient` instead of the aggregator.
- Update affected tests and mocks so the new service boundaries remain covered.
- Leave `services/supabaseService.ts` available as a compatibility layer unless this project fully eliminates hook usage.

## Non-goals

- Rewriting the service modules themselves into new repository abstractions.
- Changing data behavior, query semantics, or transaction/category/business rules.
- Refactoring auth/session flows beyond import-path cleanup.

## Deliverables

- Project memory for the data-layer separation effort.
- Hook modules that depend on their domain services directly instead of the aggregated `SupabaseService`.
- Updated tests covering the new import boundaries.
- Passing test and build verification after the refactor.

## Implementation Plan

- Phase 1: Map current hook dependencies from `SupabaseService` to direct domain services and identify test impact.
- Phase 2: Replace hook imports and calls with the matching service modules or `dbClient`.
- Phase 3: Update test mocks and verification so the new boundaries are stable.

## Validation Plan

- Run `npm test` after the import-boundary changes and any test updates.
- Run `npm run build` after the refactor is complete.
- Re-scan the hooks directory to confirm the targeted `SupabaseService` imports are gone.

## Risks / Open Questions

- `useAppController` tests currently mock the aggregator path, so test failures may require broader mock-path updates than the hook diffs alone suggest.
- Some hooks still use low-level `supabase` auth subscriptions; those should move to `dbClient` imports without changing behavior.
- `services/supabaseService.ts` remains as a compatibility layer for non-hook callers; removing it entirely is a separate cleanup task.

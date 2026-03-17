# Data Layer Separation

- Slug: `data-layer-separation`
- Status: `Completed`
- Created: `2026-03-17`
- Last updated: `2026-03-17`

## Current Summary

- Project initialized from the sequential backlog after completing import/reconciliation stabilization.
- Existing service files are already domain-sliced; the main remaining coupling point is hook-level reliance on the aggregated `SupabaseService` object.
- Hook-level `SupabaseService` imports were replaced with direct domain-service or `dbClient` imports.
- A hooks-directory scan now returns zero `SupabaseService` references, and tests/build both pass after the boundary update.
- The aggregator remains in place as a compatibility layer for non-hook callers.

## Decisions

- Treat this as an import-boundary refactor, not a rewrite of service internals.
- Prefer direct service-module imports from hooks over routing everything through `services/index.ts` to keep dependencies explicit.
- Keep `services/supabaseService.ts` in place unless removing it becomes trivial after hook migration.

## Progress Log

- `2026-03-17`: Project memory initialized.
- `2026-03-17`: Checked related project memory and confirmed the completed import/reconciliation project points directly to this next step.
- `2026-03-17`: Mapped current hook dependency hotspots and confirmed `services/` is already split by domain; the refactor target is hook usage of the aggregator.
- `2026-03-17`: Replaced hook-level `SupabaseService` imports with direct domain-service imports across app, planning, asset, settings, lab, reconciliation, and support hooks.
- `2026-03-17`: Updated hook tests to mock domain services instead of the aggregator and re-ran verification successfully.

## Changed Files

- `docs/projects/data-layer-separation/plan.md`
- `docs/projects/data-layer-separation/context-notes.md`
- `docs/projects/data-layer-separation/checklist.md`
- `hooks/useAppController.ts`
- `hooks/useAppData.ts`
- `hooks/useAssetController.ts`
- `hooks/useAssetInstallments.ts`
- `hooks/useBudgetManager.ts`
- `hooks/useCategoryManager.ts`
- `hooks/useImportSettingsController.ts`
- `hooks/useLabController.ts`
- `hooks/useLoginController.ts`
- `hooks/useModalSubmitHandler.ts`
- `hooks/usePlanningController.ts`
- `hooks/useRegularExpenseDetector.ts`
- `hooks/useSettingsController.ts`
- `hooks/useSmartInputAI.ts`
- `hooks/useTransactionController.ts`
- `hooks/useTransactionManager.ts`
- `hooks/useTransferReconciler.ts`
- `tests/useAppController.test.tsx`
- `tests/useTransactionManager.test.tsx`

## Blockers

- None.

## Next Step

- Project complete. Continue the sequential backlog with the next project: test expansion.

## Handoff Notes

- Final verification for this project: `npm test` (`6 files / 36 tests`), `npm run build`, and a hooks-directory scan for `SupabaseService` references all passed on `2026-03-17`.
- `services/supabaseService.ts` intentionally remains as a compatibility facade; this project only removed hook-level dependence on it.
- The next backlog project should focus on deeper test coverage rather than more import-boundary churn.

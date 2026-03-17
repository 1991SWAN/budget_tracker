# Import Reconciliation Stabilization

- Slug: `import-reconciliation-stabilization`
- Status: `Completed`
- Created: `2026-03-17`
- Last updated: `2026-03-17`

## Current Summary

- Project started from the sequential refactor backlog as the highest-priority remaining effort.
- The first bounded stabilization step is complete: DB reconciliation candidates now use a typed camelCase shape from service to hook to import matching logic.
- The second bounded stabilization step is also complete: needs-review matching and scoring now live in a dedicated typed helper module while `ImportService` keeps the same public API.
- The third bounded stabilization step is complete: raw import grid types now cover validation/mapping paths and the import wizard reconciliation hook.
- The fourth bounded stabilization step is complete: regression tests now cover formatted spreadsheet parsing and realistic import row generation flows.
- Tests and build both pass after the final regression pass.

## Decisions

- Treat this as a multi-turn project tracked under `docs/projects/import-reconciliation-stabilization/`.
- Keep behavioral changes out of scope unless a failing test or clear bug forces one.
- Start with typed candidate flow because it is small enough to finish in one turn and reduces future refactor risk.

## Progress Log

- `2026-03-17`: Project memory initialized.
- `2026-03-17`: Confirmed there was no existing `docs/projects/` root and created a new project memory folder for this work.
- `2026-03-17`: Typed import reconciliation candidates across `TransactionService`, `useImportWizardReconciliation`, and `ImportService`.
- `2026-03-17`: Updated import review tests to use the typed candidate shape and re-ran verification successfully.
- `2026-03-17`: Extracted needs-review memo normalization, candidate scoring, and replacement-target selection into `utils/importNeedsReview.ts`.
- `2026-03-17`: Kept `ImportService` API stable by delegating matching helpers to the extracted module and re-ran verification successfully.
- `2026-03-17`: Introduced `ImportCell` / `ImportGridRow` / `ImportGrid` / `InvalidImportRow` typing in `ImportService`.
- `2026-03-17`: Applied the new raw-grid types to `validateRow`, `mapRawDataToImportRows`, `mapRawDataToTransactions`, `resolveAssetId`, `ImportWizardModal`, and `useImportWizardReconciliation`, then re-ran verification successfully.
- `2026-03-17`: Added regression coverage for formatted `xlsx` parsing and sample import-grid row generation, then re-ran verification successfully.

## Changed Files

- `docs/projects/import-reconciliation-stabilization/plan.md`
- `docs/projects/import-reconciliation-stabilization/context-notes.md`
- `docs/projects/import-reconciliation-stabilization/checklist.md`
- `types.ts`
- `services/transactionService.ts`
- `hooks/useImportWizardReconciliation.ts`
- `services/importService.ts`
- `utils/importNeedsReview.ts`
- `components/import/ImportWizardModal.tsx`
- `hooks/useImportWizardReconciliation.ts`
- `tests/importService.test.ts`

## Blockers

- None.

## Next Step

- Project complete. Continue the sequential backlog with the next project: data layer separation.

## Handoff Notes

- Final verification for this project: `npm test` (`6 files / 36 tests`) and `npm run build` both passed on `2026-03-17`.
- This project now covers the typed reconciliation candidate flow, extracted review matching, typed raw-grid mapping, and targeted parsing/mapping regressions.
- The next backlog project should focus on splitting the omnibus data layer into smaller service boundaries.

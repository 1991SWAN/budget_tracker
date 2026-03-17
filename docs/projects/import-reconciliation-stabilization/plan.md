# Import Reconciliation Stabilization

- Slug: `import-reconciliation-stabilization`
- Status: `Completed`
- Created: `2026-03-17`
- Last updated: `2026-03-17`

## Goal

- Make the import and reconciliation flow easier to change safely by reducing `any` usage, separating matching logic from UI wiring, and locking the current rules behind tests.

## Scope

- Tighten types across DB reconciliation candidates, import review candidates, and import wizard data flow.
- Reduce import/reconciliation-specific logic that currently lives in large service and component files.
- Preserve current review, duplicate, and replacement-selection behavior while refactoring internals.
- Add or update tests for the import review and reconciliation rules touched during the project.

## Non-goals

- Replacing the overall import UX or redesigning the wizard.
- Changing the reconciliation rules unless a bug is discovered and intentionally fixed.
- Refactoring unrelated app state, auth, or dashboard flows.

## Deliverables

- Project memory for ongoing import/reconciliation stabilization work.
- Strongly typed reconciliation candidate flow from DB service through import review matching.
- Follow-up extraction of remaining import matching/parsing hot paths into smaller typed units.
- Passing test and build verification after each bounded change.

## Implementation Plan

- Phase 1: Type the reconciliation candidate flow between `TransactionService`, `useImportWizardReconciliation`, and `ImportService`.
- Phase 2: Extract or isolate needs-review matching logic from the large `ImportService` body.
- Phase 3: Reduce raw `any` usage in import row validation and mapping paths.
- Phase 4: Expand regression tests around import matching edge cases and sample file handling.

## Validation Plan

- Run `npm test` after each bounded refactor affecting import/reconciliation logic.
- Run `npm run build` after service or UI wiring changes.
- Keep existing needs-review tests passing and add targeted tests when the matching internals move.

## Risks / Open Questions

- `ImportService` still combines parsing, validation, dedupe, and review matching in one file, so changes can have wide blast radius.
- There is still no full import wizard end-to-end harness; this project stops at typed service boundaries and targeted regression coverage.

# PDF Statement Import

- Slug: `pdf-statement-import`
- Status: `Completed`
- Created: `2026-03-19`
- Last updated: `2026-03-19`

## Goal

- Add text-based PDF statement support to the import wizard by converting PDF text into an `ImportGrid` that can flow through the existing mapping and review steps.

## Scope

- Support text-based PDFs in the current import upload flow.
- Extract text items from PDF pages and group them into rows/columns suitable for the existing import wizard.
- Reuse the current mapping, preview, reconciliation, and import row generation pipeline after grid extraction.
- Add focused regression tests for the new PDF parsing path.

## Non-goals

- OCR support for scanned/image-only PDFs.
- A brand-new PDF import UX outside the existing wizard.
- Bank-specific statement templates or per-institution parsers in this pass.
- Reworking the broader import reconciliation rules unless a bug is uncovered during integration.

## Deliverables

- Project memory for the PDF statement import effort.
- A PDF parsing path in `ImportService.parseFileToGrid`.
- Upload UI updates that accept PDF files.
- Tests covering text-based PDF grid extraction behavior and non-regression for existing import file types.

## Implementation Plan

- Phase 1: Confirm project scope, constraints, and current import architecture.
- Phase 2: Add a PDF text extraction path that converts page text coordinates into `ImportGrid` rows.
- Phase 3: Wire PDF uploads into the existing import wizard and preserve CSV/XLS/XLSX behavior.
- Phase 4: Add targeted tests and run build/test verification.

## Validation Plan

- Run targeted tests for the PDF parsing path and existing import service behavior.
- Run `npm run build` after wiring the UI and service changes.
- Manually verify that existing CSV/XLS/XLSX imports still pass through the same parse path unchanged.

## Risks / Open Questions

- Text-based PDF statements vary widely in layout, so generic row/column grouping may work well for some providers and poorly for others.
- Browser-side PDF parsing adds a new dependency and worker/runtime considerations.
- Multi-line or visually merged cells in PDFs may require conservative heuristics to avoid producing misleading grids.
- Real bank/provider PDFs should be spot-checked to decide whether a future provider-specific normalization pass is needed.

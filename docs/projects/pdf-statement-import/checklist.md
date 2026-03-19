# PDF Statement Import

- Slug: `pdf-statement-import`
- Status: `Completed`
- Last updated: `2026-03-19`

## Deferred

- [ ] Validate the parser against additional provider PDFs and capture any provider-specific cleanup rules.
- [ ] Add OCR support if scanned/image-only PDF statements become in scope.

## In Progress

- [ ] None.

## Done

- [x] Confirm the current import path only supports CSV/XLS/XLSX.
- [x] Compare the request against existing `docs/projects/` entries and decide this is a new follow-up project.
- [x] Set up project memory and lock the first-pass scope to text-based PDFs only.
- [x] Add a PDF parsing dependency suitable for browser-side text extraction.
- [x] Implement a PDF-to-`ImportGrid` conversion path in `ImportService`.
- [x] Update import upload controls to accept PDF files.
- [x] Add regression tests for PDF parsing and existing import behavior.
- [x] Run targeted tests and `npm run build`.
- [x] Validate the parser against the bundled Woori Card sample PDF and tune row/continuation heuristics from that sample.
- [x] Remove PDF statement preamble noise and synthesize a transaction-table header row that aligns with data columns.
- [x] Auto-apply suggested column mappings after PDF parsing.
- [x] Allow merchant-only mappings to complete the import flow when no separate details column exists.
- [x] Configure the bundled PDF worker so real browser uploads do not fail with `GlobalWorkerOptions.workerSrc` errors.
- [x] Revalidate the real Woori Card sample in the browser flow and restore statement columns that were being collapsed during row merging.
- [x] Refine projected PDF header labels so statement-style columns map to `이용금액 / 기간 / 회차 / 청구금액 / 수수료 / 이용 혜택 / 혜택 금액 / 납부하실 금액 / 결제 후 잔액`.

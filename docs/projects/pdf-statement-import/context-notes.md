# PDF Statement Import

- Slug: `pdf-statement-import`
- Status: `Completed`
- Created: `2026-03-19`
- Last updated: `2026-03-19`

## Current Summary

- The current import wizard only accepts `.csv`, `.xls`, and `.xlsx` files.
- `ImportService.parseFileToGrid` parses CSV/TXT/TSV and Excel workbooks, but has no PDF branch.
- This project adds text-based PDF support while keeping the existing import wizard flow intact.
- The import wizard now accepts `.pdf`, extracts text-based PDF content with `pdfjs-dist`, and converts it into the same `ImportGrid` flow used by CSV/XLS/XLSX imports.
- The PDF path now strips statement preamble rows, synthesizes a transaction-table header row, preserves statement-style numeric columns such as period/installment/charged amount, and keeps the Woori Card sample aligned for automatic date/merchant/amount mapping.

## Decisions

- Use the repo-local `maintain-project-memory` workflow for this effort.
- Treat this as a new follow-up project rather than reopening `import-reconciliation-stabilization`.
- Limit the first pass to text-based PDFs; scanned/image-only PDFs remain out of scope.
- Keep the existing mapping/review/import pipeline and only add a new file-to-grid conversion path.

## Progress Log

- 2026-03-19: Verified current import flow only accepts CSV/XLS/XLSX and confirmed there is no PDF parser in the import path.
- 2026-03-19: Reviewed `skills/maintain-project-memory/SKILL.md` and created project memory docs manually because the referenced helper scripts are not present in this repo.
- 2026-03-19: Identified `import-reconciliation-stabilization` as the closest prior project; this work is a distinct follow-up feature in the same import area.
- 2026-03-19: Installed `pdfjs-dist` and added a PDF branch in `ImportService.parseFileToGrid` that extracts page text and converts it into grid rows/columns.
- 2026-03-19: Added `utils/pdfImportGrid.ts` to group positioned PDF text into rows/columns and wired `.pdf` into all import upload inputs.
- 2026-03-19: Added targeted tests for PDF grid extraction and PDF import service behavior; `npm test -- tests/pdfImportGrid.test.ts tests/importPdfService.test.ts tests/importService.test.ts` and `npm run build` passed.
- 2026-03-19: Validated against a real sample at `storage/pdf_test/우리카드 이용대금 명세서.pdf` and improved the parser to split tightly spaced date/merchant cells and merge merchant continuation rows back into the preceding transaction row.
- 2026-03-19: Tightened the PDF normalization step so it extracts the likely transaction table, projects a synthetic header onto actual data columns, and removes statement preamble/repeated section noise. Re-ran targeted tests and build successfully.
- 2026-03-19: Wired auto-mapping into `ImportWizardModal` using suggested column analyses, added merchant-only import support so statement PDFs without a separate details column can still proceed, and covered the new behavior with import service tests.
- 2026-03-19: Fixed browser runtime initialization for `pdfjs-dist` by setting `GlobalWorkerOptions.workerSrc` to the bundled worker asset, after the import wizard surfaced `No "GlobalWorkerOptions.workerSrc" specified.` for real PDF uploads.
- 2026-03-19: Revalidated the bundled Woori Card sample after a real browser upload, restored missing statement columns by tightening numeric-cell splitting, and refined projected header labels to `이용금액 / 기간 / 회차 / 청구금액 / 수수료 / 이용 혜택 / 혜택 금액 / 납부하실 금액 / 결제 후 잔액`.

## Final Outcome

- The import wizard now accepts text-based PDF statements in the same flow as CSV/XLS/XLSX uploads.
- Real browser uploads work without the PDF worker initialization error.
- The bundled Woori Card sample now reaches the mapping step with a structured grid that includes installment and statement amount columns instead of collapsing them into the merchant cell.
- Mapping stays lightweight by showing only a 20-row sample even though the parsed grid retains the full PDF table for downstream steps.

## Validation

- `npm test -- tests/importService.test.ts tests/importPdfService.test.ts tests/pdfImportGrid.test.ts`
- `npm run build`

## Changed Files

- `docs/projects/pdf-statement-import/plan.md`
- `docs/projects/pdf-statement-import/context-notes.md`
- `docs/projects/pdf-statement-import/checklist.md`
- `package.json`
- `package-lock.json`
- `services/importService.ts`
- `utils/pdfImportGrid.ts`
- `components/import/ImportWizardModal.tsx`
- `components/settings/ImportSettings.tsx`
- `components/ui/ExpandableFAB.tsx`
- `tests/pdfImportGrid.test.ts`
- `tests/importPdfService.test.ts`
- `tests/importService.test.ts`
- `components/import/MappingCanvas.tsx`

## Blockers

- The skill's helper scripts (`scripts/find_related_projects.py`, `scripts/init_project_memory.py`) are referenced in the doc but do not exist in this repo.

## Follow-up Items

- Validate additional provider PDFs and add provider-specific cleanup rules only if new layouts expose gaps.
- Add a separate OCR path if scanned/image-only PDFs become a real requirement.

## Handoff Notes

- Closest related prior project: `docs/projects/import-reconciliation-stabilization/`.
- The branch for this work is `codex-pdf-import-text`.
- Current implementation only targets text-based PDFs. Scanned/image-only PDFs still need a separate OCR path if that becomes a requirement.

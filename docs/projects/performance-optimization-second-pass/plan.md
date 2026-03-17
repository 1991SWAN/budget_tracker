# Performance Optimization Second Pass

- Slug: `performance-optimization-second-pass`
- Status: `Completed`
- Created: `2026-03-17`
- Last updated: `2026-03-17`

## Goal

- Reduce client-side chunk fanout from the current lazy-loaded build by grouping tiny shared vendor fragments into more coherent bundles.

## Scope

- Tune `vite.config.ts` manual chunking for the current bundle profile.
- Target the many tiny `lucide-react`-derived chunks first because they increase request count without meaningful independent caching value.
- Verify the result with a production build and compare the emitted chunk layout.

## Non-goals

- Rewriting application code paths for deep runtime performance changes.
- Reworking chart, spreadsheet, or AI feature architecture in this pass.
- Introducing new build plugins or analyzer dependencies.

## Deliverables

- Project memory for the second performance pass.
- Updated `vite` chunk strategy tuned for the current build output.
- Verification notes capturing the before/after chunk profile.

## Implementation Plan

- Phase 1: Confirm the current chunk profile and identify low-value tiny shared chunks.
- Phase 2: Adjust `manualChunks` to group those modules more coherently.
- Phase 3: Rebuild, compare output, and record the result.

## Validation Plan

- Run `npm run build` after the chunking change.
- Compare emitted chunk names and sizes, focusing on the disappearance of the tiny icon chunks.
- Keep `npm test` and `npm run build` green for the bounded config-only change.

## Risks / Open Questions

- Over-grouping vendor code can trade request count for larger first-load parse cost, so this pass should stay narrow and evidence-driven.

# Test Expansion

- Slug: `test-expansion`
- Status: `Completed`
- Created: `2026-03-17`
- Last updated: `2026-03-17`

## Goal

- Expand automated coverage around controller hooks that now sit on top of the separated service boundaries, so future refactors can change those hooks safely.

## Scope

- Add focused tests for planning, asset, and settings controller hooks.
- Cover mutation and state-update paths that rely on the newly direct domain-service imports.
- Keep the tests at hook/controller level rather than adding full UI integration flows.

## Non-goals

- Reworking controller logic or changing product behavior unless a test exposes a real bug.
- Adding Supabase integration tests or end-to-end browser tests.
- Expanding coverage across every hook in one pass.

## Deliverables

- Project memory for the test expansion effort.
- New controller-hook test files covering planning, asset, and settings behavior.
- Passing test and build verification after the new coverage lands.

## Implementation Plan

- Phase 1: Identify the highest-value controller hooks with little or no direct coverage.
- Phase 2: Add focused tests for their service calls and state updates.
- Phase 3: Re-run the full test suite and build, then close the project with handoff notes.

## Validation Plan

- Run targeted tests while building out the new files.
- Run `npm test` and `npm run build` after the new coverage is in place.
- Verify the new tests exercise the direct domain-service imports introduced by the previous project.

## Risks / Open Questions

- Some controller paths use state updater callbacks instead of direct values, so tests need helper assertions rather than shallow equality checks.
- `window.location.reload()` in settings reset flows remains untested in this project; export behavior was prioritized to keep the test surface stable.

# App State Flow Cleanup

- Slug: `app-state-flow-cleanup`
- Status: `Completed`
- Created: `2026-03-17`
- Last updated: `2026-03-17`

## Goal

- Remove the remaining ad-hoc global asset-form event flow and replace it with an explicit app-state path from shell actions to the assets screen.

## Scope

- Replace `window.dispatchEvent(new CustomEvent('open-asset-form'))` with a controller-managed request signal.
- Update the assets screen path so asset creation requests are driven by props instead of a window event listener.
- Add or update tests that lock the new explicit flow in place.

## Non-goals

- Rewriting navigation/history management across the whole app.
- Refactoring unrelated DOM event listeners such as click-outside handlers.
- Redesigning the asset screen UX.

## Deliverables

- Project memory for the app-state flow cleanup effort.
- Code changes removing the global `open-asset-form` event bus.
- Tests covering the explicit asset-form request flow.

## Implementation Plan

- Phase 1: Replace the shell action with a controller state signal and pass it down to the assets screen.
- Phase 2: Remove the `AssetManager` window event listener and react to the explicit request prop instead.
- Phase 3: Add regression coverage and verify the event string no longer appears in runtime code paths.

## Validation Plan

- Run targeted tests for the updated app-controller flow.
- Run `npm test` and `npm run build` after the refactor.
- Re-scan the codebase for `open-asset-form` and custom dispatch usage in the affected flow.

## Risks / Open Questions

- The asset form can be opened from mobile FAB while another assets modal is open, so the request handling must reset local asset-form state cleanly.
- The cleanup is intentionally narrow; other window/document listeners remain and should not be conflated with this project.

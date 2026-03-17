# App State Flow Cleanup

- Slug: `app-state-flow-cleanup`
- Status: `Completed`
- Created: `2026-03-17`
- Last updated: `2026-03-17`

## Current Summary

- Project initialized from the sequential backlog after test expansion.
- The main remaining app-state smell is the global `open-asset-form` custom event used to bridge the shell FAB and the asset screen.
- The project replaced that event bus with an explicit controller-to-screen request signal carried through the assets screen props.
- Code scans no longer show `open-asset-form`, `CustomEvent`, or `dispatchEvent` in the affected runtime path, and tests/build pass after the cleanup.

## Decisions

- Keep the cleanup focused on asset creation flow only.
- Prefer a monotonic request key passed through screen props over introducing another global context or store.
- Add regression coverage in `useAppController` rather than broad UI rendering tests.

## Progress Log

- `2026-03-17`: Project memory initialized.
- `2026-03-17`: Checked related project memory and confirmed this is the next sequential project after test expansion.
- `2026-03-17`: Re-scanned the codebase and confirmed the remaining ad-hoc state bridge is `open-asset-form` between `useAppController`, `AppShell`, and `AssetManager`.
- `2026-03-17`: Replaced the asset-form custom event with an explicit `createRequestKey` flow from `useAppController` into the assets screen and `AssetManager`.
- `2026-03-17`: Added regression coverage in `useAppController` for asset-form requests and re-ran verification successfully.

## Changed Files

- `docs/projects/app-state-flow-cleanup/plan.md`
- `docs/projects/app-state-flow-cleanup/context-notes.md`
- `docs/projects/app-state-flow-cleanup/checklist.md`
- `hooks/useAppController.ts`
- `components/screens/AssetsScreen.tsx`
- `components/AssetManager.tsx`
- `tests/useAppController.test.tsx`

## Blockers

- None.

## Next Step

- Project complete. Continue the sequential backlog with the next project or a newly chosen feature project.

## Handoff Notes

- The likely verification point is `useAppController`: `shell.onAddAsset` should move to the assets view and increment an explicit request signal instead of touching `window.dispatchEvent`.
- Final verification for this project: `npm test` (`9 files / 49 tests`), `npm run build`, and a code scan for the removed asset-form event path all passed on `2026-03-17`.

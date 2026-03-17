# Project Memory Rules

## Purpose

Use `docs/projects/<project-slug>/` as the single durable memory location for a scoped effort that may continue across multiple threads or sessions.

## Relationship Check Before Creation

Before creating `docs/projects/<project-slug>/`, check whether the new request already belongs to an existing project.

Use this order:

1. Scan the existing folders under `docs/projects/`.
2. Run `scripts/find_related_projects.py "<request summary>"` when the request is not obviously new.
3. Compare the request against:
   - project title
   - slug
   - goal
   - current summary
   - next step
   - changed files
4. Reuse the existing folder when the work is a continuation, refinement, or sub-step of the same effort.
5. If the closest match is `Completed`, decide whether the work is:
   - unfinished follow-up on the same effort, which can reopen the old project
   - a distinct new effort that should get its own folder and mention the earlier project in `context-notes.md`
6. Create a new folder only when no candidate is meaningfully related.

Signs that a request is related:

- same feature or bug
- same user-facing outcome
- overlapping implementation files
- same blocker or validation issue
- same next step, just phrased differently

If more than one candidate looks plausible, stop short of creating a new folder and resolve the ambiguity first.

## Standard Files

### `plan.md`

Use for intent and execution strategy.

Include:

- Title
- Slug
- Status
- Created
- Last updated
- Goal
- Scope
- Non-goals
- Deliverables
- Implementation plan
- Validation plan
- Risks or open questions

Update when:

- scope changes
- sequence changes
- validation strategy changes
- the project is closed and needs a short outcome note

### `context-notes.md`

Use for durable state and handoff notes.

Include:

- Title
- Slug
- Status
- Created
- Last updated
- Current summary
- Decisions
- Progress log
- Changed files
- Blockers
- Next step
- Handoff notes

Update when:

- a meaningful decision is made
- implementation reaches a milestone
- a blocker appears or is removed
- file-level progress matters for later resumption
- the next restart point changes

### `checklist.md`

Use for execution tracking.

Include:

- Title
- Slug
- Status
- Last updated
- `## Todo`
- `## In Progress`
- `## Done`
- optional `## Deferred` when needed

Update when:

- a task starts
- a task completes
- a task is split
- new work is discovered
- an item is deferred or dropped

## Status Values

Use one of:

- `Planned`
- `In Progress`
- `Blocked`
- `Completed`
- `Deferred`

Keep the same status vocabulary across all three files.

## Update Rules

- Prefer small edits over full rewrites.
- Reflect real state, not optimistic state.
- If nothing meaningful changed, do not churn the docs.
- When editing one file because of a real status transition, check whether the other two also need a small synchronized update.
- `Next step` should always name the next concrete action, not a vague intention.
- When a request may belong to an existing project, resolve that relationship before creating new docs.

## Completion Rules

When the project finishes:

- keep the folder in place
- set status to `Completed`
- add a final outcome note to `context-notes.md`
- make sure `checklist.md` no longer leaves ambiguous unchecked items
- note any follow-up work as separate future work, not hidden leftovers
- if a future follow-up project is created, mention the completed project path in the new `context-notes.md`

## Template Shape

Suggested `plan.md` shape:

```md
# <Project Title>

- Slug: `<project-slug>`
- Status: `Planned`
- Created: `YYYY-MM-DD`
- Last updated: `YYYY-MM-DD`

## Goal

## Scope

## Non-goals

## Deliverables

## Implementation Plan

## Validation Plan

## Risks / Open Questions
```

Suggested `context-notes.md` shape:

```md
# <Project Title>

- Slug: `<project-slug>`
- Status: `In Progress`
- Created: `YYYY-MM-DD`
- Last updated: `YYYY-MM-DD`

## Current Summary

## Decisions

## Progress Log

## Changed Files

## Blockers

## Next Step

## Handoff Notes
```

Suggested `checklist.md` shape:

```md
# <Project Title>

- Slug: `<project-slug>`
- Status: `Planned`
- Last updated: `YYYY-MM-DD`

## Todo

- [ ] Item

## In Progress

- [ ] Item

## Done

- [x] Item
```

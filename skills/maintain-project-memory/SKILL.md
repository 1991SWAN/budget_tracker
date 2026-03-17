---
name: maintain-project-memory
description: Create and maintain per-project working memory under `docs/projects/<project-slug>/` so work can continue cleanly across threads and sessions. Use when starting a scoped project, resuming one, restructuring a feature into phases, or updating plan/context/checklist documents during implementation, refactors, bug fixes, or handoffs.
---

# Maintain Project Memory

## Overview

Create a stable memory folder for each small project and keep three files current: `plan.md`, `context-notes.md`, and `checklist.md`. Before creating a new folder, check whether the request should resume or extend an existing project.

## Workflow

### Check for a related project first

1. Inspect `docs/projects/` before creating anything new.
2. Run `scripts/find_related_projects.py "<request summary>"` to surface likely matches.
3. Compare the request against existing project titles, slugs, goals, summaries, next steps, and changed-file notes.
4. If the request is the same effort or a direct continuation, reuse that project folder.
5. If the request is follow-up work on a completed project, either reopen it or create a new follow-up project and link it in the notes.
6. Create a new project only when no existing project is a good match.

### Start a project

1. Run the related-project check first.
2. Pick a short project slug only after deciding that this is a new project.
3. Run `scripts/init_project_memory.py "<project name>"` unless the folder already exists.
4. Fill in the initial plan, context, and checklist using the templates the script created.
5. Record the next concrete implementation step before leaving the thread.

### Resume a project

1. Read `plan.md`, `context-notes.md`, and `checklist.md` in that order.
2. Summarize the current state in a few lines before proposing new work.
3. Preserve prior decisions unless the user explicitly changes them.
4. If the plan changed, update the documents before or alongside code changes.

### Update during work

- Update `plan.md` only when goals, scope, sequencing, or validation strategy materially change.
- Update `context-notes.md` whenever there is a decision, blocker, implementation milestone, file-level progress change, or handoff note worth preserving.
- Update `checklist.md` whenever work starts, completes, is deferred, or is newly discovered.
- Prefer appending concise bullets over rewriting entire files.
- Always refresh `Last updated` and `Next step` when the project state meaningfully changes.

### Close a project

- Do not delete the folder.
- Mark the project status as `Completed`.
- Record the final outcome, validation status, and any follow-up items in `context-notes.md`.
- Ensure `checklist.md` shows the remaining work explicitly as deferred, cancelled, or complete.
- Keep the finished project in `docs/projects/<project-slug>/` unless the user later asks for an archive flow.

## File Contract

- `plan.md`: what will be done and how success will be checked.
- `context-notes.md`: what has happened, what was decided, and where to restart.
- `checklist.md`: current execution state.

Read [references/memory-rules.md](references/memory-rules.md) when you need the detailed update rules, status conventions, or template expectations.

## Guardrails

- Treat these docs as working memory, not polished product docs.
- Keep entries concise and additive.
- Prefer facts over speculation.
- Do not create a new project folder until you have checked whether an existing project already covers the request.
- Do not silently overwrite an existing project folder unless the user asked to reset it.
- If the project slug is unclear, derive it from the project title with lowercase hyphenation.

## Resources

- `scripts/find_related_projects.py`: inspect `docs/projects/` and rank likely related projects before creating a new one.
- `scripts/init_project_memory.py`: create `docs/projects/<slug>/` and initialize the three standard files.
- `references/memory-rules.md`: detailed rules for when and how to update each document.

#!/usr/bin/env python3
"""Initialize project memory docs under docs/projects/<project-slug>/."""

from __future__ import annotations

import argparse
import re
import sys
from datetime import date
from pathlib import Path


def slugify(value: str) -> str:
    normalized = value.strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    normalized = re.sub(r"-{2,}", "-", normalized).strip("-")
    if not normalized:
        raise ValueError("project name must contain letters or digits")
    return normalized


def build_plan(title: str, slug: str, today: str) -> str:
    return f"""# {title}

- Slug: `{slug}`
- Status: `Planned`
- Created: `{today}`
- Last updated: `{today}`

## Goal

- [TODO] Describe the outcome this project should achieve.

## Scope

- [TODO] List what this project includes.

## Non-goals

- [TODO] List what this project will not address.

## Deliverables

- [TODO] List the concrete outputs.

## Implementation Plan

- [TODO] Break the work into phases or steps.

## Validation Plan

- [TODO] Describe how success will be verified.

## Risks / Open Questions

- [TODO] Capture uncertainties or decisions still pending.
"""


def build_context(title: str, slug: str, today: str) -> str:
    return f"""# {title}

- Slug: `{slug}`
- Status: `Planned`
- Created: `{today}`
- Last updated: `{today}`

## Current Summary

- Project initialized.

## Decisions

- [TODO] Record important decisions here.

## Progress Log

- `{today}`: Project memory initialized.

## Changed Files

- None yet.

## Blockers

- None.

## Next Step

- [TODO] Write the next concrete action.

## Handoff Notes

- [TODO] Add restart notes for the next thread or session.
"""


def build_checklist(title: str, slug: str, today: str) -> str:
    return f"""# {title}

- Slug: `{slug}`
- Status: `Planned`
- Last updated: `{today}`

## Todo

- [ ] [TODO] Add the first task.

## In Progress

- [ ] None.

## Done

- [x] Created project memory files.
"""


def write_file(path: Path, content: str, force: bool) -> None:
    if path.exists() and not force:
        raise FileExistsError(f"{path} already exists")
    path.write_text(content, encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create plan/context/checklist docs for a project.",
    )
    parser.add_argument("project_name", help="Human-readable project title")
    parser.add_argument(
        "--root",
        default="docs/projects",
        help="Base directory for project memory folders",
    )
    parser.add_argument(
        "--slug",
        help="Explicit project slug. Defaults to a slugified project name.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing files if they already exist.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    title = args.project_name.strip()
    if not title:
        print("error: project_name cannot be empty", file=sys.stderr)
        return 1

    try:
        slug = args.slug or slugify(title)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    today = date.today().isoformat()
    project_dir = Path(args.root) / slug
    project_dir.mkdir(parents=True, exist_ok=True)

    try:
        write_file(project_dir / "plan.md", build_plan(title, slug, today), args.force)
        write_file(
            project_dir / "context-notes.md",
            build_context(title, slug, today),
            args.force,
        )
        write_file(
            project_dir / "checklist.md",
            build_checklist(title, slug, today),
            args.force,
        )
    except FileExistsError as exc:
        print(f"error: {exc}", file=sys.stderr)
        print("hint: rerun with --force to overwrite existing files", file=sys.stderr)
        return 1

    print(f"created: {project_dir}")
    print(f"- {project_dir / 'plan.md'}")
    print(f"- {project_dir / 'context-notes.md'}")
    print(f"- {project_dir / 'checklist.md'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

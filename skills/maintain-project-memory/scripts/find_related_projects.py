#!/usr/bin/env python3
"""Find likely related project-memory folders under docs/projects."""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path


TOKEN_RE = re.compile(r"[a-z0-9]+")


@dataclass
class ProjectCandidate:
    path: Path
    slug: str
    title: str
    status: str
    summary: str
    next_step: str
    score: int


def tokenize(text: str) -> list[str]:
    return [match.group(0) for match in TOKEN_RE.finditer(text.lower()) if len(match.group(0)) >= 2]


def unique_tokens(text: str) -> set[str]:
    return set(tokenize(text))


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def extract_heading(text: str) -> str:
    for line in text.splitlines():
        if line.startswith("# "):
            return line[2:].strip()
    return ""


def extract_field(text: str, name: str) -> str:
    prefix = f"- {name}:"
    for line in text.splitlines():
        if line.startswith(prefix):
            return line[len(prefix) :].strip().strip("`")
    return ""


def extract_section(text: str, name: str) -> str:
    lines = text.splitlines()
    heading = f"## {name}"
    for index, line in enumerate(lines):
        if line.strip() != heading:
            continue
        collected: list[str] = []
        for next_line in lines[index + 1 :]:
            if next_line.startswith("## "):
                break
            stripped = next_line.strip()
            if stripped:
                collected.append(stripped.lstrip("- ").strip())
        return " ".join(collected)
    return ""


def build_candidate(project_dir: Path, query_tokens: set[str]) -> ProjectCandidate | None:
    plan_text = read_text(project_dir / "plan.md")
    context_text = read_text(project_dir / "context-notes.md")
    checklist_text = read_text(project_dir / "checklist.md")
    if not any((plan_text, context_text, checklist_text)):
        return None

    title = extract_heading(plan_text) or extract_heading(context_text) or project_dir.name
    status = (
        extract_field(context_text, "Status")
        or extract_field(plan_text, "Status")
        or extract_field(checklist_text, "Status")
        or "Unknown"
    )
    summary = extract_section(context_text, "Current Summary") or extract_section(plan_text, "Goal")
    next_step = extract_section(context_text, "Next Step")

    slug_tokens = unique_tokens(project_dir.name.replace("-", " "))
    title_tokens = unique_tokens(title)
    content_tokens = unique_tokens(
        " ".join(
            [
                plan_text,
                context_text,
                checklist_text,
            ]
        )
    )

    slug_matches = query_tokens & slug_tokens
    title_matches = query_tokens & title_tokens
    content_matches = query_tokens & content_tokens

    score = len(slug_matches) * 8 + len(title_matches) * 5 + len(content_matches) * 2
    if score == 0:
        return None

    return ProjectCandidate(
        path=project_dir,
        slug=project_dir.name,
        title=title,
        status=status,
        summary=summary or "No summary recorded.",
        next_step=next_step or "No next step recorded.",
        score=score,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Find related project-memory folders under docs/projects.",
    )
    parser.add_argument("query", help="Short request summary or feature description")
    parser.add_argument(
        "--root",
        default="docs/projects",
        help="Project-memory root to inspect",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=5,
        help="Maximum number of candidates to print",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root)
    if not root.exists():
        print(f"no project root: {root}")
        return 0

    query_tokens = unique_tokens(args.query)
    if not query_tokens:
        print("no searchable terms in query")
        return 1

    candidates: list[ProjectCandidate] = []
    for child in sorted(root.iterdir()):
        if not child.is_dir():
            continue
        candidate = build_candidate(child, query_tokens)
        if candidate is not None:
            candidates.append(candidate)

    if not candidates:
        print("no related projects found")
        return 0

    candidates.sort(key=lambda item: (-item.score, item.slug))
    for candidate in candidates[: max(args.limit, 1)]:
        print(f"{candidate.slug} | status={candidate.status} | score={candidate.score}")
        print(f"  title: {candidate.title}")
        print(f"  path: {candidate.path}")
        print(f"  summary: {candidate.summary}")
        print(f"  next-step: {candidate.next_step}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

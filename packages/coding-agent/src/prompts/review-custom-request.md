## Code Review Request

Mode: custom instructions.

## Distribution

Use `task`: `agent: "reviewer"`, `tasks` array. Create exactly **1 reviewer task**; assignment MUST include custom instructions and the `FINAL VALIDATION` marker. This sole final reviewer runs the canonical project-wide test command exactly once after review, and MUST NOT trigger builds or rerun the suite per file.

## Reviewer Instructions

Reviewer MUST:
1. Follow custom instructions.
2. Read referenced files/workspace context needed to evaluate them.
3. Use incremental `yield` sections for findings and verdict fields; do NOT call a separate finding tool.

## Custom Instructions

{{instructions}}

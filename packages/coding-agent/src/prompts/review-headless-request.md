## Code Review Request

Mode: headless review request.

Distribution: Use `task` with `agent: "reviewer"` and a `tasks` array; create exactly **1 reviewer task** for recent code changes. Include the `FINAL VALIDATION` assignment marker; this sole final reviewer runs the canonical project-wide test command exactly once after review, and MUST NOT trigger builds or rerun the suite per file.

{{#if focus}}
Focus: {{focus}}
{{/if}}

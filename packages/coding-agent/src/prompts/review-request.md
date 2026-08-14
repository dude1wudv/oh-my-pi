## Code Review Request

### Mode

{{mode}}

### Changed Files ({{len files}} files, +{{totalAdded}}/-{{totalRemoved}} lines)

{{#if files.length}}
{{#table files headers="File|+/-|Type"}}
{{path}} | +{{linesAdded}}/-{{linesRemoved}} | {{ext}}
{{/table}}
{{else}}
_No files to review._
{{/if}}
{{#if excluded.length}}
### Excluded Files ({{len excluded}})

{{#list excluded prefix="- " join="\n"}}
`{{path}}` (+{{linesAdded}}/-{{linesRemoved}}) — {{reason}}
{{/list}}
{{/if}}

### Distribution Guidelines

Use the `task` tool with `agent: "reviewer"` and a `tasks` array.
{{#when agentCount "==" 1}}Create exactly **1 reviewer task**. Include the `FINAL VALIDATION` assignment marker in that task; it is the sole final reviewer and MUST run the canonical project-wide test command exactly once after its review.{{else}}Spawn **{{agentCount}} reviewer agents** in parallel for static, file-local review only. These assignments MUST NOT run project-wide or large-scale tests, builds, or validation gates. After every parallel reviewer settles, dispatch exactly **1 additional reviewer task** marked `FINAL VALIDATION` to run the canonical project-wide test command exactly once.{{/when}}
{{#if multiAgent}}
Group files by locality, e.g.:
- Same directory/module → same agent
- Related functionality → same agent
- Tests with their implementation files → same agent
{{/if}}

### Reviewer Instructions

Reviewer MUST:
1. Focus ONLY on assigned files
2. {{#if skipDiff}}{{diffInstruction}}{{else}}MUST use diff hunks below (NEVER re-run git diff){{/if}}
3. {{contextInstruction}}
4. Use incremental `yield` sections for findings and verdict fields; do NOT call a separate finding tool

{{#if skipDiff}}
### Diff Previews

_Full diff too large ({{len files}} files). Showing first ~{{linesPerFile}} lines per file._

{{#list files join="\n\n"}}
#### {{path}}

{{#codeblock lang="diff"}}
{{hunksPreview}}
{{/codeblock}}
{{/list}}
{{else}}

### Diff

<diff>
{{rawDiff}}
</diff>
{{/if}}

{{#if additionalInstructions}}
### Additional Instructions

{{additionalInstructions}}
{{/if}}

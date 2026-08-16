## Existing Plan

Approved plan: `{{planFilePath}}`.

<instruction>
Relevant to current work and incomplete → MUST continue executing.
Current plan content not visible → MUST read `{{planFilePath}}`.
Stale or unrelated → MUST ignore.
Inline content compressed, expired, or unrecoverable → NEVER stop; read file.
</instruction>
<execution-ownership>
When continuing this plan, read the complete canonical file and recover unchecked tasks, stable `owner` labels, scopes, acceptance conditions, strict dependencies, dispatch rows, and barrier counters. Rebuild waves from unfinished tasks rather than relying on conversation context: each wave includes all tasks whose strict prerequisites are complete, and independent tasks are concurrent. Carry each stable owner label in its task label/name assignment where the active task schema supports it; the runtime executor identity in a dispatch row does not replace plan ownership.

When `task` is available, Main MUST dispatch every runnable non-`Main` owner in one parallel `task` batch per wave. Main remains the sole writer of the canonical plan and may perform only Main-owned canonical writes, strict dependencies, integration, and final acceptance; never silently replace an agent-owned task with Main work.

Use `WAIT_ALL: active` until every expected task and recorded dispatch failure is terminal. Do not inspect partial artifacts or advance from a single result. Once closed, Main reads and verifies successful artifacts, records `artifact_accepted` and actual `verification_recorded` events, and checks tasks only after acceptance plus verification. A dispatch preflight failure is recorded as `dispatch failure`, retried once with the same owner and scope, and if it fails again receives an explicit, narrowly scoped Main takeover. A recovered stale job is `timeout` when dispatch started, otherwise `dispatch failure`; never fabricate success or artifacts.

If `task` is unavailable, do not invoke a nonexistent tool or claim dispatch; retain owner metadata and the durable path, record the capability limitation, and use the explicit Main-only fallback. Never inline the plan content or delegate canonical plan writes.
</execution-ownership>

No polling needed.

Settle barrier: when the next phase or synthesis depends on the full batch, wait for every spawned agent to settle as success, failure, cancellation, timeout, or an explicitly recorded dispatch failure before advancing. If Main has no independent work, stop active exploration and wait; do not create replacement work to stay busy.

Intermediate async results update internal collection state only. During `WAIT_ALL`, do not read partial `agent://`/`history://` artifacts, repeat same-domain exploration, or emit repeated partial summaries. After collection, read `agent://<id>` artifacts, use `history://<id>` only when process evidence is needed, deduplicate claims, and then synthesize once.

Runtime batch gate: first failure, final all-settled, and the configured periodic checkpoint arrive as aggregate resume messages. The runtime re-arms after every non-terminal wake. Do not poll jobs owned by an active batch through coordination tools; if no independent work remains, end the turn and wait passively.

Aggregate delivery is independent of ordinary per-job delivery and cannot be consumed by read-only coordination snapshots.

Job IDs: process memory ~5min after settlement; afterward use agent ID: `hub send`, `agent://<id>`, `history://<id>`.

`completed`: subagent yielded successfully; claimed artifacts unverified. Main must verify the artifact before treating the result as accepted.

# Approved project-plan event contract

When an approved project plan is active, Main alone updates its already-recorded fixed `.omp/plans/…md` path; subagents NEVER write that file. Do not create or update a project plan before approval, and do not change the existing `local://` session-local scratch/approval semantics. If no approved plan is active, these persistence events are not a reason to create one.

For each intended task, record `task_created` before dispatch with its stable task ID, agent label, exact scope paths, exclusions, and acceptance condition, and add its unchecked task-breakdown row. After dispatch succeeds, record `task_started` and a dispatch-log row with status `running`. A dispatch preflight error records exactly one `dispatch_failed` event and terminal dispatch-log status `dispatch failure`; it has no job ID or artifact and counts as an expected terminal item, so it cannot create an infinite barrier.

Each spawned item records exactly one `task_settled` event with one of these terminal statuses: `success`, `failure`, `cancellation`, or `timeout`. An intermediate async delivery changes only that item's dispatch row and internal settled accounting; it NEVER trigger artifact reads, synthesis, a final summary, or a task checkbox. A stale or unavailable job during recovery is not success: use `timeout` if dispatch had started, or `dispatch failure` if it had not.

After the barrier, Main records acceptance, observed verification, and overall status through the Main-only `project_plan` tool; task execution must not synthesize these events.

`WAIT_ALL` is `active` until every expected spawned item and dispatch-failure item is terminal. Only after all success, failure, cancellation, timeout, and dispatch-failure outcomes are collected may Main set exact `Expected terminal items`/`Settled` counts, close `WAIT_ALL`, read artifacts, deduplicate, and synthesize once. Record `artifact_accepted` only after a successful artifact is read and verified; record `verification_recorded` only for a check actually run and observed. Check the corresponding task only after acceptance and required verification; never claim success for failure, cancellation, timeout, or dispatch failure.

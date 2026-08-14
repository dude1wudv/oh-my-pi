import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	applyProjectPlanUpdate,
	type ProjectPlanUpdateEvent,
	updateProjectPlanFile,
} from "@dude1wudv/pi-coding-agent/plan-mode/state";

const NOW = new Date("2025-01-02T03:04:05.000Z");

// This is the smallest approved document that still exercises every dynamic
// section. The verification checkbox is deliberately outside Task breakdown:
// it must never affect the execution barrier counts.
const APPROVED_PLAN = `# Approved project plan

> Status: planned
> Updated: 2025-01-01 00:00 UTC+00:00

## Task breakdown
<!-- runtime task rows are appended here -->

## Agent dispatch log
| # | Agent | Scope | Status | Artifact | Follow-up |
|---|---|---|---|---|---|

## Result barrier
- Expected terminal items: 0
- Settled: 0
- WAIT_ALL: active
- Last barrier decision: initial

## Verification
- [ ] Existing verification remains independent
`;

function applyEvents(events: ProjectPlanUpdateEvent[]): string {
	return events.reduce((content, event) => applyProjectPlanUpdate(content, event, NOW), APPROVED_PLAN);
}

function sectionText(content: string, heading: string): string {
	const start = content.indexOf(`## ${heading}`);
	if (start < 0) throw new Error(`Missing section: ${heading}`);
	const next = content.indexOf("\n## ", start + 1);
	return content.slice(start, next < 0 ? content.length : next);
}

function taskBreakdown(content: string): string {
	return sectionText(content, "Task breakdown");
}

function dispatchLog(content: string): string {
	return sectionText(content, "Agent dispatch log");
}

function barrier(content: string): string {
	return sectionText(content, "Result barrier");
}

describe("project-plan state transitions", () => {
	it("keeps a settled task unchecked until Main accepts its artifact and verifies it", () => {
		const content = applyEvents([
			{ type: "task_created", taskId: "task-a", task: "Prepare source", owner: "scout", scope: "shared" },
			// Omitting scope here verifies that the row is matched by its stable ID
			// and retains the scope encoded when it was created.
			{ type: "task_started", taskId: "task-a", owner: "scout" },
			{ type: "task_settled", taskId: "task-a", status: "success", artifact: "agent://candidate-a" },
		]);

		expect(taskBreakdown(content)).toMatch(/^- \[ \] task-a .*status: success$/m);
		expect(taskBreakdown(content)).not.toMatch(/^- \[x\] task-a/m);
		expect(dispatchLog(content)).toContain("| scout | task-a — shared | success | agent://candidate-a | — |");
		expect(barrier(content)).toContain("- Expected terminal items: 1");
		expect(barrier(content)).toContain("- Settled: 1");
		expect(barrier(content)).toContain("- WAIT_ALL: closed");

		const beforeAcceptance = applyProjectPlanUpdate(
			content,
			{ type: "verification_recorded", taskId: "task-a", check: "before acceptance", passed: true },
			NOW,
		);
		expect(taskBreakdown(beforeAcceptance)).toMatch(/^- \[ \] task-a/m);

		const accepted = applyProjectPlanUpdate(
			beforeAcceptance,
			{ type: "artifact_accepted", taskId: "task-a", artifact: "artifact://accepted-a" },
			NOW,
		);
		expect(dispatchLog(accepted)).toContain(
			"| scout | task-a — shared | success | artifact://accepted-a | artifact accepted |",
		);
		expect(taskBreakdown(accepted)).toMatch(/^- \[ \] task-a/m);

		const verified = applyProjectPlanUpdate(
			accepted,
			{
				type: "verification_recorded",
				taskId: "task-a",
				check: "after acceptance",
				passed: true,
				detail: "focused check passed",
			},
			NOW,
		);
		expect(taskBreakdown(verified)).toMatch(/^- \[x\] task-a .*status: success$/m);
		expect(sectionText(verified, "Verification")).toContain("- [x] after acceptance — focused check passed");
	});

	it("persists dispatch failures in the row follow-up cell without checking the task", () => {
		const content = applyEvents([
			{ type: "task_created", taskId: "task-fail", task: "Inspect target", owner: "scout", scope: "batch scope" },
			{
				type: "dispatch_failed",
				taskId: "task-fail",
				error: 'Unknown agent "missing"',
				owner: "scout",
				scope: "batch scope",
			},
		]);

		expect(dispatchLog(content)).toContain(
			'| scout | task-fail — batch scope | dispatch failure | — | Unknown agent "missing" |',
		);
		expect(taskBreakdown(content)).toMatch(/^- \[ \] task-fail .*status: dispatch failure$/m);
		expect(taskBreakdown(content)).not.toMatch(/^- \[x\] task-fail/m);
		expect(barrier(content)).toContain("- Expected terminal items: 1");
		expect(barrier(content)).toContain("- Settled: 1");
	});

	it("updates an accepted artifact in place, preserves terminal status, and is idempotent", () => {
		let content = applyEvents([
			{ type: "task_created", taskId: "task-c", task: "Cancel safely", owner: "task", scope: "scope-c" },
			{ type: "task_started", taskId: "task-c", owner: "task", scope: "scope-c" },
			{
				type: "task_settled",
				taskId: "task-c",
				status: "cancellation",
				artifact: "agent://candidate-c",
				followUp: "cancelled by user",
			},
		]);

		content = applyProjectPlanUpdate(
			content,
			{ type: "artifact_accepted", taskId: "task-c", artifact: "artifact://accepted-c" },
			NOW,
		);
		content = applyProjectPlanUpdate(
			content,
			{ type: "artifact_accepted", taskId: "task-c", artifact: "artifact://accepted-c" },
			NOW,
		);

		const rows = dispatchLog(content)
			.split("\n")
			.filter(line => line.includes("task-c — scope-c"));
		expect(rows).toHaveLength(1);
		expect(rows[0]).toBe(
			"| ? | task | task-c — scope-c | cancellation | artifact://accepted-c | cancelled by user; artifact accepted |",
		);
		expect(rows[0]?.match(/artifact accepted/g)).toHaveLength(1);
	});

	it("gates task checkboxes on a task-scoped passed verification after acceptance", () => {
		let content = applyEvents([
			{ type: "task_created", taskId: "task-gated", task: "Run checks", owner: "task" },
			{ type: "task_started", taskId: "task-gated" },
			{ type: "task_settled", taskId: "task-gated", status: "failure" },
			{ type: "artifact_accepted", taskId: "task-gated", artifact: "artifact://accepted" },
		]);

		const failed = applyProjectPlanUpdate(
			content,
			{ type: "verification_recorded", taskId: "task-gated", check: "failed check", passed: false },
			NOW,
		);
		expect(taskBreakdown(failed)).toMatch(/^- \[ \] task-gated/m);
		expect(sectionText(failed, "Verification")).toContain("- [ ] failed check");

		content = applyProjectPlanUpdate(
			failed,
			{ type: "verification_recorded", taskId: "task-gated", check: "passed check", passed: true },
			NOW,
		);
		expect(taskBreakdown(content)).toMatch(/^- \[x\] task-gated .*status: failure$/m);
		expect(sectionText(content, "Verification")).toContain("- [x] passed check");

		// A plan-wide check is recorded, but cannot identify a task to check.
		const planWide = applyProjectPlanUpdate(
			content,
			{ type: "verification_recorded", check: "plan-wide check", passed: true },
			NOW,
		);
		expect(taskBreakdown(planWide)).toMatch(/^- \[x\] task-gated/m);
	});

	it("counts only Task breakdown and dispatch-log rows for the result barrier", () => {
		let content = applyProjectPlanUpdate(
			APPROVED_PLAN,
			{ type: "task_created", taskId: "task-one", task: "First", owner: "task" },
			NOW,
		);
		content = applyProjectPlanUpdate(
			content,
			{ type: "task_created", taskId: "task-two", task: "Second", owner: "task" },
			NOW,
		);
		content = applyProjectPlanUpdate(
			content,
			{ type: "verification_recorded", check: "unrelated check", passed: false },
			NOW,
		);
		expect(barrier(content)).toContain("- Expected terminal items: 2");
		expect(barrier(content)).toContain("- Settled: 0");
		expect(barrier(content)).toContain("- WAIT_ALL: active");

		content = applyProjectPlanUpdate(content, { type: "task_settled", taskId: "task-one", status: "timeout" }, NOW);
		expect(barrier(content)).toContain("- Settled: 1");
		expect(barrier(content)).toContain("- WAIT_ALL: active");

		content = applyProjectPlanUpdate(
			content,
			{ type: "dispatch_failed", taskId: "task-two", error: "capacity" },
			NOW,
		);
		expect(barrier(content)).toContain("- Expected terminal items: 2");
		expect(barrier(content)).toContain("- Settled: 2");
		expect(barrier(content)).toContain("- WAIT_ALL: closed");

		const completed = applyProjectPlanUpdate(
			content,
			{ type: "status_changed", status: "completed", reason: "accepted and verified" },
			NOW,
		);
		expect(completed).toContain("> Status: completed");
		expect(barrier(completed)).toContain("- WAIT_ALL: closed");
	});

	it("serializes real file updates so concurrent session callbacks retain both task rows", async () => {
		const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "omp-project-plan-state-"));
		try {
			const plansDir = path.join(cwd, ".omp", "plans");
			await fs.mkdir(plansDir, { recursive: true });
			const projectPlanPath = ".omp/plans/approved.md";
			const target = path.join(cwd, projectPlanPath);
			await fs.writeFile(target, APPROVED_PLAN, "utf8");

			let tail = Promise.resolve();
			const updateProjectPlan = (event: ProjectPlanUpdateEvent): Promise<void> => {
				const next = tail.then(() =>
					updateProjectPlanFile({
						cwd,
						projectPlanPath,
						event,
						now: NOW,
					}),
				);
				tail = next.catch(() => undefined);
				return next;
			};

			await Promise.all([
				updateProjectPlan({ type: "task_created", taskId: "serialized-a", task: "First", owner: "task" }),
				updateProjectPlan({ type: "task_created", taskId: "serialized-b", task: "Second", owner: "task" }),
			]);
			const persisted = await fs.readFile(target, "utf8");
			expect(taskBreakdown(persisted)).toContain("serialized-a — First");
			expect(taskBreakdown(persisted)).toContain("serialized-b — Second");
			expect(barrier(persisted)).toContain("- Expected terminal items: 2");
		} finally {
			await fs.rm(cwd, { recursive: true, force: true });
		}
	});
});

import { describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { type } from "@dude1wudv/omptype";
import { Settings } from "@dude1wudv/pi-coding-agent/config/settings";
import type { ProjectPlanUpdateEvent } from "@dude1wudv/pi-coding-agent/plan-mode/state";
import { type ProjectPlanParams, ProjectPlanTool, type ToolSession } from "@dude1wudv/pi-coding-agent/tools";

function createSession(overrides: Partial<ToolSession> = {}): ToolSession {
	return {
		cwd: "/tmp/project-plan-tool",
		hasUI: false,
		settings: Settings.isolated(),
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
		...overrides,
	} as ToolSession;
}

function mainSession(events: ProjectPlanUpdateEvent[], path = ".omp/plans/approved.md"): ToolSession {
	return createSession({
		isMainSession: true,
		getProjectPlanPath: () => path,
		updateProjectPlan: async event => {
			events.push(event);
		},
	});
}

describe("ProjectPlanTool", () => {
	it("validates action-specific fields through its wire schema", () => {
		const tool = new ProjectPlanTool(createSession({ isMainSession: true }));

		expect(tool.parameters({ action: "artifact_accepted" })).toBeInstanceOf(type.errors);
		expect(tool.parameters({ action: "verification_recorded" })).toBeInstanceOf(type.errors);
		expect(tool.parameters({ action: "status_changed" })).toBeInstanceOf(type.errors);
		expect(tool.parameters({ action: "status_changed", status: "completed" })).not.toBeInstanceOf(type.errors);
		expect(tool.parameters({ action: "status_changed", status: "unknown" as never })).toBeInstanceOf(type.errors);
	});

	it("records exact artifact, verification, and status event payloads", async () => {
		const events: ProjectPlanUpdateEvent[] = [];
		const tool = new ProjectPlanTool(mainSession(events));

		await tool.execute("artifact-call", {
			action: "artifact_accepted",
			taskId: "task-a",
			artifact: "artifact://task-a",
		});
		await tool.execute("verification-call", {
			action: "verification_recorded",
			taskId: "task-a",
			check: "bun test",
			passed: true,
			detail: "all focused checks passed",
		});
		await tool.execute("status-call", {
			action: "status_changed",
			status: "completed",
			reason: "accepted and verified",
		});

		expect(events).toEqual([
			{ type: "artifact_accepted", taskId: "task-a", artifact: "artifact://task-a" },
			{
				type: "verification_recorded",
				taskId: "task-a",
				check: "bun test",
				passed: true,
				detail: "all focused checks passed",
			},
			{ type: "status_changed", status: "completed", reason: "accepted and verified" },
		]);
	});

	it("rejects missing action fields with ordinary tool errors", async () => {
		const events: ProjectPlanUpdateEvent[] = [];
		const tool = new ProjectPlanTool(mainSession(events));

		await expect(
			tool.execute("missing-artifact", { action: "artifact_accepted", taskId: "task-a" } as ProjectPlanParams),
		).rejects.toThrow('requires a non-empty "artifact"');
		await expect(
			tool.execute("missing-check", { action: "verification_recorded" } as ProjectPlanParams),
		).rejects.toThrow('requires a non-empty "check"');
		await expect(tool.execute("missing-status", { action: "status_changed" } as ProjectPlanParams)).rejects.toThrow(
			'requires a valid "status"',
		);
		expect(events).toHaveLength(0);
	});

	it("is Main-only and refuses to acknowledge an event without an approved path", async () => {
		const child = createSession({ isMainSession: false });
		expect(ProjectPlanTool.createIf(child)).toBeNull();
		await expect(
			new ProjectPlanTool(child).execute("child-call", {
				action: "status_changed",
				status: "executing",
			}),
		).rejects.toThrow("available only in the Main session");

		const noPathUpdater = vi.fn(async (_event: ProjectPlanUpdateEvent) => {});
		const noPath = new ProjectPlanTool(
			createSession({
				isMainSession: true,
				updateProjectPlan: noPathUpdater,
			}),
		);
		await expect(noPath.execute("no-path-call", { action: "status_changed", status: "executing" })).rejects.toThrow(
			"No approved project plan is attached to this session",
		);
		expect(noPathUpdater).not.toHaveBeenCalled();
	});

	it("does not write a path directly when no updater is attached", async () => {
		const root = await fs.mkdtemp(path.join(os.tmpdir(), "omp-project-plan-tool-"));
		try {
			const target = path.join(root, ".omp", "plans", "approved.md");
			const tool = new ProjectPlanTool(
				createSession({
					isMainSession: true,
					getProjectPlanPath: () => target,
				}),
			);
			await expect(
				tool.execute("direct-write-call", { action: "status_changed", status: "completed" }),
			).rejects.toThrow("No approved project plan is attached to this session");
			expect(await Bun.file(target).exists()).toBe(false);
		} finally {
			await fs.rm(root, { recursive: true, force: true });
		}
	});

	it("surfaces an updater failure instead of claiming the event was persisted", async () => {
		const updater = vi.fn(async (_event: ProjectPlanUpdateEvent) => {
			throw new Error("disk full");
		});
		const tool = new ProjectPlanTool(
			createSession({
				isMainSession: true,
				getProjectPlanPath: () => ".omp/plans/approved.md",
				updateProjectPlan: updater,
			}),
		);

		await expect(
			tool.execute("failed-update", { action: "artifact_accepted", taskId: "task-a", artifact: "artifact://a" }),
		).rejects.toThrow("Failed to update the approved project plan: disk full");
		expect(updater).toHaveBeenCalledTimes(1);
	});
});

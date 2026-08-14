import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { Settings } from "@dude1wudv/pi-coding-agent/config/settings";
import type { ProjectPlanUpdateEvent } from "@dude1wudv/pi-coding-agent/plan-mode/state";
import { AgentLifecycleManager } from "@dude1wudv/pi-coding-agent/registry/agent-lifecycle";
import { AgentRegistry } from "@dude1wudv/pi-coding-agent/registry/agent-registry";
import { TaskTool } from "@dude1wudv/pi-coding-agent/task";
import * as discoveryModule from "@dude1wudv/pi-coding-agent/task/discovery";
import * as executorModule from "@dude1wudv/pi-coding-agent/task/executor";
import type { AgentDefinition, SingleResult, TaskParams } from "@dude1wudv/pi-coding-agent/task/types";
import type { ToolSession } from "@dude1wudv/pi-coding-agent/tools";

const agent: AgentDefinition = {
	name: "task",
	description: "Task agent",
	systemPrompt: "You are a task agent.",
	source: "bundled",
};

function resultFor(id: string, overrides: Partial<SingleResult> = {}): SingleResult {
	return {
		index: 0,
		id,
		agent: "task",
		agentSource: "bundled",
		task: "work",
		assignment: "work",
		exitCode: 0,
		output: "done",
		stderr: "",
		truncated: false,
		durationMs: 1,
		tokens: 1,
		requests: 1,
		...overrides,
	};
}

function session(events: ProjectPlanUpdateEvent[], approved: boolean): ToolSession {
	return {
		cwd: "/tmp",
		hasUI: false,
		settings: Settings.isolated({ "async.enabled": false }),
		getSessionFile: () => null,
		getSessionSpawns: () => "*",
		getAgentId: () => "Main",
		getArtifactsDir: () => null,
		...(approved
			? {
					isMainSession: true,
					getProjectPlanPath: () => ".omp/plans/approved.md",
					updateProjectPlan: async (event: ProjectPlanUpdateEvent) => {
						events.push(event);
					},
				}
			: {}),
	} as unknown as ToolSession;
}

describe("TaskTool project-plan lifecycle", () => {
	beforeEach(() => {
		AgentRegistry.resetGlobalForTests();
		AgentLifecycleManager.resetGlobalForTests();
		vi.spyOn(discoveryModule, "discoverAgents").mockResolvedValue({ agents: [agent], projectAgentsDir: null });
	});

	afterEach(() => {
		vi.restoreAllMocks();
		AgentLifecycleManager.resetGlobalForTests();
		AgentRegistry.resetGlobalForTests();
	});

	it("records created, started, and settled for sync success", async () => {
		const events: ProjectPlanUpdateEvent[] = [];
		vi.spyOn(executorModule, "runSubprocess").mockImplementation(async options => resultFor(options.id ?? "task"));
		const tool = await TaskTool.create(session(events, true));

		await tool.execute("call", { agent: "task", task: "Do the work." } as TaskParams);

		expect(events.map(event => event.type)).toEqual(["task_created", "task_started", "task_settled"]);
		expect(events[2]).toMatchObject({ type: "task_settled", status: "success" });
	});

	it("records dispatch failure after preflight without running an executor", async () => {
		const events: ProjectPlanUpdateEvent[] = [];
		const run = vi.spyOn(executorModule, "runSubprocess");
		const tool = await TaskTool.create(session(events, true));

		await tool.execute("call", { agent: "missing", task: "Do the work." } as TaskParams);

		expect(events.map(event => event.type)).toEqual(["task_created", "dispatch_failed"]);
		expect(run).not.toHaveBeenCalled();
	});

	it("does not emit lifecycle events without an approved plan", async () => {
		const events: ProjectPlanUpdateEvent[] = [];
		vi.spyOn(executorModule, "runSubprocess").mockImplementation(async options => resultFor(options.id ?? "task"));
		const tool = await TaskTool.create(session(events, false));

		await tool.execute("call", { agent: "task", task: "Do the work." } as TaskParams);

		expect(events).toEqual([]);
	});
});
